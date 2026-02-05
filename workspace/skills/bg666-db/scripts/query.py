#!/Users/sulaxd/clawd/skills/bg666-db/.venv/bin/python3
"""
BG666 Database Query Tool
Usage: query.py [--json] "SQL QUERY"
"""

import sys
import json
import argparse

# Connection config (via ZeroTier)
DB_CONFIG = {
    'host': 'bg666-market-readonly.czsks2mguhd5.ap-south-1.rds.amazonaws.com',
    'port': 3306,
    'user': 'market',
    'password': 'hBVoVVm&)aZtW0t6',
    'database': 'ry-cloud',
    'connect_timeout': 10,
    'charset': 'utf8mb4'
}

def ensure_pymysql():
    """Ensure pymysql is available"""
    try:
        import pymysql
        return pymysql
    except ImportError:
        import subprocess
        # Try installing to user site-packages
        subprocess.run([sys.executable, '-m', 'pip', 'install', '--user', '-q', 'pymysql'], 
                      capture_output=True)
        import pymysql
        return pymysql

def query(sql: str, as_json: bool = False) -> str:
    """Execute SQL and return results"""
    pymysql = ensure_pymysql()
    
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
            # Get column names
            cols = [d[0] for d in cursor.description]
            # Format as table
            lines = ['\t'.join(cols)]
            for row in rows:
                lines.append('\t'.join(str(v) for v in row))
            return '\n'.join(lines)
    finally:
        conn.close()

def main():
    parser = argparse.ArgumentParser(description='Query BG666 database')
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
