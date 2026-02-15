"""Test Ctrl+key combos via PostMessage trick.
Ctrl+D sends WM_CHAR with code 0x04 (Ctrl+D = ASCII 4).
This is how Windows normally translates Ctrl+key presses."""
import ctypes
import ctypes.wintypes as w
import time
import sys

user32 = ctypes.windll.user32

windows = []
def callback(hwnd, _):
    if user32.IsWindowVisible(hwnd):
        length = user32.GetWindowTextLengthW(hwnd)
        if length > 0:
            buf = ctypes.create_unicode_buffer(length + 1)
            user32.GetWindowTextW(hwnd, buf, length + 1)
            if 'tally' in buf.value.lower():
                windows.append(hwnd)
    return True
WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, w.HWND, w.LPARAM)
user32.EnumWindows(WNDENUMPROC(callback), 0)
HWND = windows[0]

WM_CHAR = 0x0102
WM_KEYDOWN = 0x0100
WM_KEYUP = 0x0101

action = sys.argv[1] if len(sys.argv) > 1 else "test"

if action == "ctrl_char":
    # Ctrl+D = WM_CHAR with wParam = 0x04 (chr(4))
    # Ctrl+A = 0x01, Ctrl+B = 0x02, etc.
    letter = sys.argv[2].upper()
    ctrl_code = ord(letter) - ord('A') + 1  # Ctrl+A=1, Ctrl+D=4, etc.
    user32.PostMessageW(HWND, WM_CHAR, ctrl_code, 0)
    print(f"WM_CHAR Ctrl+{letter} = chr({ctrl_code})")

elif action == "ctrl_key":
    # Send WM_KEYDOWN for Ctrl, then WM_KEYDOWN for key, then release both
    letter = sys.argv[2].upper()
    vk_letter = ord(letter)
    vk_ctrl = 0x11
    
    scan_ctrl = user32.MapVirtualKeyW(vk_ctrl, 0)
    scan_letter = user32.MapVirtualKeyW(vk_letter, 0)
    
    # Ctrl down
    user32.PostMessageW(HWND, WM_KEYDOWN, vk_ctrl, (scan_ctrl << 16) | 1)
    time.sleep(0.05)
    # Letter down (with repeat bit for ctrl context)
    user32.PostMessageW(HWND, WM_KEYDOWN, vk_letter, (scan_letter << 16) | 1)
    time.sleep(0.05)
    # Also send the WM_CHAR ctrl code
    ctrl_code = ord(letter) - ord('A') + 1
    user32.PostMessageW(HWND, WM_CHAR, ctrl_code, (scan_letter << 16) | 1)
    time.sleep(0.05)
    # Letter up
    user32.PostMessageW(HWND, WM_KEYUP, vk_letter, (scan_letter << 16) | 1 | (1 << 30) | (1 << 31))
    time.sleep(0.05)
    # Ctrl up
    user32.PostMessageW(HWND, WM_KEYUP, vk_ctrl, (scan_ctrl << 16) | 1 | (1 << 30) | (1 << 31))
    print(f"Full Ctrl+{letter} sequence (KEYDOWN+CHAR+KEYUP)")

elif action == "alt_key":
    # Send WM_SYSKEYDOWN for key with Alt flag
    letter = sys.argv[2].upper()
    vk_letter = ord(letter)
    scan = user32.MapVirtualKeyW(vk_letter, 0)
    
    # Alt down
    user32.PostMessageW(HWND, 0x0104, 0x12, (user32.MapVirtualKeyW(0x12, 0) << 16) | 1 | (1 << 29))
    time.sleep(0.05)
    # Key down with alt flag
    user32.PostMessageW(HWND, 0x0104, vk_letter, (scan << 16) | 1 | (1 << 29))
    time.sleep(0.05)
    # WM_SYSCHAR
    user32.PostMessageW(HWND, 0x0106, ord(letter), (scan << 16) | 1 | (1 << 29))
    time.sleep(0.05)
    # Key up
    user32.PostMessageW(HWND, 0x0105, vk_letter, (scan << 16) | 1 | (1 << 29) | (1 << 30) | (1 << 31))
    time.sleep(0.05)
    # Alt up
    user32.PostMessageW(HWND, WM_KEYUP, 0x12, (user32.MapVirtualKeyW(0x12, 0) << 16) | 1 | (1 << 30) | (1 << 31))
    print(f"Full Alt+{letter} sequence (SYSKEYDOWN+SYSCHAR+SYSKEYUP)")

time.sleep(0.3)

# Capture
import struct
gdi32 = ctypes.windll.gdi32
rect = w.RECT()
user32.GetWindowRect(HWND, ctypes.byref(rect))
width = rect.right - rect.left
height = rect.bottom - rect.top
hdc = user32.GetWindowDC(HWND)
hdc_mem = gdi32.CreateCompatibleDC(hdc)
hbmp = gdi32.CreateCompatibleBitmap(hdc, width, height)
old = gdi32.SelectObject(hdc_mem, hbmp)
user32.PrintWindow(HWND, hdc_mem, 2)

class BMI(ctypes.Structure):
    _fields_ = [('biSize', w.DWORD), ('biWidth', w.LONG), ('biHeight', w.LONG),
                 ('biPlanes', w.WORD), ('biBitCount', w.WORD), ('biCompression', w.DWORD),
                 ('biSizeImage', w.DWORD), ('biXPelsPerMeter', w.LONG), ('biYPelsPerMeter', w.LONG),
                 ('biClrUsed', w.DWORD), ('biClrImportant', w.DWORD)]
bmi = BMI()
bmi.biSize = ctypes.sizeof(BMI); bmi.biWidth = width; bmi.biHeight = -height
bmi.biPlanes = 1; bmi.biBitCount = 24; bmi.biCompression = 0
bmi.biSizeImage = ((width * 3 + 3) // 4) * 4 * height
px = ctypes.create_string_buffer(bmi.biSizeImage)
gdi32.GetDIBits(hdc_mem, hbmp, 0, height, px, ctypes.byref(bmi), 0)
with open('D:\\openclaw\\workspace\\tally_win.bmp', 'wb') as f:
    f.write(b'BM'); f.write(struct.pack('<I', 54+bmi.biSizeImage)); f.write(b'\x00\x00\x00\x00')
    f.write(struct.pack('<I', 54)); f.write(bytes(bmi)); f.write(px.raw)
gdi32.SelectObject(hdc_mem, old); gdi32.DeleteObject(hbmp); gdi32.DeleteDC(hdc_mem)
user32.ReleaseDC(HWND, hdc)
from PIL import Image
Image.open('D:\\openclaw\\workspace\\tally_win.bmp').save('D:\\openclaw\\workspace\\tally_win.png')
print("Screenshot saved")
