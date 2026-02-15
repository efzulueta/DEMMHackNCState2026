// popup.js — COMPLETE WORKING VERSION for YOUR branch
console.log("[Listing Inspector] popup.js loaded - WORKING VERSION");

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
    const indicators = aiData.results?.[0]?.indicators || aiData.indicators || [];
    
    let indicatorsHtml = '';
    if (indicators.length > 0) {
      indicatorsHtml = '<ul style="margin-top: 5px; font-size: 11px;">';
      indicators.forEach(ind => {
        indicatorsHtml += `<li>${ind}</li>`;
      });
      indicatorsHtml += '</ul>';
    }
    
    html += `
      <div style="margin: 15px 0; padding: 15px; border-radius: 6px; background: ${isAIDetected ? '#ffebee' : '#e8f5e8'}; border-left: 4px solid ${isAIDetected ? '#f44336' : '#4caf50'}; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <div style="display: flex; align-items: center; margin-bottom: 8px;">
          <span style="font-size: 20px; margin-right: 8px;">🤖</span>
          <strong style="font-size: 16px;">AI Image Analysis</strong>
        </div>
        
        <div style="font-weight: bold; margin: 10px 0; font-size: 16px;">
          ${isAIDetected ? '⚠️ AI-GENERATED IMAGE DETECTED!' : '✅ No AI Generation Detected'}
        </div>
        
        <div style="margin: 5px 0;">
          <span style="background: ${isAIDetected ? '#ffcdd2' : '#c8e6c9'}; padding: 3px 8px; border-radius: 12px; font-size: 12px;">
            Confidence: ${confidence}%
          </span>
        </div>
        
        ${indicatorsHtml}
        
        ${explanation ? `
          <div style="margin-top: 10px; font-size: 12px; color: #555; background: rgba(255,255,255,0.5); padding: 8px; border-radius: 4px;">
            <strong>📝 Analysis:</strong><br>
            ${explanation}
          </div>
        ` : ''}
        
        <div style="margin-top: 10px; font-size: 11px; color: #999;">
          📸 Images: ${aiData.images_analyzed || 1}/${aiData.total_images || resp.data?.images?.length || 0}
        </div>
      </div>
      <hr style="margin: 15px 0; border: none; border-top: 1px solid #ddd;">
    `;
  }

  // Add seller signals
  if (resp.report?.signals?.length) {
    html += '<strong>📋 Seller Signals:</strong><ul style="margin: 8px 0 0 20px;">';
    resp.report.signals.forEach(s => html += `<li style="margin: 4px 0; font-size: 12px;">${s}</li>`);
    html += '</ul>';
  } else {
    html += '<div style="color: #999; font-style: italic; font-size: 12px;">No seller signals detected</div>';
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
  if (signalsEl) signalsEl.innerHTML = '<div style="color: #666; font-style: italic;">Loading...</div>';
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
  console.log("[Listing Inspector] Getting data from content.js...");
  
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
    
    if (statusEl) statusEl.textContent = `Step 2: Analyzing ${resp.data?.images?.length || 0} images with AI...`;
    
    // Call the backend
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
      
      // Show results
      if (statusEl) statusEl.textContent = "Complete!";
      render(resp, backendResult);
      
    } catch (error) {
      console.error("[Listing Inspector] ❌ Backend error:", error);
      if (statusEl) statusEl.textContent = "AI analysis failed - is backend running?";
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