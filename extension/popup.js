// popup.js — vFINAL-2026-02-14-04 - FIXED BACKEND CALL
console.log("[Listing Inspector] popup.js loaded vFINAL-2026-02-14-04");

// Configuration - your backend URL
const BACKEND_URL = 'http://localhost:5000/analyze';

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function el(id) { return document.getElementById(id); }

function render(resp, synthidResult) {
  console.log("[Listing Inspector] render() called", { 
    hasContentData: !!resp, 
    hasBackendData: !!synthidResult,
    backendData: synthidResult 
  });

  const statusEl = el("status");
  const scoreEl = el("score");
  const signalsEl = el("signals");
  const rawEl = el("raw");

  if (statusEl) statusEl.textContent = "Done.";

  // Show seller risk score
  const risk = resp?.report?.risk ?? 0;
  const sigs = resp?.report?.signals ?? [];

  let html = '';

  // Add SynthID/AI results FIRST (if available)
  if (synthidResult && synthidResult.success && synthidResult.results?.synthid) {
    const aiData = synthidResult.results.synthid;
    console.log("[Listing Inspector] AI Data received:", aiData);
    
    const isAIDetected = aiData.is_ai_generated === true;
    const confidence = aiData.confidence || 0;
    const indicators = aiData.indicators || [];
    const explanation = aiData.explanation || 'No explanation provided';
    const method = aiData.method || 'full_analysis';
    const imagesAnalyzed = aiData.images_analyzed || 1;
    const totalImages = aiData.total_images || resp?.data?.images?.length || 0;
    
    html += `
      <div style="margin: 15px 0; padding: 15px; border-radius: 6px; background-color: ${isAIDetected ? '#ffebee' : '#e8f5e8'}; border-left: 4px solid ${isAIDetected ? '#f44336' : '#4caf50'}; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
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
            ${explanation}
          </div>
        </div>
      `;
    }
    
    html += `
        <div style="margin-top: 10px; font-size: 11px; color: #999; display: flex; justify-content: space-between;">
          <span>📸 Images analyzed: ${imagesAnalyzed}/${totalImages}</span>
          <span>🔍 Method: ${method}</span>
        </div>
      </div>
      <hr style="margin: 15px 0; border: none; border-top: 1px solid #ddd;">
    `;
  }
  
  // Add seller risk score
  html += `<div style="margin-bottom: 15px; padding: 10px; background: #f5f5f5; border-radius: 4px;">
    <strong>📊 Seller Risk Score:</strong> ${risk}/100
  </div>`;
  
  // Add seller signals
  if (sigs.length > 0) {
    html += '<strong>📋 Seller Signals:</strong><ul style="margin: 8px 0 0 20px;">';
    for (const s of sigs) {
      html += `<li style="margin: 4px 0; font-size: 12px;">${s}</li>`;
    }
    html += '</ul>';
  } else {
    html += '<div style="color: #999; font-style: italic; font-size: 12px;">No seller signals detected</div>';
  }
  
  // Update the DOM
  if (signalsEl) signalsEl.innerHTML = html;
  if (scoreEl) scoreEl.innerHTML = ''; // We already included score in html
  if (rawEl) rawEl.textContent = JSON.stringify({
    content_script: resp,
    backend_result: synthidResult
  }, null, 2);
}

async function runScan() {
  console.log("[Listing Inspector] runScan() started");
  
  const statusEl = el("status");
  const scoreEl = el("score");
  const signalsEl = el("signals");
  const rawEl = el("raw");

  if (statusEl) statusEl.textContent = "Scanning…";
  if (scoreEl) scoreEl.textContent = "";
  if (signalsEl) signalsEl.innerHTML = '<div style="color: #666; font-style: italic;">Loading...</div>';
  if (rawEl) rawEl.textContent = "";

  const tab = await getActiveTab();
  console.log("[Listing Inspector] Active tab:", tab);
  
  if (!tab?.id) {
    if (statusEl) statusEl.textContent = "No active tab found.";
    return;
  }

  // Get data from content.js with a Promise wrapper
  console.log("[Listing Inspector] Getting data from content.js...");
  
  try {
    const resp = await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tab.id, { type: "SCAN_LISTING" }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
    
    console.log("[Listing Inspector] Content script response:", resp);
    
    if (!resp || typeof resp !== "object") {
      throw new Error("Invalid response from content script");
    }
    
    if (resp.ok !== true) {
      throw new Error("Content script returned ok=false");
    }
    
    console.log("[Listing Inspector] ✅ Got data from content.js");
    console.log("[Listing Inspector] Images found:", resp.data?.images?.length || 0);
    
    if (statusEl) statusEl.textContent = "Analyzing images with AI...";
    
    // NOW call your backend
    console.log("[Listing Inspector] 📡 Calling backend at:", BACKEND_URL);
    
    const payload = {
      url: resp.url,
      data: resp.data,
      report: resp.report
    };
    console.log("[Listing Inspector] Payload:", payload);
    
    const fetchResponse = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });
    
    console.log("[Listing Inspector] Backend response status:", fetchResponse.status);
    
    if (!fetchResponse.ok) {
      throw new Error(`HTTP ${fetchResponse.status}`);
    }
    
    const synthidResult = await fetchResponse.json();
    console.log("[Listing Inspector] ✅ Backend result:", synthidResult);
    
    // Render both results
    render(resp, synthidResult);
    
  } catch (error) {
    console.error("[Listing Inspector] ❌ Error:", error);
    if (statusEl) statusEl.textContent = "Error: " + error.message;
    if (rawEl) rawEl.textContent = JSON.stringify({ error: error.message }, null, 2);
    
    // Still show seller data if we have it
    if (resp) {
      render(resp, null);
    }
  }
}

// Wait for DOM to be ready
document.addEventListener("DOMContentLoaded", () => {
  console.log("[Listing Inspector] DOM loaded, attaching event listener");
  const btn = el("scan");
  if (!btn) {
    console.error("[Listing Inspector] Scan button not found!");
    return;
  }
  btn.addEventListener("click", runScan);
});