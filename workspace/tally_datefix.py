import ctypes
import ctypes.wintypes
import time
import pygetwindow as gw
import pyautogui

user32 = ctypes.windll.user32
WM_CHAR = 0x0102
WM_KEYDOWN = 0x0100
WM_KEYUP = 0x0101
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
hwnd = wins[0]._hWnd

if step == 1:
    # Step 1: Escape back to Gateway
    force_focus(hwnd)
    time.sleep(0.5)
    send_key(0x1B)  # ESC
    time.sleep(0.5)
    send_key(0x1B)  # ESC again
    time.sleep(0.5)
    send_key(0x1B)  # ESC once more
    time.sleep(1)
    pyautogui.screenshot().save('D:/openclaw/workspace/tally_df1.png')
    print("Step 1: Back to gateway", flush=True)

elif step == 2:
    # Step 2: Open date dialog by clicking F2: Date
    force_focus(hwnd)
    time.sleep(0.5)
    # Click on F2: Date in the right sidebar
    w = wins[0]
    click_x = w.left + w.width - 100
    click_y = w.top + 128
    pyautogui.click(click_x, click_y)
    time.sleep(1.5)
    pyautogui.screenshot().save('D:/openclaw/workspace/tally_df2.png')
    print("Step 2: Date dialog opened", flush=True)

elif step == 3:
    # Step 3: Type date directly using WM_CHAR (field should be auto-selected)
    force_focus(hwnd)
    time.sleep(0.5)
    
    # Just type the date - Tally should replace the selected text
    for ch in "1-7-2025":
        user32.PostMessageW(hwnd, WM_CHAR, ord(ch), 0)
        time.sleep(0.15)
    
    time.sleep(0.5)
    pyautogui.screenshot().save('D:/openclaw/workspace/tally_df3.png')
    print("Step 3: Date typed", flush=True)

elif step == 4:
    # Step 4: Press Enter to accept
    force_focus(hwnd)
    time.sleep(0.3)
    # Use SendInput for Enter (more reliable than WM_CHAR for control keys)
    send_key(0x0D)
    time.sleep(2)
    pyautogui.screenshot().save('D:/openclaw/workspace/tally_df4.png')
    print("Step 4: Enter pressed", flush=True)
