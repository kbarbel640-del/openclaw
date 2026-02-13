/**
 * Twitter data loader for UI
 */

import { loadTwitterData } from "./controllers/twitter.ts";
import { renderTwitterView } from "./views/twitter.ts";

export async function loadAndRenderTwitter(): Promise<void> {
  // Set loading state
  (window as any).__twitter_view_html__ = '<div class="loading">Loading Twitter data...</div>';

  // Trigger re-render
  if ((window as any).__openclaw_app__?.requestUpdate) {
    (window as any).__openclaw_app__.requestUpdate();
  }

  // Load data
  const data = await loadTwitterData();

  // Render view
  (window as any).__twitter_view_html__ = renderTwitterView(data, false);

  // Trigger re-render
  if ((window as any).__openclaw_app__?.requestUpdate) {
    (window as any).__openclaw_app__.requestUpdate();
  }
}

// Auto-load when tab changes to twitter
if (typeof window !== "undefined") {
  let lastTab = "";
  setInterval(() => {
    const currentPath = window.location.pathname;
    if (currentPath.includes("/twitter") && lastTab !== "twitter") {
      lastTab = "twitter";
      void loadAndRenderTwitter();
    } else if (!currentPath.includes("/twitter")) {
      lastTab = "";
    }
  }, 500);
}
