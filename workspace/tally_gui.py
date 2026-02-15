import ctypes
import ctypes.wintypes as w
import time

user32 = ctypes.windll.user32

HWND = 918668

# Focus Tally window
user32.SetForegroundWindow(HWND)
time.sleep(0.3)

# Helper: send key via SendInput
INPUT_KEYBOARD = 1
KEYEVENTF_KEYUP = 0x0002
KEYEVENTF_UNICODE = 0x0004

class KEYBDINPUT(ctypes.Structure):
    _fields_ = [("wVk", w.WORD), ("wScan", w.WORD), ("dwFlags", w.DWORD),
                ("time", w.DWORD), ("dwExtraInfo", ctypes.POINTER(ctypes.c_ulong))]

class INPUT(ctypes.Structure):
    class _INPUT(ctypes.Union):
        _fields_ = [("ki", KEYBDINPUT), ("padding", ctypes.c_ubyte * 64)]
    _fields_ = [("type", w.DWORD), ("_input", _INPUT)]

def send_key(vk):
    """Send a virtual key press and release"""
    inp = INPUT()
    inp.type = INPUT_KEYBOARD
    inp._input.ki.wVk = vk
    inp._input.ki.wScan = 0
    inp._input.ki.dwFlags = 0
    inp._input.ki.time = 0
    inp._input.ki.dwExtraInfo = ctypes.pointer(ctypes.c_ulong(0))
    user32.SendInput(1, ctypes.byref(inp), ctypes.sizeof(INPUT))
    time.sleep(0.05)
    inp._input.ki.dwFlags = KEYEVENTF_KEYUP
    user32.SendInput(1, ctypes.byref(inp), ctypes.sizeof(INPUT))
    time.sleep(0.1)

def send_char(char):
    """Send a unicode character via WM_CHAR"""
    user32.PostMessageW(HWND, 0x0102, ord(char), 0)  # WM_CHAR
    time.sleep(0.1)

def send_escape():
    send_key(0x1B)  # VK_ESCAPE

def send_enter():
    send_key(0x0D)  # VK_RETURN

def send_string(s):
    for c in s:
        send_char(c)

VK_F2 = 0x71
VK_DOWN = 0x28
VK_UP = 0x26
VK_DELETE = 0x2E
VK_ALT = 0x12
VK_D = 0x44

import sys
action = sys.argv[1] if len(sys.argv) > 1 else "escape"

if action == "escape":
    # Press Escape multiple times to get back to Gateway
    for _ in range(5):
        send_escape()
        time.sleep(0.2)
    print("Sent 5x Escape - should be at Gateway")

elif action == "goto_mfg":
    # From Gateway: Display > Manufacturing Journal
    # D for Display, then navigate
    send_char('D')  # Display menu
    time.sleep(0.5)
    print("Opened Display menu")

elif action == "enter":
    send_enter()
    time.sleep(0.3)
    print("Sent Enter")

elif action == "down":
    n = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    for _ in range(n):
        send_key(VK_DOWN)
        time.sleep(0.1)
    print(f"Sent Down x{n}")

elif action == "up":
    n = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    for _ in range(n):
        send_key(VK_UP)
        time.sleep(0.1)
    print(f"Sent Up x{n}")

elif action == "type":
    text = sys.argv[2]
    send_string(text)
    print(f"Typed: {text}")

elif action == "altd":
    # Alt+D for delete in Tally
    inp = INPUT()
    inp.type = INPUT_KEYBOARD
    inp._input.ki.wVk = VK_ALT
    inp._input.ki.dwFlags = 0
    inp._input.ki.dwExtraInfo = ctypes.pointer(ctypes.c_ulong(0))
    user32.SendInput(1, ctypes.byref(inp), ctypes.sizeof(INPUT))
    time.sleep(0.1)
    
    inp2 = INPUT()
    inp2.type = INPUT_KEYBOARD
    inp2._input.ki.wVk = VK_D
    inp2._input.ki.dwFlags = 0
    inp2._input.ki.dwExtraInfo = ctypes.pointer(ctypes.c_ulong(0))
    user32.SendInput(1, ctypes.byref(inp2), ctypes.sizeof(INPUT))
    time.sleep(0.1)
    
    inp2._input.ki.dwFlags = KEYEVENTF_KEYUP
    user32.SendInput(1, ctypes.byref(inp2), ctypes.sizeof(INPUT))
    time.sleep(0.05)
    inp._input.ki.dwFlags = KEYEVENTF_KEYUP
    user32.SendInput(1, ctypes.byref(inp), ctypes.sizeof(INPUT))
    time.sleep(0.3)
    print("Sent Alt+D")

elif action == "screenshot":
    # Try screenshot via ctypes directly
    import struct
    hdc_screen = user32.GetDC(0)
    gdi32 = ctypes.windll.gdi32
    width = user32.GetSystemMetrics(0)
    height = user32.GetSystemMetrics(1)
    hdc_mem = gdi32.CreateCompatibleDC(hdc_screen)
    hbmp = gdi32.CreateCompatibleBitmap(hdc_screen, width, height)
    gdi32.SelectObject(hdc_mem, hbmp)
    gdi32.BitBlt(hdc_mem, 0, 0, width, height, hdc_screen, 0, 0, 0x00CC0020)
    
    # Save as BMP
    class BITMAPINFOHEADER(ctypes.Structure):
        _fields_ = [('biSize', w.DWORD), ('biWidth', w.LONG), ('biHeight', w.LONG),
                     ('biPlanes', w.WORD), ('biBitCount', w.WORD), ('biCompression', w.DWORD),
                     ('biSizeImage', w.DWORD), ('biXPelsPerMeter', w.LONG), ('biYPelsPerMeter', w.LONG),
                     ('biClrUsed', w.DWORD), ('biClrImportant', w.DWORD)]
    
    bmi = BITMAPINFOHEADER()
    bmi.biSize = ctypes.sizeof(BITMAPINFOHEADER)
    bmi.biWidth = width
    bmi.biHeight = -height  # top-down
    bmi.biPlanes = 1
    bmi.biBitCount = 24
    bmi.biCompression = 0
    row_size = ((width * 3 + 3) // 4) * 4
    bmi.biSizeImage = row_size * height
    
    pixels = ctypes.create_string_buffer(bmi.biSizeImage)
    gdi32.GetDIBits(hdc_mem, hbmp, 0, height, pixels, ctypes.byref(bmi), 0)
    
    # Write BMP file
    with open('D:\\openclaw\\workspace\\tally_screen.bmp', 'wb') as f:
        # BMP header
        file_size = 54 + bmi.biSizeImage
        f.write(b'BM')
        f.write(struct.pack('<I', file_size))
        f.write(b'\x00\x00\x00\x00')
        f.write(struct.pack('<I', 54))
        f.write(bytes(bmi))
        f.write(pixels.raw)
    
    gdi32.DeleteObject(hbmp)
    gdi32.DeleteDC(hdc_mem)
    user32.ReleaseDC(0, hdc_screen)
    
    # Convert to PNG using PIL if available
    try:
        from PIL import Image
        img = Image.open('D:\\openclaw\\workspace\\tally_screen.bmp')
        img.save('D:\\openclaw\\workspace\\tally_screen.png')
        print(f"Screenshot saved as PNG: {width}x{height}")
    except:
        print(f"Screenshot saved as BMP: {width}x{height}")

print("Done")
