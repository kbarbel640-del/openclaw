import ctypes
import ctypes.wintypes as w
import time

user32 = ctypes.windll.user32
HWND = 918668

WM_SYSKEYDOWN = 0x0104
WM_SYSKEYUP = 0x0105
WM_KEYDOWN = 0x0100
WM_KEYUP = 0x0101

VK_CONTROL = 0x11
VK_MENU = 0x12  # Alt
VK_D = 0x44

# Send Ctrl+Alt+D
ctrl_scan = user32.MapVirtualKeyW(VK_CONTROL, 0)
alt_scan = user32.MapVirtualKeyW(VK_MENU, 0)
d_scan = user32.MapVirtualKeyW(VK_D, 0)

# Ctrl down
user32.PostMessageW(HWND, WM_KEYDOWN, VK_CONTROL, (ctrl_scan << 16) | 1)
time.sleep(0.05)
# Alt down  
user32.PostMessageW(HWND, WM_SYSKEYDOWN, VK_MENU, (alt_scan << 16) | 1 | (1 << 29))
time.sleep(0.05)
# D down
user32.PostMessageW(HWND, WM_SYSKEYDOWN, VK_D, (d_scan << 16) | 1 | (1 << 29))
time.sleep(0.1)
# D up
user32.PostMessageW(HWND, WM_SYSKEYUP, VK_D, (d_scan << 16) | 1 | (1 << 29) | (1 << 30) | (1 << 31))
time.sleep(0.05)
# Alt up
user32.PostMessageW(HWND, WM_KEYUP, VK_MENU, (alt_scan << 16) | 1 | (1 << 30) | (1 << 31))
time.sleep(0.05)
# Ctrl up
user32.PostMessageW(HWND, WM_KEYUP, VK_CONTROL, (ctrl_scan << 16) | 1 | (1 << 30) | (1 << 31))
time.sleep(0.5)
print("Sent Ctrl+Alt+D")
