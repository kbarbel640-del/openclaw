# Dopamine Depot - Test Print Plan
## PixCut S1 Quality Control Protocol

---

## Pre-Print Checklist

### Materials
- [ ] Vinyl sticker paper (4x7" sheets or letter cut to size)
- [ ] Printer loaded and calibrated
- [ ] PixCut S1 powered and connected
- [ ] Test print file: `batch-print-sheet.png` loaded

### File Verification
- [ ] File dimensions: 1200x2100 pixels confirmed
- [ ] DPI metadata: 300 DPI verified
- [ ] Color mode: RGB (printer will convert to CMYK)
- [ ] No transparency issues (white background confirmed)

---

## Print Quality Criteria

### Color Accuracy (Pass/Fail)
| Sticker | Target Colors | Tolerance | QC Method |
|---------|---------------|-----------|-----------|
| 01-bug-feature | Black/Yellow/Cyan | ±10% hue shift | Visual compare to screen |
| 02-hyperfocus | Purple/Blue/Pink/White | ±15% saturation | Side-by-side check |
| 03-dopamine-loading | Black/Neon Green/White | Green must be vibrant | Brightness check |
| 04-will-code | Navy/Orange/White/Gray | Navy should be deep | Density check |
| 05-overwhelmed | Black/Red/Off-white | Red must pop | Contrast check |

### Cut Precision (Pass/Fail)
- [ ] Clean cuts through sticker layer, not backing
- [ ] No jagged edges on curves
- [ ] Registration marks align (if using)
- [ ] Kiss-cut depth test: Peel test on one sticker

### Adhesion Test (Pass/Fail)
- [ ] Stick to clean laptop surface
- [ ] No bubbling when applied
- [ ] Clean removal test (if removable vinyl)
- [ ] Edge lift test (24-hour wait recommended)

---

## Test Print Procedure

### Step 1: Single Sticker Test
1. Print one copy of `batch-print-sheet.png`
2. Load into PixCut S1
3. Run standard die-cut setting
4. Inspect cut quality immediately

### Step 2: QC Evaluation
- Photograph printed sheet
- Compare colors to source files
- Test adhesion on target surface
- Document any issues

### Step 3: Pass/Fail Decision
- **PASS:** All criteria met → proceed to batch production
- **FAIL:** Document specific issues → adjust and re-test

---

## Common Issues & Fixes

| Issue | Likely Cause | Fix |
|-------|--------------|-----|
| Colors too dark | CMYK conversion | Brighten source 15-20% |
| Cut too deep | Blade pressure too high | Reduce pressure 10-20% |
| Cut too shallow | Blade dull/pressure low | Replace blade or increase pressure |
| Edge lifting | Material quality | Use higher-tack vinyl |
| Blurry print | Low-res source | Verify 300 DPI file |

---

## Batch Production Notes

### Optimal Batch Size
- Start with 10 sheets for market test
- Scale based on demand signals

### Storage
- Flat storage in cool, dry place
- Avoid direct sunlight (colors may fade)
- Use protective sheet between stacks

### Cost Tracking
| Item | Cost per Unit | Notes |
|------|---------------|-------|
| Vinyl paper | $___ | Record actual |
| Ink | $___ | Per sheet calc |
| Cutting time | $___ | Machine wear |
| **Total** | $___ | Target: <$0.50/sticker |

---

## Sign-Off

**Test Print Date:** _______________  
**Printed By:** _______________  
**QC Result:** ☐ PASS ☐ FAIL  
**Notes:** _________________________________  
_________________________________

**Next Steps:**
- [ ] Proceed to batch production
- [ ] Adjust and re-test
- [ ] Document changes made
