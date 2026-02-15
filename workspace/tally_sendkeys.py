import ctypes
import ctypes.wintypes as w
import time
import sys

user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32

HWND = 918668

# Get thread IDs
tally_tid = user32.GetWindowThreadProcessId(HWND, None)
my_tid = kernel32.GetCurrentThreadId()
print(f"Tally TID: {tally_tid}, My TID: {my_tid}")

# Attach thread input
attached = user32.AttachThreadInput(my_tid, tally_tid, True)
print(f"AttachThreadInput: {attached}")

# Force foreground
user32.SetForegroundWindow(HWND)
user32.SetFocus(HWND)
time.sleep(0.3)

# SendInput structures
INPUT_KEYBOARD = 1
KEYEVENTF_KEYUP = 0x0002
KEYEVENTF_EXTENDEDKEY = 0x0001

class KEYBDINPUT(ctypes.Structure):
    _fields_ = [("wVk", w.WORD), ("wScan", w.WORD), ("dwFlags", w.DWORD),
                ("time", w.DWORD), ("dwExtraInfo", ctypes.POINTER(ctypes.c_ulong))]

class INPUT(ctypes.Structure):
    class _INPUT(ctypes.Union):
        _fields_ = [("ki", KEYBDINPUT), ("padding", ctypes.c_ubyte * 64)]
    _fields_ = [("type", w.DWORD), ("_input", _INPUT)]

def make_input(vk, flags=0):
    inp = INPUT()
    inp.type = INPUT_KEYBOARD
    inp._input.ki.wVk = vk
    inp._input.ki.wScan = user32.MapVirtualKeyW(vk, 0)
    inp._input.ki.dwFlags = flags
    inp._input.ki.time = 0
    inp._input.ki.dwExtraInfo = ctypes.pointer(ctypes.c_ulong(0))
    return inp

action = sys.argv[1] if len(sys.argv) > 1 else "altd"

if action == "altd":
    # Ctrl+Alt+D via SendInput (all at once)
    VK_CONTROL = 0x11
    VK_MENU = 0x12
    VK_D = 0x44
    
    inputs = (INPUT * 6)()
    inputs[0] = make_input(VK_CONTROL)
    inputs[1] = make_input(VK_MENU)
    inputs[2] = make_input(VK_D)
    inputs[3] = make_input(VK_D, KEYEVENTF_KEYUP)
    inputs[4] = make_input(VK_MENU, KEYEVENTF_KEYUP)
    inputs[5] = make_input(VK_CONTROL, KEYEVENTF_KEYUP)
    
    sent = user32.SendInput(6, ctypes.byref(inputs), ctypes.sizeof(INPUT))
    print(f"SendInput Ctrl+Alt+D: sent {sent} events")

elif action == "altd_only":
    # Just Alt+D
    VK_MENU = 0x12
    VK_D = 0x44
    inputs = (INPUT * 4)()
    inputs[0] = make_input(VK_MENU)
    inputs[1] = make_input(VK_D)
    inputs[2] = make_input(VK_D, KEYEVENTF_KEYUP)
    inputs[3] = make_input(VK_MENU, KEYEVENTF_KEYUP)
    sent = user32.SendInput(4, ctypes.byref(inputs), ctypes.sizeof(INPUT))
    print(f"SendInput Alt+D: sent {sent} events")

elif action == "enter":
    inputs = (INPUT * 2)()
    inputs[0] = make_input(0x0D)
    inputs[1] = make_input(0x0D, KEYEVENTF_KEYUP)
    sent = user32.SendInput(2, ctypes.byref(inputs), ctypes.sizeof(INPUT))
    print(f"SendInput Enter: sent {sent}")

elif action == "y":
    inputs = (INPUT * 2)()
    inputs[0] = make_input(0x59)  # Y
    inputs[1] = make_input(0x59, KEYEVENTF_KEYUP)
    sent = user32.SendInput(2, ctypes.byref(inputs), ctypes.sizeof(INPUT))
    print(f"SendInput Y: sent {sent}")

time.sleep(0.5)

# Detach
user32.AttachThreadInput(my_tid, tally_tid, False)
print("Done")
