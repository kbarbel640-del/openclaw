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

def send_hotkey(mod_vk, key_vk):
    press_key(mod_vk)
    time.sleep(0.05)
    press_key(key_vk)
    time.sleep(0.05)
    release_key(key_vk)
    time.sleep(0.05)
    release_key(mod_vk)
    time.sleep(0.3)

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

# Press Alt+F2 to change period
print("Pressing Alt+F2...", flush=True)
send_hotkey(0x12, 0x71)  # Alt + F2
time.sleep(2)

pyautogui.screenshot().save('D:/openclaw/workspace/tally_altf2.png')
print("Done", flush=True)
