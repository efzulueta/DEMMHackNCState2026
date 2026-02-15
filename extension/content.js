// content.js — With Review Window Support
console.log("[content.js] Loaded");

// ... (keep ALL your existing extraction functions - they're perfect)

// Handle messages from popup.js
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("[content.js] Received message:", msg.type);
  
  if (msg?.type === "SCAN_LISTING") {
    console.log("[content.js] Starting scan...");
    
    const base = extractFromDom();
    const ld = extractFromJsonLd() || {};
    const merged = { ...base, ...Object.fromEntries(Object.entries(ld).filter(([_,v]) => v != null)) };

    const { risk, signals } = computeRisk(merged);

    console.log("[content.js] Scan complete");
    
    sendResponse({
      ok: true,
      url: location.href,
      data: merged,
      report: { risk, signals }
    });
  }
  
  if (msg?.type === "OPEN_REVIEWS") {
    console.log("[content.js] Opening review window...");
    
    // Try multiple methods to open reviews
    let opened = false;
    
    // Method 1: Click on reviews tab
    const reviewTabs = document.querySelectorAll(
      'a[href*="reviews"], button[data-review-tab], .reviews-tab, [data-review-tab="true"]'
    );
    
    for (const tab of reviewTabs) {
      try {
        tab.click();
        opened = true;
        console.log("[content.js] Clicked reviews tab");
        break;
      } catch (e) {}
    }
    
    // Method 2: Look for "Reviews" link/button by text
    if (!opened) {
      const allLinks = document.querySelectorAll('a, button, div[role="button"]');
      for (const el of allLinks) {
        if (el.textContent.toLowerCase().includes('review')) {
          try {
            el.click();
            opened = true;
            console.log("[content.js] Clicked element with 'review' text");
            break;
          } catch (e) {}
        }
      }
    }
    
    sendResponse({ opened });
  }
  
  return true;
});