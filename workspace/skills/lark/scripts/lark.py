#!/usr/bin/env python3
"""
Lark/飛書 Open API 工具
"""

import os
import sys
import json
import argparse
from pathlib import Path
from datetime import datetime, timedelta

import httpx

# 配置
SKILL_DIR = Path(__file__).parent.parent
CONFIG_PATH = SKILL_DIR / "config.json"
TOKEN_CACHE = SKILL_DIR / ".token_cache.json"

# API 端點
LARK_HOST = "https://open.larksuite.com"
FEISHU_HOST = "https://open.feishu.cn"

# 預設使用 Lark（國際版），如需飛書改為 FEISHU_HOST
API_HOST = LARK_HOST


def load_config():
    """載入配置"""
    if CONFIG_PATH.exists():
        with open(CONFIG_PATH) as f:
            return json.load(f)
    # 預設配置
    return {
        "app_id": "cli_a9e51894d0f89e1a",
        "app_secret": "JoRw4k3LKW4Waey7bdkyfgehf3zUh334"
    }


def save_token_cache(token: str, expires_at: datetime):
    """緩存 Token"""
    with open(TOKEN_CACHE, "w") as f:
        json.dump({
            "token": token,
            "expires_at": expires_at.isoformat()
        }, f)


def load_token_cache() -> tuple[str, datetime] | None:
    """載入緩存 Token"""
    if not TOKEN_CACHE.exists():
        return None
    try:
        with open(TOKEN_CACHE) as f:
            data = json.load(f)
            expires_at = datetime.fromisoformat(data["expires_at"])
            if datetime.now() < expires_at - timedelta(minutes=5):
                return data["token"], expires_at
    except:
        pass
    return None


def get_tenant_token(config: dict = None) -> str:
    """取得 Tenant Access Token"""
    
    # 檢查緩存
    cached = load_token_cache()
    if cached:
        return cached[0]
    
    if config is None:
        config = load_config()
    
    url = f"{API_HOST}/open-apis/auth/v3/tenant_access_token/internal"
    
    resp = httpx.post(url, json={
        "app_id": config["app_id"],
        "app_secret": config["app_secret"]
    })
    resp.raise_for_status()
    data = resp.json()
    
    if data.get("code") != 0:
        raise Exception(f"Token 取得失敗: {data.get('msg')}")
    
    token = data["tenant_access_token"]
    expires_in = data.get("expire", 7200)
    expires_at = datetime.now() + timedelta(seconds=expires_in)
    
    save_token_cache(token, expires_at)
    return token


def api_request(method: str, path: str, data: dict = None, params: dict = None) -> dict:
    """發送 API 請求"""
    token = get_tenant_token()

    url = f"{API_HOST}/open-apis{path}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    if method.upper() == "GET":
        resp = httpx.get(url, headers=headers, params=params)
    elif method.upper() == "POST":
        resp = httpx.post(url, headers=headers, json=data)
    elif method.upper() == "PUT":
        resp = httpx.put(url, headers=headers, json=data)
    elif method.upper() == "DELETE":
        resp = httpx.delete(url, headers=headers)
    else:
        raise ValueError(f"不支援的方法: {method}")

    # 不要 raise，直接返回 JSON 讓調用者處理錯誤
    return resp.json()


# ============== 文檔 API ==============

def list_spaces(page_size: int = 20):
    """列出知識空間"""
    result = api_request("GET", "/wiki/v2/spaces", params={"page_size": page_size})
    return result


def list_docs(space_id: str, page_size: int = 20):
    """列出空間中的文檔"""
    result = api_request("GET", f"/wiki/v2/spaces/{space_id}/nodes", 
                        params={"page_size": page_size})
    return result


def get_doc(doc_id: str):
    """讀取文檔內容"""
    result = api_request("GET", f"/docx/v1/documents/{doc_id}")
    return result


def get_doc_blocks(doc_id: str):
    """讀取文檔區塊"""
    result = api_request("GET", f"/docx/v1/documents/{doc_id}/blocks")
    return result


# ============== 多維表格 API ==============

def list_bitable_tables(app_token: str):
    """列出多維表格的表"""
    result = api_request("GET", f"/bitable/v1/apps/{app_token}/tables")
    return result


def list_bitable_records(app_token: str, table_id: str, page_size: int = 100):
    """列出多維表格記錄"""
    result = api_request("GET", f"/bitable/v1/apps/{app_token}/tables/{table_id}/records",
                        params={"page_size": page_size})
    return result


def create_bitable_record(app_token: str, table_id: str, fields: dict):
    """創建多維表格記錄"""
    result = api_request("POST", f"/bitable/v1/apps/{app_token}/tables/{table_id}/records",
                        data={"fields": fields})
    return result


def update_bitable_record(app_token: str, table_id: str, record_id: str, fields: dict):
    """更新多維表格記錄"""
    result = api_request("PUT", 
                        f"/bitable/v1/apps/{app_token}/tables/{table_id}/records/{record_id}",
                        data={"fields": fields})
    return result


# ============== 日曆 API ==============

def list_calendars():
    """列出日曆"""
    result = api_request("GET", "/calendar/v4/calendars")
    return result


def list_calendar_events(calendar_id: str, start_time: str = None, end_time: str = None):
    """列出日曆事件"""
    params = {}
    if start_time:
        params["start_time"] = start_time
    if end_time:
        params["end_time"] = end_time
    result = api_request("GET", f"/calendar/v4/calendars/{calendar_id}/events", params=params)
    return result


# ============== 消息 API ==============

def send_message(receive_id: str, msg_type: str, content: dict, receive_id_type: str = "open_id"):
    """發送消息"""
    result = api_request("POST", "/im/v1/messages",
                        params={"receive_id_type": receive_id_type},
                        data={
                            "receive_id": receive_id,
                            "msg_type": msg_type,
                            "content": json.dumps(content)
                        })
    return result


# ============== CLI ==============

def cmd_token(args):
    """取得並顯示 Token"""
    token = get_tenant_token()
    print(f"Token: {token[:20]}...{token[-10:]}")
    print(f"完整: {token}")


def cmd_spaces(args):
    """列出空間"""
    result = list_spaces()
    if result.get("code") != 0:
        print(f"錯誤 (code={result.get('code')}): {result.get('msg')}")
        if "error" in result:
            err = result["error"]
            if "permission_violations" in err:
                print("\n需要的權限:")
                for pv in err["permission_violations"]:
                    print(f"  • {pv.get('subject')}")
            if "helps" in err:
                for h in err["helps"]:
                    print(f"\n參考: {h.get('url')}")
        return

    spaces = result.get("data", {}).get("items", [])
    print(f"共 {len(spaces)} 個空間:\n")
    for space in spaces:
        print(f"  • {space.get('name')} (ID: {space.get('space_id')})")


def cmd_docs(args):
    """列出文檔"""
    if not args.space:
        print("錯誤: 需要 --space 參數")
        return
    
    result = list_docs(args.space)
    if result.get("code") != 0:
        print(f"錯誤: {result.get('msg')}")
        return
    
    nodes = result.get("data", {}).get("items", [])
    print(f"共 {len(nodes)} 個節點:\n")
    for node in nodes:
        print(f"  • {node.get('title')} ({node.get('obj_type')}) ID: {node.get('node_token')}")


def cmd_read(args):
    """讀取文檔"""
    if not args.doc_id:
        print("錯誤: 需要 doc_id")
        return
    
    result = get_doc(args.doc_id)
    print(json.dumps(result, ensure_ascii=False, indent=2))


def cmd_bitable(args):
    """多維表格操作"""
    if args.action == "tables":
        if not args.app_token:
            print("錯誤: 需要 app_token")
            return
        result = list_bitable_tables(args.app_token)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    
    elif args.action == "records":
        if not args.app_token or not args.table_id:
            print("錯誤: 需要 app_token 和 table_id")
            return
        result = list_bitable_records(args.app_token, args.table_id)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    
    elif args.action == "write":
        if not args.app_token or not args.table_id or not args.data:
            print("錯誤: 需要 app_token, table_id, --data")
            return
        fields = json.loads(args.data)
        result = create_bitable_record(args.app_token, args.table_id, fields)
        print(json.dumps(result, ensure_ascii=False, indent=2))


def main():
    parser = argparse.ArgumentParser(description="Lark/飛書 API 工具")
    subparsers = parser.add_subparsers(dest="command", help="命令")
    
    # token
    p_token = subparsers.add_parser("token", help="取得 Token")
    p_token.set_defaults(func=cmd_token)
    
    # spaces
    p_spaces = subparsers.add_parser("spaces", help="列出空間")
    p_spaces.set_defaults(func=cmd_spaces)
    
    # docs
    p_docs = subparsers.add_parser("docs", help="列出文檔")
    p_docs.add_argument("--space", required=True, help="空間 ID")
    p_docs.set_defaults(func=cmd_docs)
    
    # read
    p_read = subparsers.add_parser("read", help="讀取文檔")
    p_read.add_argument("doc_id", help="文檔 ID")
    p_read.set_defaults(func=cmd_read)
    
    # bitable
    p_bitable = subparsers.add_parser("bitable", help="多維表格操作")
    p_bitable.add_argument("action", choices=["tables", "records", "write"], help="操作")
    p_bitable.add_argument("app_token", nargs="?", help="App Token")
    p_bitable.add_argument("table_id", nargs="?", help="Table ID")
    p_bitable.add_argument("--data", help="JSON 數據")
    p_bitable.set_defaults(func=cmd_bitable)
    
    args = parser.parse_args()
    
    if hasattr(args, 'func'):
        args.func(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
