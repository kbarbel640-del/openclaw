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

def send_key(vk):
    inputs = (INPUT * 2)()
    inputs[0].type = INPUT_KEYBOARD
    inputs[0]._input.ki.wVk = vk
    inputs[1].type = INPUT_KEYBOARD
    inputs[1]._input.ki.wVk = vk
    inputs[1]._input.ki.dwFlags = KEYEVENTF_KEYUP
    user32.SendInput(2, ctypes.pointer(inputs[0]), ctypes.sizeof(INPUT))
    time.sleep(0.15)

def type_text(text):
    for ch in text:
        vk = user32.VkKeyScanW(ord(ch))
        if vk == -1:
            continue
        shift = (vk >> 8) & 1
        vk_code = vk & 0xFF
        if shift:
            inp = INPUT()
            inp.type = INPUT_KEYBOARD
            inp._input.ki.wVk = 0x10
            user32.SendInput(1, ctypes.pointer(inp), ctypes.sizeof(INPUT))
        send_key(vk_code)
        if shift:
            inp = INPUT()
            inp.type = INPUT_KEYBOARD
            inp._input.ki.wVk = 0x10
            inp._input.ki.dwFlags = KEYEVENTF_KEYUP
            user32.SendInput(1, ctypes.pointer(inp), ctypes.sizeof(INPUT))
        time.sleep(0.03)

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

# Find and focus Tally
wins = gw.getWindowsWithTitle('TallyPrime')
hwnd = wins[0]._hWnd
force_focus(hwnd)
time.sleep(1)

# Click on F2: Date button on the right panel (approx 1230, 128)
# Actually let me use keyboard - click in the Tally area first to make sure it has focus
pyautogui.click(600, 400)  # Click center of Tally
time.sleep(0.5)

# Press F2 for date/period change
send_key(0x71)  # F2
time.sleep(1.5)

pyautogui.screenshot().save('D:/openclaw/workspace/tally_period1.png')
print("Step 1: F2 pressed", flush=True)
