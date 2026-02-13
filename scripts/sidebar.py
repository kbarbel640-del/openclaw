import webview
import sys
import os
import threading
import time
import http.client


def wait_for_server(url, timeout=30):
    host = "127.0.0.1"
    port = 18789
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            # We use a simple socket connection check first
            import socket

            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(1)
            result = sock.connect_ex((host, port))
            if result == 0:
                sock.close()
                return True
            sock.close()
        except:
            pass
        time.sleep(1)
    return False


def start_sidebar():
    # 侧边栏配置
    url = "http://127.0.0.1:18789/"

    print(f"Waiting for OpenClaw Gateway at {url}...")
    if not wait_for_server(url):
        print("Error: Gateway timed out. Sidebar might not load.")

    # 创建窗口
    window = webview.create_window(
        "OpenClaw Sidebar",
        url,
        width=380,
        height=900,
        x=1540,
        y=50,
        on_top=True,
        frameless=True,
        transparent=True,
    )

    webview.start(gui="mshtml" if sys.platform == "win32" else "gtk")


if __name__ == "__main__":
    start_sidebar()
