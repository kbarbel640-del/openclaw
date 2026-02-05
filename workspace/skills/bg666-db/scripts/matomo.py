#!/Users/sulaxd/clawd/skills/bg666-db/.venv/bin/python3
"""
Matomo Database Query Tool (via SSH tunnel)
Usage: matomo.py [--json] "SQL QUERY"
"""

import sys
import json
import argparse
import subprocess
import time
import socket
import os
import signal

# SSH config
SSH_KEY = os.path.expanduser('~/.ssh/matomo.pem')
SSH_HOST = 'ubuntu@13.205.188.209'
LOCAL_PORT = 13306

# DB config (internal IP, accessed via tunnel)
DB_CONFIG = {
    'host': '127.0.0.1',
    'port': LOCAL_PORT,
    'user': 'matomo',
    'password': 'Matomo@BG666!2026',
    'database': 'matomo',
    'connect_timeout': 10,
    'charset': 'utf8mb4'
}

def is_port_open(port):
    """Check if local port is open"""
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    result = sock.connect_ex(('127.0.0.1', port))
    sock.close()
    return result == 0

def start_tunnel():
    """Start SSH tunnel if not already running"""
    if is_port_open(LOCAL_PORT):
        return None  # Tunnel already exists
    
    # Start tunnel in background
    cmd = [
        'ssh', '-i', SSH_KEY,
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'ConnectTimeout=5',
        '-L', f'{LOCAL_PORT}:10.188.4.51:3306',
        '-N', '-f',
        SSH_HOST
    ]
    subprocess.run(cmd, capture_output=True)
    
    # Wait for tunnel to be ready
    for _ in range(10):
        if is_port_open(LOCAL_PORT):
            return True
        time.sleep(0.5)
    
    raise Exception("Failed to establish SSH tunnel")

def query(sql: str, as_json: bool = False) -> str:
    """Execute SQL and return results"""
    import pymysql
    
    start_tunnel()
    
    conn = pymysql.connect(**DB_CONFIG)
    try:
        cursor = conn.cursor(pymysql.cursors.DictCursor if as_json else None)
        cursor.execute(sql)
        rows = cursor.fetchall()
        
        if as_json:
            return json.dumps(rows, ensure_ascii=False, default=str, indent=2)
        else:
            if not rows:
                return "(empty result)"
            cols = [d[0] for d in cursor.description]
            lines = ['\t'.join(cols)]
            for row in rows:
                lines.append('\t'.join(str(v) for v in row))
            return '\n'.join(lines)
    finally:
        conn.close()

def main():
    parser = argparse.ArgumentParser(description='Query Matomo database via SSH tunnel')
    parser.add_argument('sql', help='SQL query to execute')
    parser.add_argument('--json', action='store_true', help='Output as JSON')
    args = parser.parse_args()
    
    try:
        result = query(args.sql, args.json)
        print(result)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
