"""
Rate Limiter Pattern - 萃取自 conversation 專案
Source: ~/Documents/conversation/rate_limiter.py
Extracted: 2025-02-04

這是一個設計參考，不是可直接執行的代碼。
實際使用時需要 Redis 連接和 Flask 環境。
"""

from functools import wraps
from typing import Optional, Callable
import time

# ============================================================
# 設計模式：滑動窗口限流
# ============================================================

class RateLimitConfig:
    """限流配置"""
    
    # 預設限制
    DEFAULT_REQUESTS = 60
    DEFAULT_WINDOW = 60  # 秒
    
    # 不同端點的限制
    ENDPOINTS = {
        "default": {"requests": 60, "window": 60},
        "webhook": {"requests": 100, "window": 60},
        "broadcast": {"requests": 10, "window": 3600},
        "search": {"requests": 30, "window": 60},
        "ai_generate": {"requests": 20, "window": 60},
    }


def rate_limit(
    key_prefix: str = "default",
    requests: Optional[int] = None,
    window: Optional[int] = None,
    key_func: Optional[Callable] = None
):
    """
    Rate limit decorator
    
    用法:
        @rate_limit(key_prefix="search", requests=30, window=60)
        def search_endpoint():
            ...
    
    Args:
        key_prefix: Redis key 前綴
        requests: 允許的請求數
        window: 時間窗口（秒）
        key_func: 自定義 key 生成函數（如按用戶限流）
    """
    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            # 1. 獲取限流配置
            config = RateLimitConfig.ENDPOINTS.get(
                key_prefix, 
                RateLimitConfig.ENDPOINTS["default"]
            )
            max_requests = requests or config["requests"]
            time_window = window or config["window"]
            
            # 2. 生成 Redis key
            if key_func:
                identifier = key_func(*args, **kwargs)
            else:
                # 預設用 IP
                from flask import request
                identifier = request.remote_addr
            
            redis_key = f"ratelimit:{key_prefix}:{identifier}"
            
            # 3. 滑動窗口計數
            # 實際實現需要 Redis，這裡是偽代碼
            """
            current_time = int(time.time())
            window_start = current_time - time_window
            
            # 使用 Redis ZSET 實現滑動窗口
            redis.zremrangebyscore(redis_key, 0, window_start)
            current_count = redis.zcard(redis_key)
            
            if current_count >= max_requests:
                # 超過限制
                return {
                    "error": "rate_limit_exceeded",
                    "retry_after": time_window
                }, 429
            
            # 記錄本次請求
            redis.zadd(redis_key, {str(current_time): current_time})
            redis.expire(redis_key, time_window)
            """
            
            # 4. 執行原函數
            return f(*args, **kwargs)
        
        return wrapped
    return decorator


def add_rate_limit_headers(response):
    """
    添加限流相關的 HTTP headers
    
    用法：
        app.after_request(add_rate_limit_headers)
    
    Headers:
        X-RateLimit-Limit: 允許的請求數
        X-RateLimit-Remaining: 剩餘請求數
        X-RateLimit-Reset: 重置時間（Unix timestamp）
    """
    # 從 request context 獲取限流信息
    # 實際實現需要在 rate_limit decorator 中設置
    """
    from flask import g
    if hasattr(g, 'rate_limit_info'):
        info = g.rate_limit_info
        response.headers['X-RateLimit-Limit'] = info['limit']
        response.headers['X-RateLimit-Remaining'] = info['remaining']
        response.headers['X-RateLimit-Reset'] = info['reset']
    """
    return response


# ============================================================
# 按用戶限流的 key 函數示例
# ============================================================

def user_key_func(*args, **kwargs):
    """按用戶 ID 限流（用於 LINE Bot）"""
    from flask import request
    
    # 嘗試從 request body 提取用戶 ID
    try:
        data = request.get_json()
        events = data.get('events', [])
        if events:
            return events[0].get('source', {}).get('userId', 'anonymous')
    except:
        pass
    
    # fallback 到 IP
    return request.remote_addr


def group_key_func(*args, **kwargs):
    """按群組限流"""
    from flask import request
    
    try:
        data = request.get_json()
        events = data.get('events', [])
        if events:
            source = events[0].get('source', {})
            return source.get('groupId') or source.get('roomId') or source.get('userId', 'anonymous')
    except:
        pass
    
    return request.remote_addr


# ============================================================
# 使用示例
# ============================================================
"""
from flask import Flask
app = Flask(__name__)

# 全局添加 headers
app.after_request(add_rate_limit_headers)

# 預設限流
@app.route("/webhook")
@rate_limit(key_prefix="webhook")
def webhook():
    return "OK"

# 自定義限流
@app.route("/search")
@rate_limit(key_prefix="search", requests=30, window=60, key_func=user_key_func)
def search():
    return "Results"

# AI 生成端點（更嚴格）
@app.route("/generate")
@rate_limit(key_prefix="ai_generate", requests=10, window=60)
def generate():
    return "Generated"
"""
