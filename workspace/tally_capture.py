import ctypes
import ctypes.wintypes as w
import struct

user32 = ctypes.windll.user32
gdi32 = ctypes.windll.gdi32

HWND = 918668

# Get window rect
rect = w.RECT()
user32.GetWindowRect(HWND, ctypes.byref(rect))
width = rect.right - rect.left
height = rect.bottom - rect.top
print(f"Window size: {width}x{height}")

# Use PrintWindow to capture even from another session
hdc_window = user32.GetWindowDC(HWND)
hdc_mem = gdi32.CreateCompatibleDC(hdc_window)
hbmp = gdi32.CreateCompatibleBitmap(hdc_window, width, height)
old = gdi32.SelectObject(hdc_mem, hbmp)

# PrintWindow with PW_RENDERFULLCONTENT (2) for better capture
result = user32.PrintWindow(HWND, hdc_mem, 2)
print(f"PrintWindow result: {result}")

# Get pixels
class BITMAPINFOHEADER(ctypes.Structure):
    _fields_ = [('biSize', w.DWORD), ('biWidth', w.LONG), ('biHeight', w.LONG),
                 ('biPlanes', w.WORD), ('biBitCount', w.WORD), ('biCompression', w.DWORD),
                 ('biSizeImage', w.DWORD), ('biXPelsPerMeter', w.LONG), ('biYPelsPerMeter', w.LONG),
                 ('biClrUsed', w.DWORD), ('biClrImportant', w.DWORD)]

bmi = BITMAPINFOHEADER()
bmi.biSize = ctypes.sizeof(BITMAPINFOHEADER)
bmi.biWidth = width
bmi.biHeight = -height
bmi.biPlanes = 1
bmi.biBitCount = 24
bmi.biCompression = 0
row_size = ((width * 3 + 3) // 4) * 4
bmi.biSizeImage = row_size * height

pixels = ctypes.create_string_buffer(bmi.biSizeImage)
gdi32.GetDIBits(hdc_mem, hbmp, 0, height, pixels, ctypes.byref(bmi), 0)

# Write BMP
with open('D:\\openclaw\\workspace\\tally_win.bmp', 'wb') as f:
    file_size = 54 + bmi.biSizeImage
    f.write(b'BM')
    f.write(struct.pack('<I', file_size))
    f.write(b'\x00\x00\x00\x00')
    f.write(struct.pack('<I', 54))
    f.write(bytes(bmi))
    f.write(pixels.raw)

gdi32.SelectObject(hdc_mem, old)
gdi32.DeleteObject(hbmp)
gdi32.DeleteDC(hdc_mem)
user32.ReleaseDC(HWND, hdc_window)

# Convert to PNG
from PIL import Image
img = Image.open('D:\\openclaw\\workspace\\tally_win.bmp')
img.save('D:\\openclaw\\workspace\\tally_win.png')
print(f"Saved tally_win.png ({width}x{height})")
