#!/usr/bin/env python3
"""
Cursor OpenAI Proxy - OpenAI-compatible API proxy for Cursor IDE.

This proxy translates OpenAI API requests to Cursor's internal HTTP/2 + protobuf API,
allowing integration with tools like OpenClaw that expect OpenAI-compatible endpoints.

Usage:
    python3 proxy.py [--port PORT]

Environment variables:
    CURSOR_PROXY_PORT - Port to listen on (default: 3011)
"""

import argparse
import asyncio
import json
import os
import sys
import time
import uuid
from http.server import HTTPServer, BaseHTTPRequestHandler

# Import the Cursor HTTP/2 client (from cursor_api_demo)
try:
    from cursor_http2_client import CursorHTTP2Client
except ImportError:
    print("Error: cursor_http2_client.py not found.")
    print("Please copy the required files from eisbaw/cursor_api_demo:")
    print("  - cursor_http2_client.py")
    print("  - cursor_proper_protobuf.py")
    print("  - cursor_streaming_decoder.py")
    print("  - cursor_auth_reader.py")
    print("  - cursor_chat_proto.py")
    print("  - server_full_pb2.py (generated from protobuf)")
    sys.exit(1)

# Available models (as of Cursor 2.3.41)
AVAILABLE_MODELS = [
    "gpt-4o",
    "gpt-4",
    "gpt-5.1-codex",
    "claude-4-sonnet",
    "claude-4.5-sonnet-thinking",
    "claude-4.5-opus-high",
    "claude-4.5-opus-high-thinking",
]

# Global client instance
client = None


def get_client():
    """Lazy initialization of Cursor client."""
    global client
    if client is None:
        client = CursorHTTP2Client()
    return client


class ProxyHandler(BaseHTTPRequestHandler):
    """HTTP request handler for OpenAI-compatible API."""

    protocol_version = "HTTP/1.1"

    def log_message(self, format, *args):
        """Custom log format."""
        print(f"[{self.log_date_time_string()}] {format % args}")

    def send_json(self, data, status=200):
        """Send JSON response."""
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", len(body))
        self.end_headers()
        self.wfile.write(body)

    def send_error_json(self, status, message):
        """Send error as JSON."""
        self.send_json({"error": {"message": message, "type": "api_error"}}, status)

    def do_OPTIONS(self):
        """Handle CORS preflight."""
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_GET(self):
        """Handle GET requests."""
        if self.path == "/v1/models":
            self.handle_models()
        elif self.path == "/health" or self.path == "/":
            self.send_json({"status": "ok", "service": "cursor-openai-proxy"})
        else:
            self.send_error_json(404, "Not Found")

    def do_POST(self):
        """Handle POST requests."""
        if self.path == "/v1/chat/completions":
            self.handle_chat_completions()
        else:
            self.send_error_json(404, "Not Found")

    def handle_models(self):
        """Return available models."""
        response = {
            "object": "list",
            "data": [
                {
                    "id": model,
                    "object": "model",
                    "created": int(time.time()),
                    "owned_by": "cursor",
                }
                for model in AVAILABLE_MODELS
            ],
        }
        self.send_json(response)

    def handle_chat_completions(self):
        """Handle chat completion requests."""
        # Read request body
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length == 0:
            self.send_error_json(400, "Empty request body")
            return

        try:
            body = self.rfile.read(content_length).decode("utf-8")
            req = json.loads(body)
        except (json.JSONDecodeError, UnicodeDecodeError) as e:
            self.send_error_json(400, f"Invalid JSON: {e}")
            return

        # Extract parameters
        model = req.get("model", "gpt-4")
        messages = req.get("messages", [])
        stream = req.get("stream", False)

        if not messages:
            self.send_error_json(400, "messages is required")
            return

        # Validate model
        if model not in AVAILABLE_MODELS:
            self.log_message(f"Warning: Unknown model '{model}', proceeding anyway")

        # Build prompt from messages (simple format)
        prompt_parts = []
        for m in messages:
            role = m.get("role", "user")
            content = m.get("content", "")
            if isinstance(content, list):
                # Handle multi-part content (text only for now)
                content = " ".join(
                    p.get("text", "") for p in content if p.get("type") == "text"
                )
            prompt_parts.append(f"{role}: {content}")
        prompt = "\n".join(prompt_parts)

        # Call Cursor API
        try:
            cursor_client = get_client()
            response_text = asyncio.run(
                cursor_client.test_http2_breakthrough(prompt, model)
            )
        except Exception as e:
            self.log_message(f"Cursor API error: {e}")
            self.send_error_json(502, f"Cursor API error: {e}")
            return

        response_id = f"chatcmpl-{uuid.uuid4()}"
        created = int(time.time())

        if stream:
            self.send_streaming_response(response_id, model, created, response_text)
        else:
            self.send_json({
                "id": response_id,
                "object": "chat.completion",
                "created": created,
                "model": model,
                "choices": [
                    {
                        "index": 0,
                        "message": {
                            "role": "assistant",
                            "content": response_text or "",
                        },
                        "finish_reason": "stop",
                    }
                ],
                "usage": {
                    "prompt_tokens": 0,
                    "completion_tokens": 0,
                    "total_tokens": 0,
                },
            })

    def send_streaming_response(self, response_id, model, created, content):
        """Send streaming SSE response."""
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "keep-alive")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()

        # Send role chunk
        self.write_sse_chunk({
            "id": response_id,
            "object": "chat.completion.chunk",
            "created": created,
            "model": model,
            "choices": [{"index": 0, "delta": {"role": "assistant"}, "finish_reason": None}],
        })

        # Send content chunk
        if content:
            self.write_sse_chunk({
                "id": response_id,
                "object": "chat.completion.chunk",
                "created": created,
                "model": model,
                "choices": [{"index": 0, "delta": {"content": content}, "finish_reason": None}],
            })

        # Send finish chunk
        self.write_sse_chunk({
            "id": response_id,
            "object": "chat.completion.chunk",
            "created": created,
            "model": model,
            "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}],
        })

        # Send done
        self.wfile.write(b"data: [DONE]\n\n")
        self.wfile.flush()

    def write_sse_chunk(self, data):
        """Write a single SSE chunk."""
        self.wfile.write(f"data: {json.dumps(data)}\n\n".encode())
        self.wfile.flush()


def main():
    parser = argparse.ArgumentParser(description="Cursor OpenAI Proxy")
    parser.add_argument(
        "--port",
        type=int,
        default=int(os.environ.get("CURSOR_PROXY_PORT", 3011)),
        help="Port to listen on (default: 3011)",
    )
    parser.add_argument(
        "--host",
        default="127.0.0.1",
        help="Host to bind to (default: 127.0.0.1)",
    )
    args = parser.parse_args()

    # Verify client can be initialized
    try:
        get_client()
        print("✓ Cursor client initialized successfully")
    except Exception as e:
        print(f"✗ Failed to initialize Cursor client: {e}")
        sys.exit(1)

    server = HTTPServer((args.host, args.port), ProxyHandler)
    print(f"Cursor OpenAI Proxy listening on http://{args.host}:{args.port}")
    print(f"Available models: {', '.join(AVAILABLE_MODELS[:3])}...")
    print("Press Ctrl+C to stop")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.shutdown()


if __name__ == "__main__":
    main()
