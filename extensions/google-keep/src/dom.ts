import type { Page } from "playwright";

// Unchecked checkbox elements within list items
const UNCHECKED_SELECTOR = '[role="checkbox"][aria-checked="false"]';
const WAIT_TIMEOUT_MS = 8_000;

/**
 * Extract the text of every unchecked list item visible on the page.
 * Returns an empty array when no checkboxes are found (e.g. non-list note).
 */
export async function extractUncheckedItems(page: Page): Promise<string[]> {
  try {
    await page.waitForSelector(UNCHECKED_SELECTOR, { timeout: WAIT_TIMEOUT_MS });
  } catch {
    // No unchecked checkboxes found — not a list note, or all items are checked
    return [];
  }

  return page.evaluate((selector) => {
    const items: string[] = [];
    const checkboxes = document.querySelectorAll(selector);
    for (const cb of checkboxes) {
      const listitem = cb.closest('[role="listitem"]');
      if (!listitem) continue;
      const text = (listitem.textContent ?? "").trim();
      if (text) items.push(text);
    }
    return items;
  }, UNCHECKED_SELECTOR);
}
