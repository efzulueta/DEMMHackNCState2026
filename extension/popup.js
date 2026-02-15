// popup.js — FINAL FIXED VERSION
console.log("[Listing Inspector] popup.js loaded - FINAL FIXED VERSION");

const BACKEND_URL = 'http://localhost:5000/analyze';

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function el(id) { return document.getElementById(id); }

function render(resp, backendResult) {
  console.log("[Listing Inspector] render() called", { 
    content: resp, 
    backend: backendResult,
    fullBackend: JSON.stringify(backendResult, null, 2)
  });

  const statusEl = el("status");
  const scoreEl = el("score");
  const signalsEl = el("signals");
  const rawEl = el("raw");

  if (statusEl) statusEl.textContent = "Done.";

  const risk = resp?.report?.risk ?? 0;
  const sigs = resp?.report?.signals ?? [];

  let html = '';

  // DEBUG: Log what we're getting from backend
  console.log("[Listing Inspector] Backend results structure:", {
    hasResults: !!backendResult?.results,
    hasSynthid: !!backendResult?.results?.synthid,
    synthidData: backendResult?.results?.synthid
  });

  // Add AI results if they exist - CORRECTED PATH
  if (backendResult?.success && backendResult?.results?.synthid) {
    const aiData = backendResult.results.synthid;
    const isAIDetected = aiData.is_ai_generated || false;
    const confidence = aiData.confidence || 0;
    const explanation = aiData.explanation || '';
    const indicators = aiData.indicators || [];
    
    console.log("[Listing Inspector] AI Data:", { isAIDetected, confidence, indicators });
    
    let indicatorsHtml = '';
    if (indicators.length > 0) {
      indicatorsHtml = '<ul style="margin: 5px 0 0 15px; font-size: 11px;">';
      indicators.forEach(ind => {
        indicatorsHtml += `<li style="margin: 2px 0;">${ind}</li>`;
      });
      indicatorsHtml += '</ul>';
    }
    
    html += `
      <div style="margin: 10px 0 15px 0; padding: 12px; border-radius: 6px; background: ${isAIDetected ? '#ffebee' : '#e8f5e8'}; border-left: 4px solid ${isAIDetected ? '#f44336' : '#4caf50'};">
        <div style="font-weight: bold; margin-bottom: 8px; font-size: 14px;">🤖 AI IMAGE DETECTION</div>
        <div style="font-weight: bold; font-size: 16px; margin-bottom: 5px;">
          ${isAIDetected ? '⚠️ AI-GENERATED IMAGE DETECTED!' : '✅ Real Image'}
        </div>
        <div style="font-size: 13px; margin-bottom: 5px;">
          Confidence: <strong>${confidence}%</strong>
        </div>
        ${indicatorsHtml}
        ${explanation ? `
          <div style="margin-top: 8px; font-size: 11px; background: rgba(255,255,255,0.7); padding: 6px; border-radius: 4px;">
            <strong>Analysis:</strong> ${explanation}
          </div>
        ` : ''}
      </div>
      <hr style="margin: 10px 0;">
    `;
  }

  // Add seller risk score
  html += `<div style="margin: 10px 0 5px 0;"><strong>Seller Risk Score:</strong> ${risk}/100</div>`;

  // Add seller signals
  if (sigs.length > 0) {
    html += '<ul style="margin: 5px 0 0 20px;">';
    sigs.forEach(s => html += `<li style="margin: 3px 0; font-size: 12px;">${s}</li>`);
    html += '</ul>';
  } else {
    html += '<div style="color: #666; font-style: italic; font-size: 12px; margin-top: 5px;">No seller signals detected</div>';
  }

  if (signalsEl) signalsEl.innerHTML = html;
  if (scoreEl) scoreEl.innerHTML = ''; // Already included in html
  if (rawEl) rawEl.textContent = JSON.stringify({content: resp, backend: backendResult}, null, 2);
}

async function openReviewWindow(tabId) {
  console.log("[Listing Inspector] Opening review window...");
  
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: "OPEN_REVIEWS" }, (response) => {
      if (chrome.runtime.lastError) {
        console.log("[Listing Inspector] Review open error:", chrome.runtime.lastError.message);
        resolve(false);
      } else {
        console.log("[Listing Inspector] Review open result:", response);
        resolve(true);
      }
    });
  });
}

async function runScan() {
  console.log("[Listing Inspector] Scan started");
  
  const statusEl = el("status");
  const scoreEl = el("score");
  const signalsEl = el("signals");
  const rawEl = el("raw");

  if (statusEl) statusEl.textContent = "Scanning page...";
  if (scoreEl) scoreEl.textContent = "";
  if (signalsEl) signalsEl.innerHTML = '<div style="color: #666;">Loading...</div>';
  if (rawEl) rawEl.textContent = "";

  const tab = await getActiveTab();
  if (!tab?.id) {
    if (statusEl) statusEl.textContent = "No active tab found.";
    return;
  }

  // Get data from content.js
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
    
    // Call your backend
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
      
      console.log("[Listing Inspector] Backend response status:", response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const backendResult = await response.json();
      console.log("[Listing Inspector] AI Result:", backendResult);
      
      // Show results
      if (statusEl) statusEl.textContent = "Complete!";
      render(resp, backendResult);
      
    } catch (error) {
      console.error("[Listing Inspector] Backend error:", error);
      if (statusEl) statusEl.textContent = "AI detection failed";
      render(resp, null);
    }
    
    // Wait a moment then open review window
    setTimeout(() => {
      console.log("[Listing Inspector] Attempting to open reviews...");
      openReviewWindow(tab.id);
    }, 1000);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("[Listing Inspector] DOM ready");
  const btn = el("scan");
  if (!btn) return;
  btn.addEventListener("click", runScan);
});