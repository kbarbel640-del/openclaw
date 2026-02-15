import ctypes
import ctypes.wintypes as w
import time
import sys

user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32

HWND = 918668

tally_tid = user32.GetWindowThreadProcessId(HWND, None)
my_tid = kernel32.GetCurrentThreadId()
user32.AttachThreadInput(my_tid, tally_tid, True)
user32.SetForegroundWindow(HWND)
user32.SetFocus(HWND)
time.sleep(0.3)

KEYEVENTF_KEYUP = 0x0002

action = sys.argv[1] if len(sys.argv) > 1 else "altd"

if action == "altd":
    # Alt+D via keybd_event
    user32.keybd_event(0x12, 0, 0, 0)  # Alt down
    time.sleep(0.05)
    user32.keybd_event(0x44, 0, 0, 0)  # D down
    time.sleep(0.05)
    user32.keybd_event(0x44, 0, KEYEVENTF_KEYUP, 0)  # D up
    time.sleep(0.05)
    user32.keybd_event(0x12, 0, KEYEVENTF_KEYUP, 0)  # Alt up
    print("keybd_event Alt+D sent")

elif action == "enter":
    user32.keybd_event(0x0D, 0, 0, 0)
    time.sleep(0.05)
    user32.keybd_event(0x0D, 0, KEYEVENTF_KEYUP, 0)
    print("keybd_event Enter sent")

elif action == "y":
    user32.keybd_event(0x59, 0, 0, 0)
    time.sleep(0.05)
    user32.keybd_event(0x59, 0, KEYEVENTF_KEYUP, 0)
    print("keybd_event Y sent")

elif action == "escape":
    user32.keybd_event(0x1B, 0, 0, 0)
    time.sleep(0.05)
    user32.keybd_event(0x1B, 0, KEYEVENTF_KEYUP, 0)
    print("keybd_event Escape sent")

time.sleep(0.5)
user32.AttachThreadInput(my_tid, tally_tid, False)
