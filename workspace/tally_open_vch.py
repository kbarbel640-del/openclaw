import ctypes
import ctypes.wintypes as w
import time
import sys

user32 = ctypes.windll.user32
HWND = 918668

WM_KEYDOWN = 0x0100
WM_KEYUP = 0x0101

def send_vk(vk):
    scan = user32.MapVirtualKeyW(vk, 0)
    lparam_down = (scan << 16) | 1
    lparam_up = (scan << 16) | 1 | (1 << 30) | (1 << 31)
    user32.PostMessageW(HWND, WM_KEYDOWN, vk, lparam_down)
    time.sleep(0.05)
    user32.PostMessageW(HWND, WM_KEYUP, vk, lparam_up)
    time.sleep(0.2)

# Navigate: down N times from current position, then Enter
n = int(sys.argv[1]) if len(sys.argv) > 1 else 0

VK_DOWN = 0x28
VK_RETURN = 0x0D

for i in range(n):
    send_vk(VK_DOWN)
    time.sleep(0.1)

time.sleep(0.2)
send_vk(VK_RETURN)
time.sleep(0.8)

# Capture
import struct
gdi32 = ctypes.windll.gdi32
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
with open('D:\\openclaw\\workspace\\tally_win.bmp', 'wb') as f:
    f.write(b'BM'); f.write(struct.pack('<I', 54 + bmi.biSizeImage)); f.write(b'\x00\x00\x00\x00')
    f.write(struct.pack('<I', 54)); f.write(bytes(bmi)); f.write(pixels.raw)
gdi32.SelectObject(hdc_mem, old); gdi32.DeleteObject(hbmp); gdi32.DeleteDC(hdc_mem)
user32.ReleaseDC(HWND, hdc_window)
from PIL import Image
Image.open('D:\\openclaw\\workspace\\tally_win.bmp').save('D:\\openclaw\\workspace\\tally_win.png')
print(f"Captured after Down x{n} + Enter")
