---
name: printing-guitar-tabs
description: Prints guitar tabs from Ultimate Guitar as a scaled PDF (max 3 pages, single-sided). Use when printing tabs, creating tab PDFs, or getting chord sheets printed.
invocation: user
arguments: "<url>"
---

# Printing Guitar Tabs

Automates printing Ultimate Guitar tabs scaled to fit 3 pages max.

## Quick Reference

| Step | Action                               |
| ---- | ------------------------------------ |
| 1    | Navigate to tab URL                  |
| 2    | Wait for tab content to load         |
| 3    | Generate scaled PDF via print dialog |
| 4    | Print single-sided                   |

## Workflow

### Step 1: Navigate to Tab

```
Use browser_navigate to go to the Ultimate Guitar tab URL provided as argument.
```

### Step 2: Wait for Content

Wait for the tab content to fully load. Look for the `<code>` element containing the tab/chord content.

### Step 3: Generate PDF

Use Playwright to trigger the print dialog with scaling to fit 3 pages:

```javascript
await page.pdf({
  path: "/tmp/guitar-tab.pdf",
  format: "Letter",
  printBackground: true,
  scale: 0.6, // Adjust to fit content
  margin: {
    top: "0.5in",
    bottom: "0.5in",
    left: "0.5in",
    right: "0.5in",
  },
});
```

### Step 4: Print PDF

Print the generated PDF single-sided:

```bash
lpr -o sides=one-sided /tmp/guitar-tab.pdf
```

## Implementation

Execute this code block:

```javascript
// Playwright code to generate PDF
async (page) => {
  // Wait for tab content
  await page.waitForSelector("code", { timeout: 10000 });

  // Hide ads and non-essential elements
  await page.evaluate(() => {
    const selectors = [
      "iframe",
      '[class*="ad"]',
      '[class*="banner"]',
      "header",
      "footer",
      '[class*="sidebar"]',
      '[class*="related"]',
      '[class*="comment"]',
    ];
    selectors.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => (el.style.display = "none"));
    });
  });

  // Generate PDF scaled to fit ~3 pages
  await page.pdf({
    path: "/tmp/guitar-tab.pdf",
    format: "Letter",
    printBackground: false,
    scale: 0.55,
    margin: {
      top: "0.4in",
      bottom: "0.4in",
      left: "0.4in",
      right: "0.4in",
    },
  });

  return "/tmp/guitar-tab.pdf";
};
```

Then print:

```bash
lpr -o sides=one-sided /tmp/guitar-tab.pdf
```

## Scaling Guide

| Tab Length         | Scale |
| ------------------ | ----- |
| Short (1-2 pages)  | 0.7   |
| Medium (3-4 pages) | 0.55  |
| Long (5+ pages)    | 0.45  |

Adjust scale if PDF exceeds 3 pages.

## Verification

1. Check PDF was created: `ls -la /tmp/guitar-tab.pdf`
2. Check page count: `pdfinfo /tmp/guitar-tab.pdf | grep Pages`
3. If >3 pages, reduce scale and regenerate

## Troubleshooting

| Issue              | Fix                                     |
| ------------------ | --------------------------------------- |
| Tab not loading    | Check URL is valid Ultimate Guitar link |
| PDF too many pages | Reduce scale value                      |
| Print queue error  | Run `lpstat -p` to check printer status |
| Missing content    | Increase page.waitForSelector timeout   |
