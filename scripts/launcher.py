import tkinter as tk
from tkinter import ttk
import threading
import time
import subprocess
import sys
import os
import signal
from PIL import Image, ImageDraw, ImageFont
import pystray
from pystray import MenuItem as item

# --- Configuration ---
APP_NAME = "OpenClaw"
# Use the built version directly to avoid auto-build delays and potential stale checks
if sys.platform == "win32":
    # Using dist/index.js or dist/entry.js depending on the project structure
    # Based on 'dir dist', entry.js exists
    CMD = "node dist/entry.js gateway run --bind loopback --port 18789 --force"
else:
    CMD = [
        "node",
        "dist/entry.js",
        "gateway",
        "run",
        "--bind",
        "loopback",
        "--port",
        "18789",
        "--force",
    ]
ICON_SIZE = 64

# --- Global State ---
process = None
tray_icon = None
window = None


def create_icon():
    # Create a cleaner, more professional icon
    image = Image.new("RGBA", (ICON_SIZE, ICON_SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    # Main circle (Dark Grey/Black background)
    draw.ellipse((0, 0, ICON_SIZE, ICON_SIZE), fill="#212121")

    # Inner ring (OpenClaw Orange)
    margin = ICON_SIZE // 8
    draw.ellipse(
        (margin, margin, ICON_SIZE - margin, ICON_SIZE - margin),
        outline="#FF5722",
        width=ICON_SIZE // 10,
    )

    # Center dot (White)
    center_size = ICON_SIZE // 6
    cx, cy = ICON_SIZE // 2, ICON_SIZE // 2
    draw.ellipse(
        (cx - center_size, cy - center_size, cx + center_size, cy + center_size),
        fill="#FFFFFF",
    )

    return image

    return image


def kill_existing_process():
    import psutil

    try:
        # Find process listening on port 18789 using netstat strategy fallback or psutil
        # Since we can't guarantee psutil is installed in the system python (though we are in venv),
        # check imports. psutil is not in requirements-launcher.txt currently!
        # Wait, requirements-launcher.txt has 'pystray' and 'Pillow'.
        # We should use 'netstat' parsing or wmic since we can't rely on psutil being installed.
        pass
    except:
        pass


# Redefining to use subprocess/netstat which is safer without extra deps
def kill_existing_openclaw():
    print("Checking for existing OpenClaw instances...")
    try:
        startupinfo = subprocess.STARTUPINFO()
        startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW

        # Get process info BEFORE doing anything
        my_pid = os.getpid()
        my_ppid = os.getppid()

        # Small delay to let this process stabilize
        time.sleep(0.3)

        # Only kill processes using port 18789 - exclude ourselves and parent (with timeout)
        try:
            output = subprocess.check_output(
                "netstat -ano | findstr :18789",
                shell=True,
                startupinfo=startupinfo,
                stderr=subprocess.DEVNULL,
                timeout=3,
            ).decode()
        except subprocess.CalledProcessError:
            output = ""
        except subprocess.TimeoutExpired:
            output = ""

        if output.strip():
            lines = output.strip().split("\n")
            for line in lines:
                parts = line.strip().split()
                if len(parts) > 4:
                    try:
                        pid = int(parts[-1])
                        # Don't kill ourselves or our parent (csrss.exe, explorer.exe, etc.)
                        if pid != my_pid and pid != my_ppid:
                            print(f"Killing process using port 18789: {pid}")
                            subprocess.call(
                                f"taskkill /F /PID {pid}",
                                shell=True,
                                startupinfo=startupinfo,
                                stderr=subprocess.DEVNULL,
                            )
                    except (ValueError, subprocess.SubprocessError):
                        pass

    except Exception as e:
        print(f"Error during cleanup: {e}")


def start_openclaw(icon=None):
    global process
    log_quit(f"start_openclaw called, process={process and process.pid}")

    if process is None:
        if icon:
            icon.notify("Starting OpenClaw Gateway...", title="OpenClaw")
        print("Starting OpenClaw...")
        log_quit("Starting gateway process...")

        # Use shell=True for pnpm on Windows to resolve properly
        try:
            log_quit("Using shell=True for subprocess")
            # Using creationflags to suppress console window on Windows
            creationflags = (
                subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
            )

            # Setting environment variable to ensure proper binding
            env = os.environ.copy()
            # Force local mode and ensure paths are correct
            env["OPENCLAW_MODE"] = "local"

            log_quit(f"CMD: {CMD}")

            # Log output to a file for debugging
            log_file = open("launcher_debug.log", "a")  # Append to log
            log_file.write(f"\n--- Starting Gateway at {time.ctime()} ---\n")

            process = subprocess.Popen(
                CMD,
                shell=True,
                creationflags=creationflags,
                cwd=os.getcwd(),
                env=env,
                stdout=log_file,
                stderr=subprocess.STDOUT,
            )

            log_quit(f"Gateway started, PID={process.pid}")
            print(f"Gateway started, PID={process.pid}")
        except Exception as e:
            log_quit(f"Failed to start gateway: {e}")
            if icon:
                icon.notify(f"Failed to start: {e}", title="OpenClaw Error")
            print(f"Failed to start: {e}")
    else:
        log_quit(f"Gateway already running, PID={process.pid}")


def stop_openclaw(icon=None):
    global process
    my_pid = os.getpid()
    log_quit(
        f"stop_openclaw called, my_pid={my_pid}, process={process and process.pid}"
    )

    if icon:
        icon.notify("Stopping OpenClaw Gateway...", title="OpenClaw")

    log_quit("Stopping OpenClaw...")

    if sys.platform == "win32":
        # On Windows, kill by port 18789 only (handles zombie gateway)
        try:
            log_quit("Running netstat for port 18789...")
            output = subprocess.check_output(
                "netstat -ano | findstr :18789",
                shell=True,
                stderr=subprocess.DEVNULL,
                timeout=2,
            ).decode()
            log_quit(f"netstat output: {output[:100]}")

            my_ppid = os.getppid()
            log_quit(f"my_ppid={my_ppid}")

            lines = output.strip().split("\n")
            log_quit(f"Processing {len(lines)} lines")

            for i, line in enumerate(lines):
                parts = line.strip().split()
                log_quit(f"Line {i}: {parts}")

                if len(parts) > 4 and parts[-1] != "0":
                    try:
                        pid = int(parts[-1])
                        log_quit(f"Found PID {pid}")

                        # Don't kill ourselves or our parent
                        if pid != my_pid and pid != my_ppid:
                            log_quit(f"Killing PID {pid} on port 18789")
                            subprocess.call(
                                f"taskkill /F /PID {pid}",
                                shell=True,
                                stderr=subprocess.DEVNULL,
                            )
                            log_quit(f"Killed PID {pid}")
                        else:
                            log_quit(f"Skipping PID {pid} (self or parent)")
                    except (ValueError, subprocess.SubprocessError) as e:
                        log_quit(f"Error processing PID: {e}")

            log_quit("Port 18789 cleanup done")
        except subprocess.TimeoutExpired:
            log_quit("netstat timeout in stop_openclaw")
        except Exception as e:
            log_quit(f"stop_openclaw netstat error: {e}")
    else:
        try:
            log_quit("Killing process group on non-Windows")
            os.killpg(os.getpgid(process.pid), signal.SIGTERM)
        except Exception as e:
            log_quit(f"non-Windows kill error: {e}")

    process = None
    log_quit("stop_openclaw completed")


def restart_openclaw(icon, item):
    stop_openclaw(icon)
    time.sleep(2)
    start_openclaw(icon)
    icon.notify("OpenClaw Gateway Restarted", title="OpenClaw")


def quit_app(icon, item):
    print("quit_app called")

    # Stop gateway quickly (do NOT call icon.stop() - it blocks in pystray)
    try:
        log_quit("Stopping gateway...")
        stop_openclaw(None)
        log_quit("Gateway stopped")
    except Exception as e:
        log_quit(f"stop_openclaw error: {e}")

    # Force exit immediately (Windows will clean up the tray icon automatically)
    log_quit("Exiting via os._exit")
    os._exit(0)


def log_quit(msg):
    timestamp = time.strftime("%H:%M:%S")
    full_msg = f"[{timestamp}] QUIT: {msg}"
    print(full_msg)
    try:
        with open("launcher_quit.log", "a") as f:
            f.write(full_msg + "\n")
    except:
        pass


def log_launcher(msg):
    timestamp = time.strftime("%H:%M:%S")
    full_msg = f"[{timestamp}] LAUNCHER: {msg}"
    print(full_msg)
    try:
        with open("launcher_debug.log", "a") as f:
            f.write(full_msg + "\n")
    except:
        pass


def show_splash():
    log_launcher("show_splash: Creating Tk window...")
    global window
    try:
        window = tk.Tk()
        window.overrideredirect(True)  # Frameless
        log_launcher("show_splash: Tk window created")
    except Exception as e:
        log_launcher(f"show_splash: Failed to create Tk window: {e}")
        return

    # Center the window
    width = 500
    height = 300
    screen_width = window.winfo_screenwidth()
    screen_height = window.winfo_screenheight()
    x = (screen_width - width) // 2
    y = (screen_height - height) // 2
    window.geometry(f"{width}x{height}+{x}+{y}")

    # Styling
    window.configure(bg="#1E1E1E")

    # Content
    label_title = tk.Label(
        window,
        text="OpenClaw",
        font=("Helvetica", 32, "bold"),
        bg="#1E1E1E",
        fg="#FFFFFF",
    )
    label_title.pack(pady=(60, 10))

    label_subtitle = tk.Label(
        window,
        text="AI Agent Gateway",
        font=("Helvetica", 14),
        bg="#1E1E1E",
        fg="#AAAAAA",
    )
    label_subtitle.pack(pady=(0, 40))

    # Progress Bar
    style = ttk.Style()
    style.theme_use("default")
    style.configure(
        "green.Horizontal.TProgressbar",
        background="#FF5722",
        troughcolor="#333333",
        bordercolor="#1E1E1E",
    )

    progress = ttk.Progressbar(
        window,
        orient="horizontal",
        length=400,
        mode="determinate",
        style="green.Horizontal.TProgressbar",
    )
    progress.pack()

    label_status = tk.Label(
        window,
        text="Initializing...",
        font=("Consolas", 10),
        bg="#1E1E1E",
        fg="#666666",
    )
    label_status.pack(pady=(10, 0))

    # Animation
    def animate_progress():
        items = [
            "Loading configuration...",
            "Starting gateway engine...",
            "Initializing local AI models...",
            "Launching System Tray...",
        ]

        # Start OpenClaw in a separate thread so it doesn't block the UI
        try:
            threading.Thread(target=start_openclaw, daemon=True).start()
        except Exception as e:
            print(f"Error starting thread: {e}")

        # Use recursion with .after() instead of a blocking loop
        step_animation(items, 0, 0)

    def step_animation(items, item_idx, progress_val):
        if item_idx >= len(items):
            finish_startup()
            return

        label_status.config(text=items[item_idx])
        target = (item_idx + 1) * 25

        if progress_val < target:
            progress_val += 1
            progress["value"] = progress_val
            # Schedule next frame in 10ms
            window.after(10, lambda: step_animation(items, item_idx, progress_val))
        else:
            # Pause between steps (500ms)
            window.after(500, lambda: step_animation(items, item_idx + 1, progress_val))

    def finish_startup():
        # Close splash loop
        global window
        if window:
            # win.quit() stops mainloop, win.destroy() kills window
            window.quit()

    # Start animation slightly delayed
    log_launcher("show_splash: Scheduling animation...")
    window.after(100, animate_progress)
    log_launcher("show_splash: Starting mainloop...")
    window.mainloop()
    log_launcher("show_splash: Mainloop exited")

    # After mainloop finishes (window destroyed), ensure it's gone
    try:
        log_launcher("show_splash: Destroying window...")
        window.destroy()
        log_launcher("show_splash: Window destroyed")
    except Exception as e:
        log_launcher(f"show_splash: Error destroying window: {e}")

    # Start browser and tray
    log_launcher("show_splash: Starting browser and tray...")
    try:
        # Open browser helper
        log_launcher("show_splash: Starting browser thread...")
        threading.Thread(target=open_browser, daemon=True).start()
        log_launcher("show_splash: Browser thread started")
    except Exception as e:
        log_launcher(f"show_splash: Error starting browser thread: {e}")

    # Start Tray in the clean main thread
    log_launcher("show_splash: Calling create_tray_menu...")
    try:
        create_tray_menu()
    except Exception as e:
        log_launcher(f"show_splash: create_tray_menu failed: {e}")
        log_launcher(f"show_splash: Error type: {type(e).__name__}")
        import traceback

        log_launcher(f"show_splash: Traceback: {traceback.format_exc()}")


def get_token_from_config():
    import json

    try:
        config_path = os.path.expanduser("~/.openclaw/openclaw.json")
        if os.path.exists(config_path):
            with open(config_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data.get("gateway", {}).get("auth", {}).get("token")
    except Exception as e:
        print(f"Error reading config: {e}")
    return None


def open_browser():
    time.sleep(3)
    token = os.environ.get("OPENCLAW_GATEWAY_TOKEN", "")
    if not token:
        token = get_token_from_config()

    url = "http://127.0.0.1:18789/"
    if token:
        url += f"?token={token}"
    import webbrowser

    try:
        webbrowser.open(url)
    except:
        pass


def open_dashboard(icon, item):
    threading.Thread(target=open_browser, daemon=True).start()


def create_tray_menu():
    log_quit("create_tray_menu called, creating tray icon...")
    # Create menu
    menu = pystray.Menu(
        item("OpenClaw Running", lambda: None, enabled=False),
        pystray.Menu.SEPARATOR,
        item("Dashboard", open_dashboard),
        pystray.Menu.SEPARATOR,
        item("Restart", restart_openclaw),
        item("Stop", lambda icon, item: stop_openclaw(icon)),
        item("Start", lambda icon, item: start_openclaw(icon)),
        pystray.Menu.SEPARATOR,
        item("Exit", quit_app),
    )

    global tray_icon
    log_quit("Creating pystray Icon object...")
    tray_icon = pystray.Icon("OpenClaw", create_icon(), "OpenClaw Agent", menu)
    log_quit("Starting tray icon.run()...")
    tray_icon.run()


def start_tray():
    # Deprecated entry point, use create_tray_menu instead
    start_openclaw()
    create_tray_menu()


if __name__ == "__main__":
    log_launcher("=== Launcher starting ===")
    log_launcher(f"PID: {os.getpid()}, PPID: {os.getppid()}")
    log_launcher("Calling kill_existing_openclaw...")
    kill_existing_openclaw()
    log_launcher("kill_existing_openclaw complete, calling show_splash...")
    show_splash()
