# Tally Prime GUI Automation — Complete Reference

> Goal: Full keyboard+mouse automation of TallyPrime from a service session.
> This document will become the foundation for a TallyPrime skill.

## Environment & Architecture
- **TallyPrime EDU** running in user's interactive desktop session
- **OpenClaw** runs as a Windows service (different session, Session 0)
- Tally is a **single-window app with ZERO child windows** — entire UI is custom-drawn
- Window class: standard Win32, title "TallyPrime"
- All UI elements (menus, fields, buttons, lists) are painted inside one HWND

## Connection Method
```python
import ctypes, ctypes.wintypes as w
user32 = ctypes.windll.user32

# Find Tally window dynamically
def find_tally():
    result = []
    def callback(hwnd, _):
        if user32.IsWindowVisible(hwnd):
            length = user32.GetWindowTextLengthW(hwnd)
            if length > 0:
                buf = ctypes.create_unicode_buffer(length + 1)
                user32.GetWindowTextW(hwnd, buf, length + 1)
                if 'tally' in buf.value.lower():
                    result.append((hwnd, buf.value))
        return True
    WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, w.HWND, w.LPARAM)
    user32.EnumWindows(WNDENUMPROC(callback), 0)
    return result
```

---

## What WORKS ✅

### 1. WM_CHAR (0x0102) — Text & Menu Shortcuts
```python
user32.PostMessageW(HWND, 0x0102, ord('K'), 0)  # Send character 'K'
```
- **Menu shortcuts**: Single letters that trigger menu items (the bold/underlined letter)
- **Text input**: Types into active text fields (date fields, name fields, search)
- **Y/N dialogs**: WM_CHAR 'Y' = Yes, 'N' = No
- Case matters: 'K' and 'k' may behave differently

### 2. WM_KEYDOWN/WM_KEYUP (0x0100/0x0101) — Navigation & F-Keys
```python
scan = user32.MapVirtualKeyW(vk, 0)
lparam_down = (scan << 16) | 1
lparam_up = (scan << 16) | 1 | (1 << 30) | (1 << 31)
user32.PostMessageW(HWND, 0x0100, vk, lparam_down)
time.sleep(0.05)
user32.PostMessageW(HWND, 0x0101, vk, lparam_up)
```
Working keys:
- **VK_RETURN (0x0D)** — Enter/confirm/open voucher
- **VK_ESCAPE (0x1B)** — Back/cancel/close dialog
- **VK_DOWN (0x28)** — Navigate down in lists
- **VK_UP (0x26)** — Navigate up in lists  
- **VK_LEFT (0x25)** — Navigate left
- **VK_RIGHT (0x27)** — Navigate right
- **F1 (0x70)** — Help (context-dependent)
- **F2 (0x71)** — Change Date / Period
- **F3-F12** — Context-dependent (voucher type switching, etc.)

### 3. PrintWindow — Screenshots
```python
user32.PrintWindow(HWND, hdc_mem, 2)  # flag 2 = PW_RENDERFULLCONTENT
```
- Works cross-session! Captures actual rendered Tally content
- Save as BMP via GetDIBits → convert to PNG with PIL
- Essential for "seeing" what's on screen

### 4. WM_LBUTTONDOWN/UP — Mouse Clicks ⭐ KEY BREAKTHROUGH
```python
WM_LBUTTONDOWN = 0x0201
WM_LBUTTONUP = 0x0202
lParam = (y << 16) | (x & 0xFFFF)  # coordinates relative to CLIENT AREA
user32.PostMessageW(HWND, WM_LBUTTONDOWN, 1, lParam)  # 1 = MK_LBUTTON
time.sleep(0.05)
user32.PostMessageW(HWND, WM_LBUTTONUP, 0, lParam)
```
- **This unlocks everything** that modifier keys can't do
- Bottom bar buttons (Delete, Accept, Cancel Vch) all clickable
- Right panel buttons (F-key shortcuts) clickable  
- Any UI element can be clicked by coordinate
- Use `GetClientRect` to get client area dimensions for coordinate calculation

---

## What DOESN'T WORK ❌

### Modifier Key Combos (Ctrl+X, Alt+X)
- **WM_SYSKEYDOWN/UP with Alt flag** → no effect
- **WM_CHAR with Ctrl codes (chr(1)-chr(26))** → no effect
- **WM_KEYDOWN Ctrl + WM_KEYDOWN letter** → no effect
- **keybd_event** → cross-session blocked
- **SendInput** → returns 0 (cross-session blocked)
- **ROOT CAUSE**: Tally uses `GetKeyState`/`GetAsyncKeyState` to check modifiers
- These check actual hardware keyboard state, not message queue
- **WORKAROUND**: Click the button via WM_LBUTTONDOWN instead!

### Screen-wide Screenshots
- `GetDC(0)` + `BitBlt` captures Session 0 desktop (black)
- Use `PrintWindow` on Tally's HWND instead

---

## Gateway of Tally — Main Screen

### Menu Structure (shortcut letters shown in **bold**)
```
Top Bar:
  K: Company | Y: Data | Z: Exchange | G: Go To | O: Import | E: Export | M: Share | P: Print | F1: Help

Right Panel:
  F2: Date | F3: Company

Main Menu (center/right):
  MASTERS
    Create ........... C
    Alter ............ A  
    CHart of Accounts. H (second letter)

  TRANSACTIONS
    Vouchers ......... V
    Day BooK ......... K

  UTILITIES
    BaNking .......... N

  REPORTS
    Balance Sheet .... B
    Profit & Loss A/c  P (lowercase 'p')
    Stock Summary .... S
    Ratio Analysis ... R
    Display More Reports . p (same as P&L? need to verify)
    DashbOard ........ O

  Quit ............... Q (triggers "Quit? Yes or No" dialog)
```

### Key Observations
- First Escape at Gateway → "Quit?" dialog (be careful!)
- Pressing N or Escape at "Quit?" → returns to Gateway
- Current Date and Current Period shown at top
- Company name with (e) marker = "Data exceptions exist"

---

## Day Book Screen (K from Gateway)

### Layout
- Header: "Day Book" | Company name | "For DD-Mon-YY"
- Columns: Date | Particulars | Vch Type | Vch No. | Debit Amount/Inwards Qty | Credit Amount/Outwards Qty
- First entry is auto-selected (highlighted yellow)

### Right Panel Buttons
- F2: Date (change date to view different day's entries)
- F3: Company
- F4: Voucher Type (filter by type)
- F5, F6: (context-dependent)
- F7: Show Profit
- F8: Columnar
- F9, F10: (context-dependent)
- B: Basis of Values
- H: Change View
- J: Exception Reports
- L: Save View
- E: Apply Filter / Filter Details

### Bottom Bar Actions
- **Q**: Quit (back to Gateway)
- **Enter**: Alter (open selected voucher for editing)
- **Space**: Select (toggle selection)
- **A**: Add Vch (create new voucher)
- **2**: Duplicate Vch
- **I**: Insert Vch
- **D**: Delete ← MUST USE MOUSE CLICK (modifier shortcut)
- **X**: Cancel Vch ← MUST USE MOUSE CLICK
- **R**: Remove Line ← MUST USE MOUSE CLICK
- **U**: Restore Line ← MUST USE MOUSE CLICK
- **F12**: Configure

### Navigation
- Arrow Up/Down: move between voucher entries
- Enter: open selected voucher in alteration mode
- Escape: go back to Gateway
- F2: change the display date (opens date picker dialog)

### Delete Workflow (TESTED & WORKING)
1. Navigate to voucher with Down/Up arrows
2. Click "D: Delete" button in bottom bar via mouse click
3. "Delete?" Yes/No dialog appears
4. Send WM_CHAR 'Y' to confirm
5. Voucher is deleted, list updates

---

## Voucher Alteration Screen (Enter from Day Book)

### Layout
- Header: "Inventory Voucher Alteration (Secondary)" | Company
- Sub-header: Voucher type badge + "No. XX" + Date
- Manufacturing Journal view: "Manufacture of Materials"
  - Name of product, Qty, % of Cost allocation
  - Components (Consumption): Name of Item, Quantity, Rate, Amount
  - Co-Product/By-Product/Scrap: Name of Item, % of Cost, Quantity, Rate, Amount
  - Bottom: Cost of components, Type of Additional Cost, Percentage
  - Total Addl. Cost, Effective Cost, Allocation to Primary Item, Effective rate
- Narration field at very bottom (above button bar)

### Right Panel (Voucher type switching)
- F2: Date
- F3: Company
- F4: Contra
- F5: Payment
- F6: Receipt
- F7: Journal
- F8: Sales
- F9: Purchase
- F10: Other Vouchers
- E: Autofill
- H: Change Mode
- I: More Details
- Q: Related Reports
- L: Optional
- T: Post-Dated

### Bottom Bar Actions
- **Q**: Quit
- **A**: Accept (save changes) ← MOUSE CLICK
- **D**: Delete ← MOUSE CLICK
- **X**: Cancel Vch ← MOUSE CLICK
- **F12**: Configure

### Navigation inside Voucher
- Down arrow moves between fields within the voucher (NOT next voucher)
- Escape exits back to Day Book WITHOUT saving
- Enter within fields moves to next field
- Tab may also work for field navigation (needs testing)

---

## Voucher Creation Screen (V from Gateway)

### Layout
- Same as alteration but in "Inventory Voucher Creation" mode
- Shows "No. XX" (next auto-number)
- Empty fields ready for input
- "Name of product:" has active text field (yellow highlight)

### Right Panel (same as alteration + voucher type switching)
- F4-F10 switch voucher types (Contra, Payment, Receipt, Journal, Sales, Purchase, Other)
- F2: Date, F3: Company
- H: Change Mode, I: More Details, E: Autofill
- Q: Related Reports, L: Optional, T: Post-Dated

### Bottom Bar
- Q: Quit | A: Accept | D: Delete | X: Cancel Vch | F12: Configure

---

## Profit & Loss Screen (p from Gateway)

### Layout
- Two-column format: Left side (expenses) | Right side (income)
- Left: Opening Stock, Purchase Accounts, Direct Expenses → Gross Profit c/o → Indirect Expenses → Nett Profit
- Right: Sales Accounts, Closing Stock → Gross Profit b/f
- Total at bottom (balanced)
- Period shown: "1-Apr-25 to 14-Feb-26"

### Right Panel
- F2: Period, F3: Company
- F8: Valuation
- B: Basis of Values, H: Change View
- J: Exception Reports, L: Save View
- E: Apply Filter / Filter Details
- C: New Column, A: Alter Column, D: Delete Column, N: Auto Column

### Bottom Bar
- Q: Quit | Space: Select | R: Remove Line | U: Restore Line | F12: Configure

---

## Date Change Dialog (F2)

### Layout
- Small popup: "Current Date" or "Change Date" with text field
- Shows date in D-M-YYYY format (e.g., "1-7-2025")

### Input
- Text typed via WM_CHAR replaces the date
- Enter should confirm (needs more testing — may need click on Accept)
- Escape cancels and reverts

### Notes
- From Gateway: F2 shows "Change Current Date" (affects Tally's working date)
- From Day Book: F2 shows "Change Date" (affects which day's entries to display)
- From reports: F2 may show "Period" picker

---

## Dialog Patterns

### Yes/No Confirmation
- Appears for: Delete, Quit, destructive actions
- Text: "Delete?" or "Quit?" with "Yes or No" at bottom
- **WM_CHAR 'Y'** → confirms (Yes)
- **WM_CHAR 'N'** → cancels (No)
- **Escape** → same as No

### List/Dropdown Selection
- Appears when selecting stock items, ledgers, voucher types
- Arrow keys navigate
- Enter selects
- Typing filters the list (autocomplete)
- Escape cancels

---

## Bottom Bar Button Coordinates

The bottom bar spans the full width of the client area, ~20px tall at the very bottom.
Client area: 864x1565 (when Tally is in its tall layout).

Approximate X positions for bottom bar buttons (Day Book):
| Button | Approx X range | Center X |
|--------|---------------|----------|
| Q: Quit | 0-65 | 30 |
| Enter: Alter | 70-140 | 105 |
| Space: Select | 145-210 | 175 |
| A: Add Vch | 215-280 | 248 |
| 2: Duplicate | 285-360 | 322 |
| I: Insert Vch | 365-430 | 397 |
| D: Delete | 435-510 | 473 |
| X: Cancel Vch | 515-580 | 548 |
| R: Remove Line | 585-660 | 623 |
| U: Restore Line | 665-730 | 698 |
| F12: Configure | 770-864 | 820 |

**Y coordinate**: `client_height - 10` (bottom bar center)

⚠️ These are approximate — always capture and verify. Button positions shift based on window width.

---

## Timing & Reliability

### Recommended Delays
- Between keystrokes: 50-100ms
- After WM_CHAR menu action: 300-500ms (wait for screen to change)
- After Enter/Escape: 200-300ms
- After mouse click: 300ms
- Before screenshot capture: 300-500ms (let Tally render)

### Reliability Notes
- WM_CHAR is very reliable for single characters
- WM_KEYDOWN for navigation keys is reliable
- Mouse clicks are reliable but coordinate-dependent
- Always capture screenshot after action to verify result
- Tally may lag under load — increase delays if needed

---

## Screen Detection (How to Know Where You Are)

Since we can capture screenshots, we need OCR or pixel analysis to detect current screen.
Key indicators in the header bar (top ~100px):

| Screen | Header Text |
|--------|------------|
| Gateway | "Gateway of Tally" |
| Day Book | "Day Book" |
| Voucher Creation | "Inventory Voucher Creation" |
| Voucher Alteration | "Inventory Voucher Alteration (Secondary)" |
| P&L | "Profit & Loss A/c" |
| Balance Sheet | "Balance Sheet" |
| Stock Summary | "Stock Summary" |
| Change Date | "Change Current Date" or "Change Date" |
| Quit Dialog | "Quit ?" text in center |
| Delete Dialog | "Delete ?" text in center |

---

## TODO — Still Need to Test
- [ ] Text input into voucher fields (product name, quantity, rate)
- [ ] Dropdown/list selection (stock item picker, ledger picker)
- [ ] Backspace to clear field before typing
- [ ] Tab key behavior in forms
- [ ] Page Up/Down in long lists
- [ ] Home/End keys
- [ ] Space bar in lists (select/deselect)
- [ ] Right-click / WM_CONTEXTMENU
- [ ] Alter menu (A from Gateway) → sub-menus
- [ ] Create menu (C from Gateway) → sub-menus
- [ ] Stock Summary navigation (S from Gateway)
- [ ] Balance Sheet navigation (B from Gateway)
- [ ] F11 (Features/Company Features)
- [ ] F12 (Configure) screens
- [ ] Multiple company switching (F3)
- [ ] Go To (G) functionality
- [ ] Search (Alt+F) functionality
- [ ] Export (E) functionality
- [ ] Print (P) functionality

---

## Utility Scripts Reference
| Script | Purpose |
|--------|---------|
| `tally_test_gui.py` | Swiss-army knife: send any key/char/fkey + auto-capture |
| `tally_click.py` | Click at specific coordinates + capture |
| `tally_capture.py` | Just capture screenshot (no actions) |
| `tally_ctrl_test.py` | Test Ctrl/Alt combos (for research) |
| `tally_nav.py` | Navigation helper (PostMessage-based) |

---

## Key Lessons
1. **Tally is a single-window custom-drawn app** — no child windows, no standard controls
2. **PostMessage works cross-session** for WM_CHAR, WM_KEYDOWN, WM_LBUTTONDOWN
3. **Modifier keys DON'T work** via PostMessage (Tally checks GetKeyState)
4. **Mouse clicks are the universal workaround** for any button that needs modifiers
5. **PrintWindow captures the actual rendered content** even from Session 0
6. **Always screenshot after action** to verify the result
7. **Escape at Gateway = Quit dialog** — be careful with escape count
8. **Tally's date format**: D-M-YYYY (e.g., 1-7-2025 for July 1, 2025)
