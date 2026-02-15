import ctypes
import ctypes.wintypes
import time
import pygetwindow as gw
import pyautogui
import pyperclip

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

def send_hotkey(vk1, vk2):
    press_key(vk1)
    time.sleep(0.05)
    press_key(vk2)
    time.sleep(0.05)
    release_key(vk2)
    time.sleep(0.05)
    release_key(vk1)
    time.sleep(0.3)

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

# The Change Current Date dialog is open
# Click directly on the date field to make sure it has focus
# The field is at approximately center of the dialog
pyautogui.click(625, 451)
time.sleep(0.3)

# Select all with Ctrl+A
send_hotkey(0x11, 0x41)  # Ctrl+A
time.sleep(0.2)

# Copy "1-7-2025" to clipboard and paste with Ctrl+V
pyperclip.copy("1-7-2025")
send_hotkey(0x11, 0x56)  # Ctrl+V
time.sleep(0.5)

pyautogui.screenshot().save('D:/openclaw/workspace/tally_paste1.png')
print("Pasted date", flush=True)

# Press Enter
send_key(0x0D)
time.sleep(2)

pyautogui.screenshot().save('D:/openclaw/workspace/tally_paste2.png')
print("Enter pressed", flush=True)
