"""
Tally GUI Test Framework
Sends keys via PostMessage and captures screenshots to see the result.
Usage: python tally_test_gui.py <action> [args...]

Actions:
  char <c>       - Send WM_CHAR
  key <vk_hex>   - Send WM_KEYDOWN+KEYUP 
  syskey <vk_hex> - Send WM_SYSKEYDOWN+SYSKEYUP (for Alt combos)
  fkey <n>       - Send F-key (F1-F12)
  escape [n]     - Send Escape n times
  enter [n]      - Send Enter
  down [n]       - Send Down arrow
  up [n]         - Send Up arrow
  left [n]       - Send Left arrow
  right [n]      - Send Right arrow
  pgup           - Page Up
  pgdn           - Page Down
  home           - Home
  end            - End
  tab [n]        - Tab
  space          - Space
  backspace      - Backspace
  delete         - Delete key
  type <text>    - Send string as WM_CHAR sequence
  snap           - Just capture screenshot (no keys)
  context        - Send WM_CONTEXTMENU
  children       - List child windows
"""

import ctypes
import ctypes.wintypes as w
import time
import sys
import struct

user32 = ctypes.windll.user32
gdi32 = ctypes.windll.gdi32

# Find Tally HWND dynamically
def find_tally():
    result = []
    def callback(hwnd, _):
        if user32.IsWindowVisible(hwnd):
            length = user32.GetWindowTextLengthW(hwnd)
            if length > 0:
                buf = ctypes.create_unicode_buffer(length + 1)
                user32.GetWindowTextW(hwnd, buf, length + 1)
                if 'tally' in buf.value.lower():
                    result.append((hwnd, buf.value))
        return True
    WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, w.HWND, w.LPARAM)
    user32.EnumWindows(WNDENUMPROC(callback), 0)
    return result

windows = find_tally()
if not windows:
    print("ERROR: Tally window not found!")
    sys.exit(1)
HWND = windows[0][0]
print(f"Tally HWND: {HWND} ({windows[0][1]})")

# Message constants
WM_KEYDOWN = 0x0100
WM_KEYUP = 0x0101
WM_CHAR = 0x0102
WM_SYSKEYDOWN = 0x0104
WM_SYSKEYUP = 0x0105
WM_CONTEXTMENU = 0x007B
WM_COMMAND = 0x0111

# VK codes
VK = {
    'RETURN': 0x0D, 'ESCAPE': 0x1B, 'TAB': 0x09, 'SPACE': 0x20,
    'BACK': 0x08, 'DELETE': 0x2E,
    'UP': 0x26, 'DOWN': 0x28, 'LEFT': 0x25, 'RIGHT': 0x27,
    'PGUP': 0x21, 'PGDN': 0x22, 'HOME': 0x24, 'END': 0x23,
    'F1': 0x70, 'F2': 0x71, 'F3': 0x72, 'F4': 0x73, 'F5': 0x74,
    'F6': 0x75, 'F7': 0x76, 'F8': 0x77, 'F9': 0x78, 'F10': 0x79,
    'F11': 0x7A, 'F12': 0x7B,
    'CTRL': 0x11, 'ALT': 0x12, 'SHIFT': 0x10,
}

def send_vk(vk, count=1):
    for _ in range(count):
        scan = user32.MapVirtualKeyW(vk, 0)
        lparam_down = (scan << 16) | 1
        lparam_up = (scan << 16) | 1 | (1 << 30) | (1 << 31)
        user32.PostMessageW(HWND, WM_KEYDOWN, vk, lparam_down)
        time.sleep(0.05)
        user32.PostMessageW(HWND, WM_KEYUP, vk, lparam_up)
        time.sleep(0.15)

def send_syskey(vk):
    scan = user32.MapVirtualKeyW(vk, 0)
    lparam_down = (scan << 16) | 1 | (1 << 29)  # ALT flag
    lparam_up = (scan << 16) | 1 | (1 << 29) | (1 << 30) | (1 << 31)
    user32.PostMessageW(HWND, WM_SYSKEYDOWN, vk, lparam_down)
    time.sleep(0.05)
    user32.PostMessageW(HWND, WM_SYSKEYUP, vk, lparam_up)
    time.sleep(0.15)

def send_char(c):
    user32.PostMessageW(HWND, WM_CHAR, ord(c), 0)
    time.sleep(0.1)

def capture(filename='tally_win.png'):
    rect = w.RECT()
    user32.GetWindowRect(HWND, ctypes.byref(rect))
    width = rect.right - rect.left
    height = rect.bottom - rect.top
    hdc_window = user32.GetWindowDC(HWND)
    hdc_mem = gdi32.CreateCompatibleDC(hdc_window)
    hbmp = gdi32.CreateCompatibleBitmap(hdc_window, width, height)
    old = gdi32.SelectObject(hdc_mem, hbmp)
    user32.PrintWindow(HWND, hdc_mem, 2)
    
    class BITMAPINFOHEADER(ctypes.Structure):
        _fields_ = [('biSize', w.DWORD), ('biWidth', w.LONG), ('biHeight', w.LONG),
                     ('biPlanes', w.WORD), ('biBitCount', w.WORD), ('biCompression', w.DWORD),
                     ('biSizeImage', w.DWORD), ('biXPelsPerMeter', w.LONG), ('biYPelsPerMeter', w.LONG),
                     ('biClrUsed', w.DWORD), ('biClrImportant', w.DWORD)]
    bmi = BITMAPINFOHEADER()
    bmi.biSize = ctypes.sizeof(BITMAPINFOHEADER)
    bmi.biWidth = width; bmi.biHeight = -height; bmi.biPlanes = 1; bmi.biBitCount = 24; bmi.biCompression = 0
    row_size = ((width * 3 + 3) // 4) * 4
    bmi.biSizeImage = row_size * height
    pixels = ctypes.create_string_buffer(bmi.biSizeImage)
    gdi32.GetDIBits(hdc_mem, hbmp, 0, height, pixels, ctypes.byref(bmi), 0)
    
    bmp_path = f'D:\\openclaw\\workspace\\{filename.replace(".png", ".bmp")}'
    png_path = f'D:\\openclaw\\workspace\\{filename}'
    with open(bmp_path, 'wb') as f:
        f.write(b'BM'); f.write(struct.pack('<I', 54 + bmi.biSizeImage))
        f.write(b'\x00\x00\x00\x00'); f.write(struct.pack('<I', 54))
        f.write(bytes(bmi)); f.write(pixels.raw)
    
    gdi32.SelectObject(hdc_mem, old); gdi32.DeleteObject(hbmp)
    gdi32.DeleteDC(hdc_mem); user32.ReleaseDC(HWND, hdc_window)
    
    from PIL import Image
    Image.open(bmp_path).save(png_path)
    return png_path

def list_children():
    children = []
    def callback(hwnd, _):
        cls = ctypes.create_unicode_buffer(256)
        user32.GetClassNameW(hwnd, cls, 256)
        title_len = user32.GetWindowTextLengthW(hwnd)
        title = ""
        if title_len:
            buf = ctypes.create_unicode_buffer(title_len + 1)
            user32.GetWindowTextW(hwnd, buf, title_len + 1)
            title = buf.value
        rect = w.RECT()
        user32.GetWindowRect(hwnd, ctypes.byref(rect))
        visible = user32.IsWindowVisible(hwnd)
        children.append((hwnd, cls.value, title, visible, 
                         rect.left, rect.top, rect.right-rect.left, rect.bottom-rect.top))
        return True
    WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, w.HWND, w.LPARAM)
    user32.EnumChildWindows(HWND, WNDENUMPROC(callback), 0)
    return children

# Process action
action = sys.argv[1] if len(sys.argv) > 1 else "snap"
arg = sys.argv[2] if len(sys.argv) > 2 else "1"

if action == "char":
    send_char(arg)
    print(f"WM_CHAR: '{arg}'")
elif action == "key":
    vk = int(arg, 16)
    send_vk(vk)
    print(f"WM_KEYDOWN/UP: 0x{vk:02X}")
elif action == "syskey":
    vk = int(arg, 16)
    send_syskey(vk)
    print(f"WM_SYSKEYDOWN/UP: 0x{vk:02X}")
elif action == "fkey":
    n = int(arg)
    fvk = VK[f'F{n}']
    send_vk(fvk)
    print(f"F{n} (VK=0x{fvk:02X})")
elif action in VK:
    send_vk(VK[action.upper()], int(arg))
    print(f"{action} x{arg}")
elif action in ('escape', 'enter', 'down', 'up', 'left', 'right', 'tab',
                'pgup', 'pgdn', 'home', 'end', 'space', 'backspace', 'delete'):
    key_map = {'escape': 'ESCAPE', 'enter': 'RETURN', 'down': 'DOWN', 'up': 'UP',
               'left': 'LEFT', 'right': 'RIGHT', 'tab': 'TAB', 'space': 'SPACE',
               'backspace': 'BACK', 'delete': 'DELETE', 'pgup': 'PGUP', 'pgdn': 'PGDN',
               'home': 'HOME', 'end': 'END'}
    send_vk(VK[key_map[action]], int(arg))
    print(f"{action} x{arg}")
elif action == "type":
    for c in arg:
        send_char(c)
    print(f"Typed: {arg}")
elif action == "context":
    user32.PostMessageW(HWND, WM_CONTEXTMENU, HWND, 0)
    print("WM_CONTEXTMENU sent")
elif action == "children":
    kids = list_children()
    if kids:
        for hwnd, cls, title, vis, x, y, w2, h in kids:
            print(f"  HWND={hwnd} class='{cls}' title='{title}' vis={vis} pos=({x},{y}) size={w2}x{h}")
    else:
        print("No child windows found")
elif action == "snap":
    pass  # just capture below
else:
    print(f"Unknown action: {action}")
    sys.exit(1)

time.sleep(0.3)
path = capture()
print(f"Screenshot: {path}")
