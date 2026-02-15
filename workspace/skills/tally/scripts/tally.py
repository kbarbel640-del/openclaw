#!/usr/bin/env python3
"""
Tally Prime Automation Toolkit
===============================
Single-file tool for XML API queries, data import/export, and GUI automation.
Designed to be called by AI agents via `python tally.py --file request.json`.

Usage:
  python tally.py --file request.json     # Read action from JSON file (recommended)
  python tally.py api query <xml_file>     # Raw XML API query
  python tally.py gui <action> [args...]   # GUI keyboard automation

JSON file format:
  { "action": "<action_name>", ...params }

Actions: See --help or references/api-actions.md
"""

import sys, os, json, time, struct, ctypes, ctypes.wintypes as w
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

# ─── Configuration ───────────────────────────────────────────────────────────
TALLY_URL = os.environ.get("TALLY_URL", "http://localhost:9000")
SCREENSHOT_DIR = os.environ.get("TALLY_SCREENSHOT_DIR", str(Path(__file__).parent.parent.parent.parent))  # workspace
DEFAULT_TIMEOUT = 30
GUI_DELAY = 0.15  # seconds between GUI keystrokes

# ─── XML Helpers ─────────────────────────────────────────────────────────────

def _sanitize_xml(xml_str: str) -> str:
    """Remove invalid XML character references (e.g., &#4;) that Tally sometimes produces."""
    import re
    return re.sub(r'&#([0-9]+);', lambda m: '' if int(m.group(1)) < 32 and int(m.group(1)) not in (9, 10, 13) else m.group(0), xml_str)

def _xml_escape(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")

# ─── XML API Layer ───────────────────────────────────────────────────────────

def api_post(xml_body: str, timeout: int = DEFAULT_TIMEOUT) -> str:
    """Post raw XML to Tally and return response string."""
    req = urllib.request.Request(
        TALLY_URL,
        data=xml_body.encode("utf-8"),
        method="POST",
        headers={"Content-Type": "text/xml; charset=utf-8"}
    )
    try:
        resp = urllib.request.urlopen(req, timeout=timeout)
        raw = resp.read().decode("utf-8")
        return _sanitize_xml(raw)
    except Exception as e:
        return f"ERROR: {e}"

def api_export_collection(company: str, collection_name: str, obj_type: str,
                          fields: list[str], filters: list[str] = None,
                          fetch_list: list[str] = None) -> str:
    """Export a Tally collection (ledgers, stock items, vouchers, etc.)."""
    native = "\n".join(f"<NATIVEMETHOD>{f}</NATIVEMETHOD>" for f in fields)
    fetch = ""
    if fetch_list:
        fetch = "\n".join(f"<FETCH>{f}</FETCH>" for f in fetch_list)
    filt = ""
    if filters:
        for i, f in enumerate(filters):
            filt += f'<FILTER NAME="F{i}">{f}</FILTER>\n'
    xml = f"""<ENVELOPE>
<HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>{collection_name}</ID></HEADER>
<BODY><DESC>
<STATICVARIABLES>
<SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
<SVCURRENTCOMPANY>{company}</SVCURRENTCOMPANY>
</STATICVARIABLES>
<TDL><TDLMESSAGE>
<COLLECTION NAME="{collection_name}">
<TYPE>{obj_type}</TYPE>
{native}
{fetch}
{filt}
</COLLECTION>
</TDLMESSAGE></TDL>
</DESC></BODY></ENVELOPE>"""
    return api_post(xml)

def api_export_report(company: str, report_name: str, from_date: str = None, to_date: str = None) -> str:
    """Export a Tally report (Trial Balance, Balance Sheet, etc.)."""
    date_vars = ""
    if from_date:
        date_vars += f"<SVFROMDATE>{from_date}</SVFROMDATE>\n"
    if to_date:
        date_vars += f"<SVTODATE>{to_date}</SVTODATE>\n"
    xml = f"""<ENVELOPE>
<HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Object</TYPE><ID>{report_name}</ID></HEADER>
<BODY><DESC>
<STATICVARIABLES>
<SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
<SVCURRENTCOMPANY>{company}</SVCURRENTCOMPANY>
{date_vars}
</STATICVARIABLES>
</DESC></BODY></ENVELOPE>"""
    return api_post(xml)

def api_import_voucher(company: str, voucher_xml: str) -> str:
    """Import a voucher into Tally (create/alter)."""
    xml = f"""<ENVELOPE>
<HEADER><VERSION>1</VERSION><TALLYREQUEST>Import</TALLYREQUEST><TYPE>Data</TYPE><ID>Vouchers</ID></HEADER>
<BODY><DESC>
<STATICVARIABLES>
<SVCURRENTCOMPANY>{company}</SVCURRENTCOMPANY>
</STATICVARIABLES>
</DESC>
<DATA><TALLYMESSAGE>
{voucher_xml}
</TALLYMESSAGE></DATA>
</BODY></ENVELOPE>"""
    return api_post(xml)

def api_import_master(company: str, master_xml: str) -> str:
    """Import a master object (ledger, stock item, group, etc.)."""
    xml = f"""<ENVELOPE>
<HEADER><VERSION>1</VERSION><TALLYREQUEST>Import</TALLYREQUEST><TYPE>Data</TYPE><ID>All Masters</ID></HEADER>
<BODY><DESC>
<STATICVARIABLES>
<SVCURRENTCOMPANY>{company}</SVCURRENTCOMPANY>
</STATICVARIABLES>
</DESC>
<DATA><TALLYMESSAGE>
{master_xml}
</TALLYMESSAGE></DATA>
</BODY></ENVELOPE>"""
    return api_post(xml)

def api_alter_company(company: str, settings_xml: str) -> str:
    """Alter company settings (features, options)."""
    xml = f"""<ENVELOPE>
<HEADER><VERSION>1</VERSION><TALLYREQUEST>Import</TALLYREQUEST><TYPE>Data</TYPE><ID>Company</ID></HEADER>
<BODY><DESC>
<STATICVARIABLES>
<SVCURRENTCOMPANY>{company}</SVCURRENTCOMPANY>
</STATICVARIABLES>
</DESC>
<DATA><TALLYMESSAGE>
{settings_xml}
</TALLYMESSAGE></DATA>
</BODY></ENVELOPE>"""
    return api_post(xml, timeout=60)

def api_list_companies() -> str:
    """List all companies loaded in Tally."""
    xml = """<ENVELOPE>
<HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>CompanyList</ID></HEADER>
<BODY><DESC>
<STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES>
<TDL><TDLMESSAGE>
<COLLECTION NAME="CompanyList"><TYPE>Company</TYPE><NATIVEMETHOD>Name</NATIVEMETHOD><NATIVEMETHOD>StartingFrom</NATIVEMETHOD></COLLECTION>
</TDLMESSAGE></TDL>
</DESC></BODY></ENVELOPE>"""
    return api_post(xml)

# ─── Parsed API Helpers ──────────────────────────────────────────────────────

def parse_xml_to_dicts(xml_str: str, tag: str) -> list[dict]:
    """Parse XML response into list of dicts for a given tag."""
    try:
        root = ET.fromstring(_sanitize_xml(xml_str))
    except ET.ParseError:
        return [{"_raw": xml_str}]
    results = []
    # Look for data elements (with attributes — Tally data elements have NAME attr)
    # Skip CMPINFO counter elements (they're just numbers like <STOCKITEM>202</STOCKITEM>)
    for elem in root.iter(tag):
        # Data elements have attributes (NAME, RESERVEDNAME, etc.) or child elements with TYPE attr
        if not elem.attrib and elem.text and elem.text.strip().isdigit():
            continue  # Skip CMPINFO counters
        d = {}
        name = elem.get("NAME", "")
        if not name:
            name_el = elem.find("NAME")
            if name_el is not None and name_el.text:
                name = name_el.text.strip()
        d["_NAME"] = name
        for child in elem:
            if child.text and child.text.strip():
                d[child.tag] = child.text.strip()
        if d.get("_NAME") or len(d) > 1:  # Only include if has name or meaningful data
            results.append(d)
    return results

def action_list_companies(params: dict) -> str:
    raw = api_list_companies()
    companies = parse_xml_to_dicts(raw, "COMPANY")
    if not companies or "_raw" in companies[0]:
        return raw
    lines = [f"Companies loaded in Tally ({len(companies)}):"]
    for c in companies:
        lines.append(f"  - {c.get('_NAME', '?')} (from {c.get('STARTINGFROM', '?')})")
    return "\n".join(lines)

def action_list_ledgers(params: dict) -> str:
    company = params["company"]
    raw = api_export_collection(company, "LedgerList", "Ledger",
                                ["Name", "Parent", "ClosingBalance"])
    ledgers = parse_xml_to_dicts(raw, "LEDGER")
    if not ledgers or "_raw" in ledgers[0]:
        return raw
    lines = [f"Ledgers in {company} ({len(ledgers)}):"]
    for l in ledgers:
        bal = l.get("CLOSINGBALANCE", "0")
        lines.append(f"  {l['_NAME']} [{l.get('PARENT', '')}] Bal: {bal}")
    return "\n".join(lines)

def action_list_stock_items(params: dict) -> str:
    company = params["company"]
    raw = api_export_collection(company, "SIList", "StockItem",
                                ["Name", "Parent", "BaseUnits", "ClosingBalance", "ClosingRate"])
    items = parse_xml_to_dicts(raw, "STOCKITEM")
    if not items or "_raw" in items[0]:
        return raw
    lines = [f"Stock Items in {company} ({len(items)}):"]
    for it in items:
        lines.append(f"  {it['_NAME']} | Unit: {it.get('BASEUNITS', '?')} | Closing: {it.get('CLOSINGBALANCE', '0')}")
    return "\n".join(lines)

def action_list_vouchers(params: dict) -> str:
    company = params["company"]
    vtype = params.get("voucher_type", "")
    from_date = params.get("from_date")
    to_date = params.get("to_date")
    fields = ["VoucherNumber", "Date", "VoucherTypeName", "PartyLedgerName", "Amount", "Narration"]
    fetch = ["ALLLEDGERENTRIES", "INVENTORYENTRIES", "ALLINVENTORYENTRIES"]
    raw = api_export_collection(company, "VchList", "Voucher", fields, fetch_list=fetch)
    vouchers = parse_xml_to_dicts(raw, "VOUCHER")
    if not vouchers or "_raw" in vouchers[0]:
        return raw
    # Filter by type if specified
    if vtype:
        vouchers = [v for v in vouchers if v.get("VOUCHERTYPENAME", "").lower() == vtype.lower()]
    lines = [f"Vouchers in {company} ({len(vouchers)}):"]
    for v in vouchers:
        lines.append(f"  #{v.get('VOUCHERNUMBER', '?')} | {v.get('DATE', '?')} | {v.get('VOUCHERTYPENAME', '?')} | {v.get('PARTYLEDGERNAME', '')} | {v.get('AMOUNT', '0')}")
    return "\n".join(lines)

def action_get_bom(params: dict) -> str:
    """Get Bill of Materials for stock items."""
    company = params["company"]
    item_name = params.get("item")  # optional: filter to one item
    raw = api_export_collection(company, "BOMList", "StockItem",
                                ["Name", "Parent", "BaseUnits"],
                                fetch_list=["BOMName", "BASICBOMDETAILS", "BOMQUANTITY",
                                            "BOMALTERNATEQUANTITY", "BOMITEMS", "BOMCOMPONENTS"])
    if item_name:
        # Parse and filter
        try:
            root = ET.fromstring(raw)
            # Return XML for just the matching item
            for elem in root.iter("STOCKITEM"):
                if elem.get("NAME", "").lower() == item_name.lower():
                    return ET.tostring(elem, encoding="unicode")
            return f"Item '{item_name}' not found in BOM data"
        except:
            return raw
    return raw

def action_create_voucher(params: dict) -> str:
    """Create a voucher from structured JSON."""
    company = params["company"]
    voucher_xml = params.get("voucher_xml")
    if voucher_xml:
        return api_import_voucher(company, voucher_xml)
    # Build from structured params
    vtype = params["voucher_type"]
    date = params["date"]  # YYYYMMDD
    narration = params.get("narration", "")
    entries = params.get("entries", [])
    objview = params.get("objview", "")

    objview_attr = f' OBJVIEW="{objview}"' if objview else ""
    xml_parts = [f'<VOUCHER VCHTYPE="{vtype}" ACTION="Create"{objview_attr}>']
    xml_parts.append(f"<DATE>{date}</DATE>")
    xml_parts.append(f"<EFFECTIVEDATE>{date}</EFFECTIVEDATE>")
    xml_parts.append(f"<VOUCHERTYPENAME>{vtype}</VOUCHERTYPENAME>")
    if narration:
        xml_parts.append(f"<NARRATION>{_xml_escape(narration)}</NARRATION>")

    for entry in entries:
        tag = entry.get("tag", "ALLLEDGERENTRIES.LIST")
        xml_parts.append(f"<{tag}>")
        for k, v in entry.items():
            if k == "tag":
                continue
            if k == "children":
                for child in v:
                    ctag = child.get("tag", "BATCHALLOCATIONS.LIST")
                    xml_parts.append(f"<{ctag}>")
                    for ck, cv in child.items():
                        if ck == "tag":
                            continue
                        xml_parts.append(f"<{ck}>{_xml_escape(str(cv))}</{ck}>")
                    xml_parts.append(f"</{ctag}>")
            else:
                xml_parts.append(f"<{k}>{_xml_escape(str(v))}</{k}>")
        xml_parts.append(f"</{tag}>")
    xml_parts.append("</VOUCHER>")
    return api_import_voucher(company, "\n".join(xml_parts))

def action_create_master(params: dict) -> str:
    """Create/alter a master object (ledger, stock item, group, etc.)."""
    company = params["company"]
    master_xml = params.get("master_xml")
    if master_xml:
        return api_import_master(company, master_xml)
    return "ERROR: master_xml required"

def action_raw_xml(params: dict) -> str:
    """Send raw XML to Tally."""
    xml = params.get("xml", "")
    if not xml:
        xml_file = params.get("xml_file", "")
        if xml_file and os.path.exists(xml_file):
            xml = open(xml_file).read()
        else:
            return "ERROR: xml or xml_file required"
    return api_post(xml, timeout=params.get("timeout", DEFAULT_TIMEOUT))

def action_alter_company(params: dict) -> str:
    company = params["company"]
    settings_xml = params.get("settings_xml", "")
    if not settings_xml:
        return "ERROR: settings_xml required"
    return api_alter_company(company, settings_xml)

# ─── GUI Automation Layer ────────────────────────────────────────────────────

user32 = ctypes.windll.user32

# Virtual key codes
VK = {
    "RETURN": 0x0D, "ENTER": 0x0D, "TAB": 0x09, "ESCAPE": 0x1B, "ESC": 0x1B,
    "SPACE": 0x20, "BACK": 0x08, "BACKSPACE": 0x08, "DELETE": 0x2E,
    "UP": 0x26, "DOWN": 0x28, "LEFT": 0x25, "RIGHT": 0x27,
    "HOME": 0x24, "END": 0x23, "PGUP": 0x21, "PGDN": 0x22,
    "F1": 0x70, "F2": 0x71, "F3": 0x72, "F4": 0x73, "F5": 0x74,
    "F6": 0x75, "F7": 0x76, "F8": 0x77, "F9": 0x78, "F10": 0x79,
    "F11": 0x7A, "F12": 0x7B,
    "CTRL": 0x11, "ALT": 0x12, "SHIFT": 0x10,
    "A": 0x41, "B": 0x42, "C": 0x43, "D": 0x44, "E": 0x45, "F": 0x46,
    "G": 0x47, "H": 0x48, "I": 0x49, "J": 0x4A, "K": 0x4B, "L": 0x4C,
    "M": 0x4D, "N": 0x4E, "O": 0x4F, "P": 0x50, "Q": 0x51, "R": 0x52,
    "S": 0x53, "T": 0x54, "U": 0x55, "V": 0x56, "W": 0x57, "X": 0x58,
    "Y": 0x59, "Z": 0x5A,
    "0": 0x30, "1": 0x31, "2": 0x32, "3": 0x33, "4": 0x34,
    "5": 0x35, "6": 0x36, "7": 0x37, "8": 0x38, "9": 0x39,
}

INPUT_KEYBOARD = 1
KEYEVENTF_KEYUP = 0x0002
KEYEVENTF_UNICODE = 0x0004

class KEYBDINPUT(ctypes.Structure):
    _fields_ = [("wVk", w.WORD), ("wScan", w.WORD), ("dwFlags", w.DWORD),
                ("time", w.DWORD), ("dwExtraInfo", ctypes.POINTER(ctypes.c_ulong))]

class INPUT(ctypes.Structure):
    class _INPUT(ctypes.Union):
        _fields_ = [("ki", KEYBDINPUT), ("padding", ctypes.c_ubyte * 64)]
    _fields_ = [("type", w.DWORD), ("_input", _INPUT)]

def _find_tally_hwnd() -> int:
    """Find TallyPrime window handle."""
    result = []
    def callback(hwnd, _):
        if user32.IsWindowVisible(hwnd):
            buf = ctypes.create_unicode_buffer(256)
            user32.GetWindowTextW(hwnd, buf, 256)
            title = buf.value
            if "TallyPrime" in title or "Tally.ERP" in title:
                result.append(hwnd)
        return True
    WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.POINTER(ctypes.c_int), ctypes.POINTER(ctypes.c_int))
    user32.EnumWindows(WNDENUMPROC(callback), 0)
    return result[0] if result else 0

def gui_focus() -> int:
    """Focus Tally window. Returns HWND or 0 if not found."""
    hwnd = _find_tally_hwnd()
    if not hwnd:
        print("ERROR: TallyPrime window not found")
        return 0
    user32.ShowWindow(hwnd, 9)  # SW_RESTORE
    time.sleep(0.1)
    # AttachThreadInput for reliable focus
    fg_thread = user32.GetWindowThreadProcessId(user32.GetForegroundWindow(), None)
    tally_thread = user32.GetWindowThreadProcessId(hwnd, None)
    if fg_thread != tally_thread:
        user32.AttachThreadInput(fg_thread, tally_thread, True)
    user32.SetForegroundWindow(hwnd)
    user32.BringWindowToTop(hwnd)
    if fg_thread != tally_thread:
        user32.AttachThreadInput(fg_thread, tally_thread, False)
    time.sleep(0.3)
    return hwnd

def gui_send_vk(vk_code: int, hold_ms: int = 0):
    """Send a single virtual key press/release."""
    inp = INPUT()
    inp.type = INPUT_KEYBOARD
    inp._input.ki.wVk = vk_code
    inp._input.ki.dwFlags = 0
    inp._input.ki.dwExtraInfo = ctypes.pointer(ctypes.c_ulong(0))
    user32.SendInput(1, ctypes.byref(inp), ctypes.sizeof(INPUT))
    time.sleep(hold_ms / 1000 if hold_ms else 0.05)
    inp._input.ki.dwFlags = KEYEVENTF_KEYUP
    user32.SendInput(1, ctypes.byref(inp), ctypes.sizeof(INPUT))
    time.sleep(GUI_DELAY)

def gui_send_combo(*vk_codes: int):
    """Send a key combination (e.g., Alt+D, Ctrl+A). Last key is the main key."""
    # Press modifiers
    for vk in vk_codes[:-1]:
        inp = INPUT()
        inp.type = INPUT_KEYBOARD
        inp._input.ki.wVk = vk
        inp._input.ki.dwFlags = 0
        inp._input.ki.dwExtraInfo = ctypes.pointer(ctypes.c_ulong(0))
        user32.SendInput(1, ctypes.byref(inp), ctypes.sizeof(INPUT))
        time.sleep(0.05)
    # Press main key
    gui_send_vk(vk_codes[-1])
    # Release modifiers (reverse order)
    for vk in reversed(vk_codes[:-1]):
        inp = INPUT()
        inp.type = INPUT_KEYBOARD
        inp._input.ki.wVk = vk
        inp._input.ki.dwFlags = KEYEVENTF_KEYUP
        inp._input.ki.dwExtraInfo = ctypes.pointer(ctypes.c_ulong(0))
        user32.SendInput(1, ctypes.byref(inp), ctypes.sizeof(INPUT))
        time.sleep(0.05)
    time.sleep(GUI_DELAY)

def gui_type_unicode(text: str):
    """Type text using Unicode SendInput — works in Tally's custom fields."""
    hwnd = _find_tally_hwnd()
    if not hwnd:
        print("ERROR: TallyPrime not found")
        return
    for ch in text:
        # Use WM_CHAR for Tally's custom input fields
        user32.PostMessageW(hwnd, 0x0102, ord(ch), 0)
        time.sleep(0.04)
    time.sleep(GUI_DELAY)

def gui_type_with_keyboard(text: str):
    """Type text using the `keyboard` library — most reliable for Tally fields."""
    try:
        import keyboard as kb
        kb.write(text, delay=0.03)
        time.sleep(GUI_DELAY)
    except ImportError:
        # Fallback to unicode method
        gui_type_unicode(text)

def gui_screenshot(filename: str = "tally_screenshot.png") -> str:
    """Take a screenshot of the Tally window area. Returns file path."""
    filepath = os.path.join(SCREENSHOT_DIR, filename)
    try:
        import pyautogui
        hwnd = _find_tally_hwnd()
        if hwnd:
            rect = w.RECT()
            user32.GetWindowRect(hwnd, ctypes.byref(rect))
            region = (rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top)
            img = pyautogui.screenshot(region=region)
        else:
            img = pyautogui.screenshot()
        img.save(filepath)
        print(f"Screenshot saved: {filepath}")
        return filepath
    except ImportError:
        # Fallback: full screen via ctypes + PIL
        try:
            from PIL import Image
            gdi32 = ctypes.windll.gdi32
            width = user32.GetSystemMetrics(0)
            height = user32.GetSystemMetrics(1)
            hdc_screen = user32.GetDC(0)
            hdc_mem = gdi32.CreateCompatibleDC(hdc_screen)
            hbmp = gdi32.CreateCompatibleBitmap(hdc_screen, width, height)
            gdi32.SelectObject(hdc_mem, hbmp)
            gdi32.BitBlt(hdc_mem, 0, 0, width, height, hdc_screen, 0, 0, 0x00CC0020)
            bmi = struct.pack('=lllHHllllll', 40, width, -height, 1, 24, 0, 0, 0, 0, 0, 0)
            row_sz = ((width * 3 + 3) // 4) * 4
            buf = ctypes.create_string_buffer(row_sz * height)
            gdi32.GetDIBits(hdc_mem, hbmp, 0, height, buf, bmi, 0)
            img = Image.frombytes("RGB", (width, height), buf.raw, "raw", "BGR", row_sz)
            img.save(filepath)
            gdi32.DeleteObject(hbmp)
            gdi32.DeleteDC(hdc_mem)
            user32.ReleaseDC(0, hdc_screen)
            print(f"Screenshot saved: {filepath}")
            return filepath
        except Exception as e:
            print(f"ERROR: Screenshot failed: {e}")
            return ""

def gui_parse_keys(key_string: str) -> list:
    """Parse a key sequence string into actions.
    Format: 'ESC ESC F2 type:15-02-2026 ENTER wait:500 DOWN*3 ALT+D'
    - Single keys: ESC, F2, ENTER, TAB, etc.
    - Type text:   type:hello world
    - Combos:      ALT+D, CTRL+A, CTRL+SHIFT+S
    - Repeat:      DOWN*5, TAB*3
    - Wait:        wait:500 (milliseconds)
    """
    actions = []
    tokens = key_string.split()
    i = 0
    while i < len(tokens):
        token = tokens[i]
        if token.startswith("type:"):
            # Collect everything after type: until next recognized key or end
            text = token[5:]
            i += 1
            while i < len(tokens):
                t = tokens[i].upper()
                # Check if next token is a key command
                if (t in VK or t.startswith("TYPE:") or t.startswith("WAIT:") or
                    "+" in t and all(p in VK for p in t.split("+")) or
                    "*" in t and t.split("*")[0] in VK):
                    break
                text += " " + tokens[i]
                i += 1
            actions.append(("type", text))
            continue
        elif token.startswith("wait:"):
            actions.append(("wait", int(token[5:])))
        elif "+" in token:
            parts = token.upper().split("+")
            codes = [VK[p] for p in parts if p in VK]
            if len(codes) == len(parts):
                actions.append(("combo", codes))
            else:
                print(f"WARNING: Unknown key in combo '{token}'")
        elif "*" in token:
            key, count = token.split("*", 1)
            key_upper = key.upper()
            if key_upper in VK:
                actions.append(("repeat", VK[key_upper], int(count)))
            else:
                print(f"WARNING: Unknown key '{key}'")
        else:
            key_upper = token.upper()
            if key_upper in VK:
                actions.append(("key", VK[key_upper]))
            else:
                print(f"WARNING: Unknown key '{token}'")
        i += 1
    return actions

def gui_execute_keys(key_string: str, focus: bool = True) -> str:
    """Execute a key sequence string on Tally. Returns status."""
    if focus:
        hwnd = gui_focus()
        if not hwnd:
            return "ERROR: Could not focus TallyPrime"
    actions = gui_parse_keys(key_string)
    for action in actions:
        if action[0] == "key":
            gui_send_vk(action[1])
        elif action[0] == "combo":
            gui_send_combo(*action[1])
        elif action[0] == "repeat":
            for _ in range(action[2]):
                gui_send_vk(action[1])
        elif action[0] == "type":
            gui_type_with_keyboard(action[1])
        elif action[0] == "wait":
            time.sleep(action[1] / 1000)
    return "OK"

def action_gui_keys(params: dict) -> str:
    """Execute GUI key sequence."""
    keys = params.get("keys", "")
    if not keys:
        return "ERROR: 'keys' param required"
    focus = params.get("focus", True)
    result = gui_execute_keys(keys, focus=focus)
    if params.get("screenshot"):
        time.sleep(params.get("screenshot_delay", 0.5))
        gui_screenshot(params.get("screenshot_name", "tally_after_keys.png"))
    return result

def action_gui_escape_to_gateway(params: dict) -> str:
    """Press ESC repeatedly to return to Tally Gateway."""
    count = params.get("count", 10)
    gui_focus()
    for _ in range(count):
        gui_send_vk(VK["ESCAPE"])
        time.sleep(0.2)
    time.sleep(0.3)
    if params.get("screenshot", True):
        gui_screenshot("tally_gateway.png")
    return f"Sent {count}x ESC — should be at Gateway"

def action_gui_screenshot(params: dict) -> str:
    """Take screenshot of Tally."""
    gui_focus()
    time.sleep(0.3)
    name = params.get("filename", "tally_screenshot.png")
    path = gui_screenshot(name)
    return path if path else "ERROR: Screenshot failed"

def action_gui_navigate(params: dict) -> str:
    """Navigate Tally menus using a path like 'Gateway > Display > Trial Balance'.
    Each segment is typed as a menu shortcut key or searched via typing."""
    path = params.get("path", [])
    if not path:
        return "ERROR: 'path' list required (e.g., ['D', 'Trial Balance'])"
    gui_focus()
    for i, segment in enumerate(path):
        if len(segment) == 1:
            # Single char = shortcut key
            gui_type_unicode(segment)
        elif segment.upper() in VK:
            gui_send_vk(VK[segment.upper()])
        else:
            # Multi-char = type to search in Tally's type-ahead list
            gui_type_with_keyboard(segment)
            time.sleep(0.3)
            gui_send_vk(VK["ENTER"])
        time.sleep(0.5)
    if params.get("screenshot", True):
        time.sleep(0.3)
        gui_screenshot(params.get("screenshot_name", "tally_nav.png"))
    return "OK"

# ─── Action Dispatch ─────────────────────────────────────────────────────────

ACTIONS = {
    # API actions
    "list_companies": action_list_companies,
    "list_ledgers": action_list_ledgers,
    "list_stock_items": action_list_stock_items,
    "list_vouchers": action_list_vouchers,
    "get_bom": action_get_bom,
    "create_voucher": action_create_voucher,
    "create_master": action_create_master,
    "alter_company": action_alter_company,
    "raw_xml": action_raw_xml,
    "export_report": lambda p: api_export_report(p["company"], p["report"], p.get("from_date"), p.get("to_date")),
    "export_collection": lambda p: api_export_collection(p["company"], p["collection"], p["type"], p.get("fields", ["Name"]), fetch_list=p.get("fetch")),
    # GUI actions
    "gui_keys": action_gui_keys,
    "gui_escape": action_gui_escape_to_gateway,
    "gui_screenshot": action_gui_screenshot,
    "gui_navigate": action_gui_navigate,
}

def main():
    if len(sys.argv) < 2:
        print("Usage: python tally.py --file request.json")
        print("       python tally.py <action> [json_params]")
        print(f"\nAvailable actions: {', '.join(sorted(ACTIONS.keys()))}")
        sys.exit(1)

    if sys.argv[1] == "--file":
        filepath = sys.argv[2]
        with open(filepath, "r", encoding="utf-8") as f:
            params = json.load(f)
        action = params.pop("action")
    else:
        action = sys.argv[1]
        if len(sys.argv) > 2:
            # Try to parse remaining args as JSON
            try:
                params = json.loads(" ".join(sys.argv[2:]))
            except json.JSONDecodeError:
                params = {}
        else:
            params = {}

    if action not in ACTIONS:
        print(f"ERROR: Unknown action '{action}'")
        print(f"Available: {', '.join(sorted(ACTIONS.keys()))}")
        sys.exit(1)

    result = ACTIONS[action](params)
    print(result)

if __name__ == "__main__":
    main()
