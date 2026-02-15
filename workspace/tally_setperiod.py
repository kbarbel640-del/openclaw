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
    time.sleep(0.5)

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

import sys
step = int(sys.argv[1]) if len(sys.argv) > 1 else 1

wins = gw.getWindowsWithTitle('TallyPrime')
if not wins:
    print("TallyPrime not found!")
    exit(1)
hwnd = wins[0]._hWnd

if step == 1:
    # Step 1: Focus Tally, press Alt+F2 to get Period mode, then F2 to open period dialog
    force_focus(hwnd)
    time.sleep(1)
    
    # First press Escape to clear any state
    send_key(0x1B)  # ESC
    time.sleep(0.5)
    
    # Press Alt+F2 to switch to Period mode
    send_hotkey(0x12, 0x71)  # Alt+F2
    time.sleep(1)
    
    pyautogui.screenshot().save('D:/openclaw/workspace/tally_step1.png')
    print("Step 1 done - Alt+F2 pressed", flush=True)

elif step == 2:
    # Step 2: Now click on "F2: Period" button on right sidebar
    force_focus(hwnd)
    time.sleep(0.5)
    
    # The F2: Period button should be at approximately x=1235, y=128 based on earlier screenshots
    # But Tally window might be at different position. Let's use the window coordinates.
    w = wins[0]
    # F2: Period is in the top-right area of Tally window
    # In the screenshot it was at roughly x=1235, y=128 in absolute coords
    # With Tally at 0,0 and 1920 wide, right panel starts ~1190
    click_x = w.left + w.width - 100  # near right edge
    click_y = w.top + 128  # near top
    print(f"Clicking at {click_x}, {click_y}", flush=True)
    pyautogui.click(click_x, click_y)
    time.sleep(1.5)
    
    pyautogui.screenshot().save('D:/openclaw/workspace/tally_step2.png')
    print("Step 2 done - clicked F2: Period", flush=True)

elif step == 3:
    # Step 3: Type the new period dates
    force_focus(hwnd)
    time.sleep(0.5)
    
    # Type from date: 1-1-2025
    type_text("1-1-2025")
    send_key(0x0D)  # Enter
    time.sleep(0.5)
    
    # Type to date: 31-12-2025
    type_text("31-12-2025")
    send_key(0x0D)  # Enter
    time.sleep(1)
    
    pyautogui.screenshot().save('D:/openclaw/workspace/tally_step3.png')
    print("Step 3 done - dates entered", flush=True)
