#!/usr/bin/env python3
"""
Wuji DevConsole Backend
接收 PWA 請求 → 發給 Telegram Bot → 返回回覆
"""

import os
import time
import json
import hashlib
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import parse_qs, urlparse
import urllib.request
import urllib.error

# Config
BOT_TOKEN = "8327498414:AAFVEs7Ouf6JESIWGpLnD77GvJkxe9uXp68"  # 無極 Bot
CHAT_ID = "8090790323"  # 杜甫的 User ID
AUTH_CODE = "wuji666"
PORT = 18800

# Store for conversation
conversation = {
    "messages": [],
    "last_update_id": 0
}

class WujiHandler(SimpleHTTPRequestHandler):
    
    def do_OPTIONS(self):
        """Handle CORS preflight"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()
    
    def do_GET(self):
        """Handle GET requests"""
        parsed = urlparse(self.path)
        
        if parsed.path == '/api/messages':
            # Get recent messages
            self.send_json({"ok": True, "messages": conversation["messages"][-20:]})
        elif parsed.path == '/api/poll':
            # Long poll for new messages
            self.poll_updates()
        elif parsed.path.startswith('/api/'):
            self.send_json({"ok": False, "error": "Unknown endpoint"}, 404)
        else:
            # Serve static files
            super().do_GET()
    
    def do_POST(self):
        """Handle POST requests"""
        parsed = urlparse(self.path)
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode('utf-8')
        
        try:
            data = json.loads(body) if body else {}
        except json.JSONDecodeError:
            data = {}
        
        if parsed.path == '/api/auth':
            # Verify auth code
            if data.get('code') == AUTH_CODE:
                self.send_json({"ok": True})
            else:
                self.send_json({"ok": False, "error": "Invalid code"}, 401)
        
        elif parsed.path == '/api/send':
            # Send message to Telegram
            message = data.get('message', '').strip()
            if not message:
                self.send_json({"ok": False, "error": "Empty message"}, 400)
                return
            
            # Add to local conversation
            conversation["messages"].append({
                "role": "user",
                "content": message,
                "time": time.strftime("%H:%M")
            })
            
            # Send to Telegram Bot
            result = self.send_telegram(message)
            if result:
                self.send_json({"ok": True, "sent": True})
            else:
                self.send_json({"ok": False, "error": "Failed to send"}, 500)
        
        else:
            self.send_json({"ok": False, "error": "Unknown endpoint"}, 404)
    
    def send_telegram(self, message):
        """Send message to Telegram Bot"""
        url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
        payload = json.dumps({
            "chat_id": CHAT_ID,
            "text": f"[DevConsole] {message}"
        }).encode('utf-8')
        
        req = urllib.request.Request(url, data=payload, headers={
            'Content-Type': 'application/json'
        })
        
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                return json.loads(resp.read().decode('utf-8'))
        except Exception as e:
            print(f"Telegram send error: {e}")
            return None
    
    def poll_updates(self):
        """Poll Telegram for new messages"""
        url = f"https://api.telegram.org/bot{BOT_TOKEN}/getUpdates"
        params = f"?offset={conversation['last_update_id'] + 1}&timeout=30&allowed_updates=[\"message\"]"
        
        try:
            with urllib.request.urlopen(url + params, timeout=35) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                
                new_messages = []
                if data.get('ok') and data.get('result'):
                    for update in data['result']:
                        conversation['last_update_id'] = update['update_id']
                        
                        msg = update.get('message', {})
                        # Only get bot replies (from the bot to the user)
                        if msg.get('from', {}).get('is_bot'):
                            text = msg.get('text', '')
                            new_messages.append({
                                "role": "assistant",
                                "content": text,
                                "time": time.strftime("%H:%M")
                            })
                            conversation["messages"].append(new_messages[-1])
                
                self.send_json({"ok": True, "messages": new_messages})
        except Exception as e:
            self.send_json({"ok": False, "error": str(e)}, 500)
    
    def send_json(self, data, status=200):
        """Send JSON response"""
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))
    
    def log_message(self, format, *args):
        """Suppress default logging"""
        pass


def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    server = HTTPServer(('0.0.0.0', PORT), WujiHandler)
    print(f"🚀 Wuji DevConsole server running on port {PORT}")
    server.serve_forever()


if __name__ == '__main__':
    main()
