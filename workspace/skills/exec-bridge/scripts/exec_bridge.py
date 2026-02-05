#!/usr/bin/env python3
"""
Exec HTTP Bridge - 繞過 Node.js spawn EBADF 問題
透過 HTTP API 執行 shell 命令

Usage:
    python exec_bridge.py --port 18791

API:
    POST /exec
    Body: {"command": "ls -la", "timeout": 30, "cwd": "/tmp"}
    Response: {"stdout": "...", "stderr": "...", "code": 0, "ok": true}

    GET /health
    Response: {"status": "ok", "pid": 12345}
"""

import argparse
import json
import os
import subprocess
import signal
import sys
from http.server import HTTPServer, BaseHTTPRequestHandler
from http.server import ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs
import threading
import time
import queue
import uuid

DEFAULT_HOST = '127.0.0.1'
DEFAULT_PORT = 18791
DEFAULT_TIMEOUT = 60
MAX_TIMEOUT = 300
MAX_OUTPUT_SIZE = 1024 * 1024  # 1MB
JOB_TTL_SECONDS = 3600
MAX_JOB_RESULTS = 200

JOB_QUEUE = queue.Queue()
JOB_RESULTS = {}
JOB_LOCK = threading.Lock()
CURRENT_JOB = {"id": None}

def _now():
    return int(time.time())

def _store_result(job_id, payload):
    with JOB_LOCK:
        JOB_RESULTS[job_id] = payload
        # trim old results
        if len(JOB_RESULTS) > MAX_JOB_RESULTS:
            # drop oldest by finishedAt if present
            items = list(JOB_RESULTS.items())
            items.sort(key=lambda kv: kv[1].get("finishedAt", 0))
            for k, _ in items[: max(0, len(items) - MAX_JOB_RESULTS)]:
                JOB_RESULTS.pop(k, None)

def _get_result(job_id):
    with JOB_LOCK:
        return JOB_RESULTS.get(job_id)

def _cleanup_results():
    while True:
        time.sleep(60)
        cutoff = _now() - JOB_TTL_SECONDS
        with JOB_LOCK:
            for k in list(JOB_RESULTS.keys()):
                finished = JOB_RESULTS[k].get("finishedAt", 0)
                if finished and finished < cutoff:
                    JOB_RESULTS.pop(k, None)

def _run_command(command, timeout, cwd, shell, env):
    exec_env = os.environ.copy()
    if env and isinstance(env, dict):
        exec_env.update(env)
    result = subprocess.run(
        command if shell else command.split(),
        shell=shell,
        cwd=cwd,
        env=exec_env,
        capture_output=True,
        timeout=timeout,
        text=True
    )
    stdout = result.stdout
    stderr = result.stderr
    if len(stdout) > MAX_OUTPUT_SIZE:
        stdout = stdout[:MAX_OUTPUT_SIZE] + f"\n... (truncated, total {len(result.stdout)} bytes)"
    if len(stderr) > MAX_OUTPUT_SIZE:
        stderr = stderr[:MAX_OUTPUT_SIZE] + f"\n... (truncated, total {len(result.stderr)} bytes)"
    return {
        'ok': result.returncode == 0,
        'code': result.returncode,
        'stdout': stdout,
        'stderr': stderr,
        'command': command,
        'cwd': cwd,
        'timeout': timeout
    }

def _worker_loop():
    while True:
        job = JOB_QUEUE.get()
        if job is None:
            break
        job_id = job["id"]
        CURRENT_JOB["id"] = job_id
        start = _now()
        _store_result(job_id, {"status": "running", "startedAt": start})
        try:
            payload = _run_command(
                job["command"],
                job["timeout"],
                job["cwd"],
                job["shell"],
                job.get("env")
            )
            payload.update({
                "status": "done",
                "jobId": job_id,
                "startedAt": start,
                "finishedAt": _now()
            })
            _store_result(job_id, payload)
        except subprocess.TimeoutExpired:
            _store_result(job_id, {
                "status": "timeout",
                "ok": False,
                "code": -1,
                "error": f"Command timed out after {job['timeout']}s",
                "stdout": "",
                "stderr": "",
                "command": job["command"],
                "jobId": job_id,
                "startedAt": start,
                "finishedAt": _now()
            })
        except FileNotFoundError as e:
            _store_result(job_id, {
                "status": "error",
                "ok": False,
                "code": -1,
                "error": f"Command not found: {e}",
                "stdout": "",
                "stderr": str(e),
                "command": job["command"],
                "jobId": job_id,
                "startedAt": start,
                "finishedAt": _now()
            })
        except Exception as e:
            _store_result(job_id, {
                "status": "error",
                "ok": False,
                "code": -1,
                "error": str(e),
                "stdout": "",
                "stderr": str(e),
                "command": job["command"],
                "jobId": job_id,
                "startedAt": start,
                "finishedAt": _now()
            })
        finally:
            CURRENT_JOB["id"] = None
            JOB_QUEUE.task_done()

class ExecHandler(BaseHTTPRequestHandler):
    """處理 exec 請求"""

    def log_message(self, format, *args):
        """自訂 log 格式"""
        print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {args[0]}")

    def send_json(self, data: dict, status: int = 200):
        """發送 JSON 回應"""
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', len(body))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        """處理 GET 請求"""
        parsed = urlparse(self.path)

        if parsed.path == '/health':
            self.send_json({
                'status': 'ok',
                'pid': os.getpid(),
                'python': sys.version.split()[0],
                'queueDepth': JOB_QUEUE.qsize(),
                'runningJobId': CURRENT_JOB["id"]
            })
        elif parsed.path == '/':
            self.send_json({
                'service': 'exec-bridge',
                'version': '1.1.0',
                'endpoints': {
                    'POST /exec': 'Execute a command',
                    'POST /queue/submit': 'Queue a command',
                    'GET /queue/result?id=...': 'Fetch queued result',
                    'GET /queue/status': 'Queue status',
                    'GET /health': 'Health check'
                }
            })
        elif parsed.path == '/queue/status':
            self.send_json({
                'queueDepth': JOB_QUEUE.qsize(),
                'runningJobId': CURRENT_JOB["id"]
            })
        elif parsed.path == '/queue/result':
            qs = parse_qs(parsed.query or "")
            job_id = (qs.get("id") or [""])[0]
            if not job_id:
                self.send_json({'error': 'Missing id'}, 400)
                return
            res = _get_result(job_id)
            if not res:
                self.send_json({'error': 'Not found', 'jobId': job_id}, 404)
                return
            self.send_json(res)
        else:
            self.send_json({'error': 'Not found'}, 404)

    def do_POST(self):
        """處理 POST 請求"""
        parsed = urlparse(self.path)

        if parsed.path not in ['/exec', '/queue/submit']:
            self.send_json({'error': 'Not found'}, 404)
            return

        # 讀取 body
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length == 0:
            self.send_json({'error': 'Empty body'}, 400)
            return

        try:
            body = self.rfile.read(content_length)
            data = json.loads(body.decode('utf-8'))
        except json.JSONDecodeError as e:
            self.send_json({'error': f'Invalid JSON: {e}'}, 400)
            return

        # 解析參數
        command = data.get('command')
        if not command:
            self.send_json({'error': 'Missing "command" field'}, 400)
            return

        timeout = min(data.get('timeout', DEFAULT_TIMEOUT), MAX_TIMEOUT)
        cwd = data.get('cwd', os.environ.get('HOME', '/'))
        shell = data.get('shell', True)
        env = data.get('env')  # 額外環境變數
        mode = data.get('mode')
        queue_flag = data.get('queue', False) or mode == 'queue' or parsed.path == '/queue/submit'
        wait_seconds = int(data.get('wait', 0) or 0)

        if queue_flag:
            job_id = str(uuid.uuid4())
            _store_result(job_id, {"status": "queued", "queuedAt": _now()})
            JOB_QUEUE.put({
                "id": job_id,
                "command": command,
                "timeout": timeout,
                "cwd": cwd,
                "shell": shell,
                "env": env
            })

            if wait_seconds > 0:
                end = time.time() + wait_seconds
                while time.time() < end:
                    res = _get_result(job_id)
                    if res and res.get("status") in ["done", "error", "timeout"]:
                        self.send_json(res)
                        return
                    time.sleep(0.2)
            self.send_json({
                'ok': True,
                'queued': True,
                'jobId': job_id,
                'queueDepth': JOB_QUEUE.qsize()
            }, 202)
            return

        try:
            payload = _run_command(command, timeout, cwd, shell, env)
            self.send_json(payload)
        except subprocess.TimeoutExpired:
            self.send_json({
                'ok': False,
                'code': -1,
                'error': f'Command timed out after {timeout}s',
                'stdout': '',
                'stderr': '',
                'command': command
            }, 408)
        except FileNotFoundError as e:
            self.send_json({
                'ok': False,
                'code': -1,
                'error': f'Command not found: {e}',
                'stdout': '',
                'stderr': str(e),
                'command': command
            }, 400)
        except Exception as e:
            self.send_json({
                'ok': False,
                'code': -1,
                'error': str(e),
                'stdout': '',
                'stderr': str(e),
                'command': command
            }, 500)


def run_server(host: str, port: int):
    """啟動 HTTP server"""
    server = ThreadingHTTPServer((host, port), ExecHandler)
    print(f"[exec-bridge] Starting on http://{host}:{port}")
    print(f"[exec-bridge] PID: {os.getpid()}")
    print(f"[exec-bridge] Python: {sys.version.split()[0]}")
    print(f"[exec-bridge] Endpoints:")
    print(f"  POST /exec - Execute command")
    print(f"  POST /queue/submit - Queue command")
    print(f"  GET /queue/result?id=... - Get queued result")
    print(f"  GET /health - Health check")
    print()

    # 優雅關閉
    def shutdown(signum, frame):
        print(f"\n[exec-bridge] Shutting down...")
        server.shutdown()
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    try:
        t = threading.Thread(target=_worker_loop, daemon=True)
        t.start()
        c = threading.Thread(target=_cleanup_results, daemon=True)
        c.start()
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        print("[exec-bridge] Stopped")


def main():
    parser = argparse.ArgumentParser(description='Exec HTTP Bridge')
    parser.add_argument('--host', type=str, default=DEFAULT_HOST, help=f'Host (default: {DEFAULT_HOST})')
    parser.add_argument('--port', type=int, default=DEFAULT_PORT, help=f'Port (default: {DEFAULT_PORT})')
    args = parser.parse_args()

    run_server(args.host, args.port)


if __name__ == '__main__':
    main()
