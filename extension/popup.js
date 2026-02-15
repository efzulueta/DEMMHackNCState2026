// popup.js — vFINAL-2026-02-14-06 - DEFINITELY CALLS BACKEND
console.log("[Listing Inspector] popup.js loaded vFINAL-2026-02-14-06");

// Configuration - your backend URL
const BACKEND_URL = 'http://localhost:5000/analyze';

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function el(id) { return document.getElementById(id); }

function render(resp, synthidResult) {
  console.log("[Listing Inspector] render() called", { content: resp, backend: synthidResult });

  const statusEl = el("status");
  const scoreEl = el("score");
  const signalsEl = el("signals");
  const rawEl = el("raw");

  if (statusEl) statusEl.textContent = "Done.";

  // Show seller risk score
  const risk = resp?.report?.risk ?? 0;
  const sigs = resp?.report?.signals ?? [];

  let html = '';

  // Add SynthID/AI results FIRST if they exist
  if (synthidResult && synthidResult.success && synthidResult.results?.synthid) {
    const aiData = synthidResult.results.synthid;
    console.log("[Listing Inspector] AI Data:", aiData);
    
    const isAIDetected = aiData.is_ai_generated === true;
    const confidence = aiData.confidence || 0;
    const indicators = aiData.indicators || [];
    const explanation = aiData.explanation || 'No explanation provided';
    const imagesAnalyzed = aiData.images_analyzed || 1;
    const totalImages = aiData.total_images || resp?.data?.images?.length || 0;
    
    html += `
      <div style="margin: 15px 0; padding: 15px; border-radius: 6px; background-color: ${isAIDetected ? '#ffebee' : '#e8f5e8'}; border-left: 4px solid ${isAIDetected ? '#f44336' : '#4caf50'};">
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
    `;
    
    if (indicators.length > 0) {
      html += `
        <div style="margin-top: 15px;">
          <strong style="color: #d32f2f;">🚩 AI Indicators Found:</strong>
          <ul style="margin: 5px 0 0 20px;">
            ${indicators.map(ind => `<li style="font-size: 12px; margin: 3px 0;">${ind}</li>`).join('')}
          </ul>
        </div>
      `;
    }
    
    if (explanation && explanation !== 'No explanation provided') {
      html += `
        <div style="margin-top: 15px; background: rgba(255,255,255,0.5); padding: 10px; border-radius: 4px;">
          <strong>📝 Detailed Analysis:</strong>
          <div style="margin-top: 5px; font-size: 12px; color: #555; line-height: 1.5;">
            ${explanation.substring(0, 200)}${explanation.length > 200 ? '...' : ''}
          </div>
        </div>
      `;
    }
    
    html += `
        <div style="margin-top: 10px; font-size: 11px; color: #999; display: flex; justify-content: space-between;">
          <span>📸 Images: ${imagesAnalyzed}/${totalImages}</span>
          <span>🔍 ${aiData.method || 'full_analysis'}</span>
        </div>
      </div>
      <hr style="margin: 15px 0; border: none; border-top: 1px solid #ddd;">
    `;
  } else if (synthidResult && !synthidResult.success) {
    html += `
      <div style="margin: 15px 0; padding: 15px; border-radius: 6px; background-color: #fff3e0; border-left: 4px solid #ff9800;">
        <div>⚠️ AI Detection Error: ${synthidResult.error || 'Unknown error'}</div>
      </div>
      <hr>
    `;
  }
  
  // Add seller risk score
  html += `<div style="margin-bottom: 15px; padding: 10px; background: #f5f5f5; border-radius: 4px;">
    <strong>📊 Seller Risk Score:</strong> ${risk}/100
  </div>`;
  
  // Add seller signals
  if (sigs.length > 0) {
    html += '<strong>📋 Seller Signals:</strong><ul style="margin: 8px 0 0 20px;">';
    sigs.forEach(s => html += `<li style="margin: 4px 0; font-size: 12px;">${s}</li>`);
    html += '</ul>';
  }
  
  if (signalsEl) signalsEl.innerHTML = html;
  if (rawEl) rawEl.textContent = JSON.stringify({ content: resp, backend: synthidResult }, null, 2);
}

async function runScan() {
  console.log("[Listing Inspector] 🔍 Scan started");
  
  const statusEl = el("status");
  const signalsEl = el("signals");
  const rawEl = el("raw");

  if (statusEl) statusEl.textContent = "Step 1: Getting page data...";
  if (signalsEl) signalsEl.innerHTML = "Loading...";
  if (rawEl) rawEl.textContent = "";

  // Get active tab
  const tab = await getActiveTab();
  console.log("[Listing Inspector] Active tab:", tab?.url);
  
  if (!tab?.id) {
    if (statusEl) statusEl.textContent = "Error: No active tab";
    return;
  }

  // Get data from content.js
  if (statusEl) statusEl.textContent = "Step 2: Scanning Etsy page...";
  
  chrome.tabs.sendMessage(tab.id, { type: "SCAN_LISTING" }, async (resp) => {
    if (chrome.runtime.lastError) {
      console.error("[Listing Inspector] Content script error:", chrome.runtime.lastError);
      if (statusEl) statusEl.textContent = "Error: " + chrome.runtime.lastError.message;
      return;
    }

    console.log("[Listing Inspector] Content script response:", resp);
    
    if (!resp || !resp.ok) {
      if (statusEl) statusEl.textContent = "Error: Could not scan page";
      return;
    }

    console.log("[Listing Inspector] ✅ Got page data");
    console.log("[Listing Inspector] Images found:", resp.data?.images?.length || 0);
    
    if (statusEl) statusEl.textContent = `Step 3: Analyzing ${resp.data?.images?.length || 0} images with AI...`;
    
    // NOW call your backend - THIS IS THE CRITICAL PART
    try {
      console.log("[Listing Inspector] 📡 Sending to backend:", BACKEND_URL);
      
      const payload = {
        url: resp.url,
        data: resp.data,
        report: resp.report
      };
      console.log("[Listing Inspector] Payload:", payload);
      
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

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  console.log("[Listing Inspector] DOM ready");
  const btn = el("scan");
  if (btn) {
    btn.addEventListener("click", runScan);
    console.log("[Listing Inspector] ✅ Scan button ready");
  }
});