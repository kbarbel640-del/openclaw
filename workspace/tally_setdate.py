import ctypes
import ctypes.wintypes
import time
import pygetwindow as gw
import pyautogui

user32 = ctypes.windll.user32
INPUT_KEYBOARD = 1
KEYEVENTF_KEYUP = 0x0002

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

def press_key(vk):
    inp = INPUT()
    inp.type = INPUT_KEYBOARD
    inp._input.ki.wVk = vk
    user32.SendInput(1, ctypes.pointer(inp), ctypes.sizeof(INPUT))

def release_key(vk):
    inp = INPUT()
    inp.type = INPUT_KEYBOARD
    inp._input.ki.wVk = vk
    inp._input.ki.dwFlags = KEYEVENTF_KEYUP
    user32.SendInput(1, ctypes.pointer(inp), ctypes.sizeof(INPUT))

def send_key(vk):
    press_key(vk)
    time.sleep(0.05)
    release_key(vk)
    time.sleep(0.15)

def type_text(text):
    for ch in text:
        vk = user32.VkKeyScanW(ord(ch))
        if vk == -1:
            continue
        shift = (vk >> 8) & 1
        vk_code = vk & 0xFF
        if shift:
            press_key(0x10)
        send_key(vk_code)
        if shift:
            release_key(0x10)
        time.sleep(0.05)

def force_focus(hwnd):
    fore_thread = user32.GetWindowThreadProcessId(user32.GetForegroundWindow(), None)
    target_thread = user32.GetWindowThreadProcessId(hwnd, None)
    if fore_thread != target_thread:
        user32.AttachThreadInput(fore_thread, target_thread, True)
    user32.ShowWindow(hwnd, 9)
    user32.BringWindowToTop(hwnd)
    user32.SetForegroundWindow(hwnd)
    if fore_thread != target_thread:
        user32.AttachThreadInput(fore_thread, target_thread, False)
    time.sleep(0.5)

wins = gw.getWindowsWithTitle('TallyPrime')
hwnd = wins[0]._hWnd
force_focus(hwnd)
time.sleep(0.5)

# The date dialog is open with "15-2-2026" selected
# Clear the field and type new date
# First select all with Ctrl+A then type
send_key(0x08)  # Backspace to clear
time.sleep(0.1)
send_key(0x08)
send_key(0x08)
send_key(0x08)
send_key(0x08)
send_key(0x08)
send_key(0x08)
send_key(0x08)
send_key(0x08)
send_key(0x08)
time.sleep(0.2)

# Type new date
type_text("1-7-2025")
time.sleep(0.3)

pyautogui.screenshot().save('D:/openclaw/workspace/tally_datetyped.png')
print("Date typed", flush=True)

# Press Enter to accept
send_key(0x0D)  # Enter
time.sleep(2)

pyautogui.screenshot().save('D:/openclaw/workspace/tally_dateaccepted.png')
print("Enter pressed", flush=True)
