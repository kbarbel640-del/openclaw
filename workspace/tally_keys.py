import ctypes
import ctypes.wintypes
import time
import pygetwindow as gw

user32 = ctypes.windll.user32

# SendInput structures
INPUT_KEYBOARD = 1
KEYEVENTF_KEYUP = 0x0002
KEYEVENTF_SCANCODE = 0x0008

VK_F2 = 0x71
VK_RETURN = 0x0D
VK_TAB = 0x09

class KEYBDINPUT(ctypes.Structure):
    _fields_ = [("wVk", ctypes.wintypes.WORD),
                ("wScan", ctypes.wintypes.WORD),
                ("dwFlags", ctypes.wintypes.DWORD),
                ("time", ctypes.wintypes.DWORD),
                ("dwExtraInfo", ctypes.POINTER(ctypes.c_ulong))]

class INPUT(ctypes.Structure):
    class _INPUT(ctypes.Union):
        _fields_ = [("ki", KEYBDINPUT)]
    _fields_ = [("type", ctypes.wintypes.DWORD),
                ("_input", _INPUT)]

def send_key(vk, scan=0):
    inputs = (INPUT * 2)()
    inputs[0].type = INPUT_KEYBOARD
    inputs[0]._input.ki.wVk = vk
    inputs[0]._input.ki.wScan = scan
    inputs[0]._input.ki.dwFlags = 0
    inputs[1].type = INPUT_KEYBOARD
    inputs[1]._input.ki.wVk = vk
    inputs[1]._input.ki.wScan = scan
    inputs[1]._input.ki.dwFlags = KEYEVENTF_KEYUP
    user32.SendInput(2, ctypes.pointer(inputs[0]), ctypes.sizeof(INPUT))
    time.sleep(0.1)

def type_text(text):
    for ch in text:
        vk = ctypes.windll.user32.VkKeyScanW(ord(ch))
        send_key(vk & 0xFF)
        time.sleep(0.05)

# Focus Tally
wins = gw.getWindowsWithTitle('TallyPrime')
if not wins:
    print("TallyPrime not found!")
    exit(1)

hwnd = wins[0]._hWnd
user32.ShowWindow(hwnd, 9)
user32.SetForegroundWindow(hwnd)
time.sleep(1)

# Press F2 to open date dialog
print("Pressing F2...", flush=True)
send_key(VK_F2)
time.sleep(1)

# Take screenshot to see what happened
import pyautogui
pyautogui.screenshot().save('D:/openclaw/workspace/tally_f2.png')
print("Screenshot saved", flush=True)
