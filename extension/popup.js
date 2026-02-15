// popup.js — FINAL WORKING VERSION
console.log("[Listing Inspector] popup.js loaded - FINAL VERSION");

const BACKEND_URL = 'http://localhost:5000/analyze';

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function el(id) { return document.getElementById(id); }

function render(resp, synthidResult) {
  console.log("[Listing Inspector] render() called", { resp, synthidResult });

  const statusEl = el("status");
  const scoreEl = el("score");
  const signalsEl = el("signals");
  const rawEl = el("raw");

  if (statusEl) statusEl.textContent = "Done.";
  if (scoreEl) scoreEl.innerHTML = `<strong>Seller Risk Score:</strong> ${resp.report?.risk ?? 0}/100`;

  let html = '';

  // Add AI results if they exist
  if (synthidResult && synthidResult.results?.synthid) {
    const aiData = synthidResult.results.synthid;
    const isAIDetected = aiData.any_ai || aiData.is_ai_generated || false;
    const confidence = aiData.results?.[0]?.confidence || aiData.confidence || 0;
    const explanation = aiData.results?.[0]?.explanation || aiData.explanation || '';
    
    html += `
      <div style="margin: 10px 0; padding: 10px; border-radius: 4px; background: ${isAIDetected ? '#ffebee' : '#e8f5e8'}; border-left: 4px solid ${isAIDetected ? '#f44336' : '#4caf50'};">
        <strong>🤖 AI Image Detection:</strong><br>
        ${isAIDetected ? '⚠️ AI DETECTED' : '✅ No AI detected'}<br>
        <small>Confidence: ${confidence}%</small>
        ${explanation ? `<br><small>${explanation.substring(0, 100)}...</small>` : ''}
      </div>
    `;
  }

  // Add seller signals
  if (resp.report?.signals?.length) {
    html += '<ul>';
    resp.report.signals.forEach(s => html += `<li>${s}</li>`);
    html += '</ul>';
  }

  if (signalsEl) signalsEl.innerHTML = html;
  if (rawEl) rawEl.textContent = JSON.stringify({content: resp, backend: synthidResult}, null, 2);
}

async function runScan() {
  console.log("[Listing Inspector] 🔍 Scan started");
  
  const statusEl = el("status");
  const signalsEl = el("signals");
  const scoreEl = el("score");
  const rawEl = el("raw");

  if (statusEl) statusEl.textContent = "Step 1: Getting page data...";
  if (signalsEl) signalsEl.innerHTML = "Loading...";
  if (scoreEl) scoreEl.innerHTML = "";
  if (rawEl) rawEl.textContent = "";

  // Get active tab
  const tab = await getActiveTab();
  console.log("[Listing Inspector] Tab:", tab?.url);
  
  if (!tab?.id) {
    if (statusEl) statusEl.textContent = "Error: No active tab";
    return;
  }

  // Get data from content.js
  chrome.tabs.sendMessage(tab.id, { type: "SCAN_LISTING" }, async (resp) => {
    if (chrome.runtime.lastError) {
      console.error("[Listing Inspector] Error:", chrome.runtime.lastError);
      if (statusEl) statusEl.textContent = "Error: " + chrome.runtime.lastError.message;
      return;
    }

    console.log("[Listing Inspector] Content response:", resp);
    
    if (!resp?.ok) {
      if (statusEl) statusEl.textContent = "Error: Could not scan page";
      return;
    }

    console.log("[Listing Inspector] ✅ Got page data with", resp.data?.images?.length, "images");
    
    if (statusEl) statusEl.textContent = `Step 2: Analyzing ${resp.data?.images?.length || 0} images...`;
    
    // CALL THE BACKEND - THIS IS THE CRITICAL PART
    try {
      console.log("[Listing Inspector] 📡 Sending to backend:", BACKEND_URL);
      
      const payload = {
        url: resp.url,
        data: resp.data,
        report: resp.report
      };
      
      console.log("[Listing Inspector] Payload images:", resp.data?.images);
      
      const response = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      console.log("[Listing Inspector] Backend response status:", response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const backendResult = await response.json();
      console.log("[Listing Inspector] ✅ Backend result:", backendResult);
      
      if (statusEl) statusEl.textContent = "Complete!";
      render(resp, backendResult);
      
    } catch (error) {
      console.error("[Listing Inspector] ❌ Backend error:", error);
      if (statusEl) statusEl.textContent = "Error: Backend not reachable - is python app.py running?";
      render(resp, null);
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("[Listing Inspector] DOM ready");
  const btn = el("scan");
  if (btn) {
    btn.addEventListener("click", runScan);
    console.log("[Listing Inspector] ✅ Scan button ready");
  }
});