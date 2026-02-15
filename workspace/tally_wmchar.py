import ctypes
import ctypes.wintypes
import time
import pygetwindow as gw
import pyautogui

user32 = ctypes.windll.user32

WM_CHAR = 0x0102
WM_KEYDOWN = 0x0100
WM_KEYUP = 0x0101
VK_BACK = 0x08
VK_RETURN = 0x0D
VK_HOME = 0x24
VK_END = 0x23
VK_DELETE = 0x2E

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

# The Change Current Date dialog should still be open
# Try sending characters via WM_CHAR directly to the window

# First, go to Home to move cursor to start
user32.PostMessageW(hwnd, WM_KEYDOWN, VK_HOME, 0)
user32.PostMessageW(hwnd, WM_KEYUP, VK_HOME, 0)
time.sleep(0.1)

# Select all: Shift+End
user32.PostMessageW(hwnd, WM_KEYDOWN, VK_END, 0x20000001)  # with shift
user32.PostMessageW(hwnd, WM_KEYUP, VK_END, 0xC0000001)
time.sleep(0.1)

# Delete selection
for _ in range(15):
    user32.PostMessageW(hwnd, WM_KEYDOWN, VK_BACK, 0)
    user32.PostMessageW(hwnd, WM_KEYUP, VK_BACK, 0)
    time.sleep(0.05)

time.sleep(0.3)

# Type "1-7-2025" using WM_CHAR
for ch in "1-7-2025":
    user32.PostMessageW(hwnd, WM_CHAR, ord(ch), 0)
    time.sleep(0.1)

time.sleep(0.5)
pyautogui.screenshot().save('D:/openclaw/workspace/tally_wmchar1.png')
print("Characters sent via WM_CHAR", flush=True)

# Press Enter
user32.PostMessageW(hwnd, WM_KEYDOWN, VK_RETURN, 0)
user32.PostMessageW(hwnd, WM_KEYUP, VK_RETURN, 0)
time.sleep(2)

pyautogui.screenshot().save('D:/openclaw/workspace/tally_wmchar2.png')
print("Enter sent", flush=True)
