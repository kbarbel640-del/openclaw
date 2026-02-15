"""Click on Tally UI elements using PostMessage WM_LBUTTONDOWN/UP.
Coordinates are relative to the client area of the window."""
import ctypes
import ctypes.wintypes as w
import time
import sys
import struct

user32 = ctypes.windll.user32
gdi32 = ctypes.windll.gdi32

# Find Tally
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

# Get client rect
client_rect = w.RECT()
user32.GetClientRect(HWND, ctypes.byref(client_rect))
cw = client_rect.right
ch = client_rect.bottom
print(f"Tally HWND: {HWND}, Client: {cw}x{ch}")

WM_LBUTTONDOWN = 0x0201
WM_LBUTTONUP = 0x0202
MK_LBUTTON = 0x0001

def click(x, y):
    lParam = (y << 16) | (x & 0xFFFF)
    user32.PostMessageW(HWND, WM_LBUTTONDOWN, MK_LBUTTON, lParam)
    time.sleep(0.05)
    user32.PostMessageW(HWND, WM_LBUTTONUP, 0, lParam)
    time.sleep(0.3)
    print(f"Clicked at ({x}, {y})")

x = int(sys.argv[1]) if len(sys.argv) > 1 else cw // 2
y = int(sys.argv[2]) if len(sys.argv) > 2 else ch // 2

click(x, y)

# Capture screenshot
time.sleep(0.3)
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
