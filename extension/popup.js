// popup.js — MERGED VERSION with AI + Review Window
console.log("[Listing Inspector] popup.js loaded - MERGED VERSION");

const BACKEND_URL = 'http://localhost:5000/analyze';

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function el(id) { return document.getElementById(id); }

function render(resp, backendResult) {
  console.log("[Listing Inspector] render() called", { content: resp, backend: backendResult });

  const statusEl = el("status");
  const scoreEl = el("score");
  const signalsEl = el("signals");
  const rawEl = el("raw");

  if (statusEl) statusEl.textContent = "Done.";

  const risk = resp?.report?.risk ?? 0;
  const sigs = resp?.report?.signals ?? [];

  // Build HTML with AI results first
  let html = '';

  // Add AI results if they exist
  if (backendResult && backendResult.success && backendResult.results?.synthid) {
    const aiData = backendResult.results.synthid;
    const isAIDetected = aiData.is_ai_generated || false;
    const confidence = aiData.confidence || 0;
    const explanation = aiData.explanation || '';
    const indicators = aiData.indicators || [];
    
    html += `
      <div style="margin: 10px 0; padding: 12px; border-radius: 6px; background: ${isAIDetected ? '#ffebee' : '#e8f5e8'}; border-left: 4px solid ${isAIDetected ? '#f44336' : '#4caf50'};">
        <div style="font-weight: bold; margin-bottom: 5px;">🤖 AI Detection:</div>
        <div>${isAIDetected ? '⚠️ AI GENERATED' : '✅ Real Image'}</div>
        <div style="font-size: 12px; color: #666;">Confidence: ${confidence}%</div>
        ${indicators.length > 0 ? '<div style="margin-top: 8px; font-size: 11px;">Indicators:<ul>' + indicators.map(i => `<li>${i}</li>`).join('') + '</ul></div>' : ''}
        ${explanation ? `<div style="margin-top: 8px; font-size: 11px; background: white; padding: 6px; border-radius: 4px;">${explanation.substring(0, 150)}${explanation.length > 150 ? '...' : ''}</div>` : ''}
      </div>
      <hr style="margin: 10px 0;">
    `;
  }

  // Add seller signals
  if (sigs.length > 0) {
    html += `<div style="margin-top: 10px;"><strong>Seller Risk Score:</strong> ${risk}/100</div>`;
    html += '<ul style="margin: 5px 0 0 20px;">';
    sigs.forEach(s => html += `<li style="margin: 3px 0; font-size: 12px;">${s}</li>`);
    html += '</ul>';
  }

  if (signalsEl) signalsEl.innerHTML = html;
  if (scoreEl) scoreEl.innerHTML = ''; // Already included in html
  if (rawEl) rawEl.textContent = JSON.stringify({content: resp, backend: backendResult}, null, 2);
}

async function openReviewWindow(tabId) {
  console.log("[Listing Inspector] Opening review window...");
  
  // Simple click on reviews tab
  chrome.tabs.sendMessage(tabId, { type: "OPEN_REVIEWS" }, (response) => {
    if (chrome.runtime.lastError) {
      console.log("Review open failed:", chrome.runtime.lastError.message);
    } else {
      console.log("Review open result:", response);
    }
  });
}

async function runScan() {
  console.log("[Listing Inspector] Scan started");
  
  const statusEl = el("status");
  const scoreEl = el("score");
  const signalsEl = el("signals");
  const rawEl = el("raw");

  if (statusEl) statusEl.textContent = "Scanning…";
  if (scoreEl) scoreEl.textContent = "";
  if (signalsEl) signalsEl.innerHTML = "";
  if (rawEl) rawEl.textContent = "";

  const tab = await getActiveTab();
  if (!tab?.id) {
    if (statusEl) statusEl.textContent = "No active tab found.";
    return;
  }

  // First get data from content.js
  chrome.tabs.sendMessage(tab.id, { type: "SCAN_LISTING" }, async (resp) => {
    if (chrome.runtime.lastError) {
      const msg = chrome.runtime.lastError.message || "Unknown error";
      if (statusEl) statusEl.textContent = "Error: " + msg;
      if (rawEl) rawEl.textContent = JSON.stringify({ ok: false, error: msg }, null, 2);
      return;
    }

    if (!resp || typeof resp !== "object" || resp.ok !== true) {
      if (statusEl) statusEl.textContent = "Could not scan page.";
      if (rawEl) rawEl.textContent = JSON.stringify(resp, null, 2);
      return;
    }

    console.log("[Listing Inspector] Got page data with", resp.data?.images?.length, "images");
    
    if (statusEl) statusEl.textContent = "Analyzing images with AI...";
    
    // Now call your backend
    try {
      const response = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: resp.url,
          data: resp.data,
          report: resp.report
        })
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const backendResult = await response.json();
      console.log("[Listing Inspector] AI Result:", backendResult);
      
      // Show results
      render(resp, backendResult);
      
    } catch (error) {
      console.error("[Listing Inspector] Backend error:", error);
      if (statusEl) statusEl.textContent = "AI detection failed";
      render(resp, null);
    }
    
    // ALWAYS open review window at the end
    openReviewWindow(tab.id);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const btn = el("scan");
  if (!btn) return;
  btn.addEventListener("click", runScan);
});