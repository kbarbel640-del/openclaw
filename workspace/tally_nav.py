import ctypes
import ctypes.wintypes as w
import time
import sys

user32 = ctypes.windll.user32
HWND = 918668

WM_KEYDOWN = 0x0100
WM_KEYUP = 0x0101
WM_CHAR = 0x0102

VK_RETURN = 0x0D
VK_ESCAPE = 0x1B
VK_DOWN = 0x28
VK_UP = 0x26
VK_TAB = 0x09
VK_F2 = 0x71
VK_DELETE = 0x2E

def send_vk(vk, count=1):
    for _ in range(count):
        # lParam: repeat=1, scancode, extended flags
        scan = user32.MapVirtualKeyW(vk, 0)
        lparam_down = (scan << 16) | 1
        lparam_up = (scan << 16) | 1 | (1 << 30) | (1 << 31)
        user32.PostMessageW(HWND, WM_KEYDOWN, vk, lparam_down)
        time.sleep(0.05)
        user32.PostMessageW(HWND, WM_KEYUP, vk, lparam_up)
        time.sleep(0.15)

def send_char(c):
    user32.PostMessageW(HWND, WM_CHAR, ord(c), 0)
    time.sleep(0.1)

def send_string(s):
    for c in s:
        send_char(c)

action = sys.argv[1] if len(sys.argv) > 1 else "help"
arg2 = sys.argv[2] if len(sys.argv) > 2 else "1"

if action == "enter":
    send_vk(VK_RETURN, int(arg2))
    print(f"Enter x{arg2}")
elif action == "escape":
    send_vk(VK_ESCAPE, int(arg2))
    print(f"Escape x{arg2}")
elif action == "down":
    send_vk(VK_DOWN, int(arg2))
    print(f"Down x{arg2}")
elif action == "up":
    send_vk(VK_UP, int(arg2))
    print(f"Up x{arg2}")
elif action == "tab":
    send_vk(VK_TAB, int(arg2))
    print(f"Tab x{arg2}")
elif action == "f2":
    send_vk(VK_F2)
    print("F2")
elif action == "delete":
    send_vk(VK_DELETE)
    print("Delete")
elif action == "type":
    send_string(arg2)
    print(f"Typed: {arg2}")
elif action == "altd":
    # Alt+D: send WM_SYSKEYDOWN for Alt, then D
    WM_SYSKEYDOWN = 0x0104
    WM_SYSKEYUP = 0x0105
    alt_scan = user32.MapVirtualKeyW(0x12, 0)  # VK_MENU
    d_scan = user32.MapVirtualKeyW(0x44, 0)  # VK_D
    # Alt down
    user32.PostMessageW(HWND, WM_SYSKEYDOWN, 0x12, (alt_scan << 16) | 1 | (1 << 29))
    time.sleep(0.1)
    # D down with alt flag
    user32.PostMessageW(HWND, WM_SYSKEYDOWN, 0x44, (d_scan << 16) | 1 | (1 << 29))
    time.sleep(0.1)
    # D up
    user32.PostMessageW(HWND, WM_SYSKEYUP, 0x44, (d_scan << 16) | 1 | (1 << 29) | (1 << 30) | (1 << 31))
    time.sleep(0.05)
    # Alt up
    user32.PostMessageW(HWND, WM_KEYUP, 0x12, (alt_scan << 16) | 1 | (1 << 30) | (1 << 31))
    time.sleep(0.3)
    print("Sent Alt+D")
elif action == "char":
    send_char(arg2)
    print(f"Char: {arg2}")
else:
    print("Usage: tally_nav.py [enter|escape|down|up|tab|type|altd|f2|delete|char] [count/text]")
