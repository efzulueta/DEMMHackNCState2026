// popup.js — vWORKING-FROM-HISTORY
console.log("[Listing Inspector] popup.js loaded - WORKING VERSION FROM HISTORY");

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
  
  // Show original risk score
  const risk = resp?.report?.risk ?? 0;
  if (scoreEl) {
    scoreEl.innerHTML = `
      <div style="margin-bottom: 10px;">
        <strong>Seller Risk Score:</strong> ${risk}/100
      </div>
    `;
  }
  
  // Show SynthID results if available - USING THE EXACT STRUCTURE FROM WORKING VERSION
  if (synthidResult && synthidResult.results?.synthid) {
    const aiDetected = synthidResult.results.synthid.any_ai;
    const aiConfidence = synthidResult.results.synthid.results[0]?.confidence || 0;
    
    const aiDiv = document.createElement('div');
    aiDiv.style.margin = '10px 0';
    aiDiv.style.padding = '10px';
    aiDiv.style.borderRadius = '4px';
    aiDiv.style.backgroundColor = aiDetected ? '#ffebee' : '#e8f5e8';
    aiDiv.style.borderLeft = aiDetected ? '4px solid #f44336' : '4px solid #4caf50';
    
    aiDiv.innerHTML = `
      <strong>🤖 AI Image Detection:</strong><br>
      ${aiDetected ? '⚠️ AI-generated images detected!' : '✅ No AI images found'}<br>
      <small>Confidence: ${aiConfidence}%</small>
    `;
    
    if (signalsEl) signalsEl.prepend(aiDiv);
  }
  
  // Show original signals
  const sigs = resp?.report?.signals ?? [];
  if (signalsEl && sigs.length > 0) {
    const ul = document.createElement("ul");
    for (const s of sigs) {
      const li = document.createElement("li");
      li.textContent = s;
      ul.appendChild(li);
    }
    signalsEl.appendChild(ul);
  }
  
  // Show raw data
  if (rawEl) {
    rawEl.textContent = JSON.stringify({...resp, synthid: synthidResult}, null, 2);
  }
}

el("scan").addEventListener("click", async () => {
  console.log("[Listing Inspector] Scan button clicked");
  
  const statusEl = el("status");
  const signalsEl = el("signals");
  const scoreEl = el("score");
  const rawEl = el("raw");

  if (statusEl) statusEl.textContent = "Scanning…";
  if (signalsEl) signalsEl.innerHTML = "";
  if (scoreEl) scoreEl.innerHTML = "";
  if (rawEl) rawEl.textContent = "";

  const tab = await getActiveTab();
  if (!tab?.id) {
    if (statusEl) statusEl.textContent = "No active tab found.";
    return;
  }

  console.log("[Listing Inspector] Getting data from content.js...");
  
  // First, get data from content.js
  chrome.tabs.sendMessage(tab.id, { type: "SCAN_LISTING" }, async (resp) => {
    if (chrome.runtime.lastError) {
      console.error("[Listing Inspector] Error:", chrome.runtime.lastError);
      if (statusEl) statusEl.textContent = "Could not scan this page. Open an Etsy listing page and refresh.";
      return;
    }
    
    if (!resp?.ok) {
      if (statusEl) statusEl.textContent = "Could not scan this page. Open an Etsy listing page and refresh.";
      return;
    }
    
    console.log("[Listing Inspector] Got data from content.js:", resp);
    
    // Show initial status
    if (statusEl) statusEl.textContent = "Analyzing images with AI...";
    
    try {
      // NOW call YOUR SynthID backend
      console.log("📡 Sending to backend:", BACKEND_URL);
      console.log("📦 Data being sent:", {
        url: resp.url,
        data: resp.data,
        report: resp.report
      });
      
      const response = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: resp.url,
          data: resp.data,
          report: resp.report
        })
      });
      
      console.log("📥 Response status:", response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const synthidResult = await response.json();
      console.log("📊 SynthID result:", synthidResult);
      
      // Render both results
      render(resp, synthidResult);
      
    } catch (error) {
      console.error("❌ Error calling SynthID backend:", error);
      if (statusEl) statusEl.textContent = "AI detection unavailable - backend not running?";
      // Still show original results
      render(resp, null);
    }
  });
});

document.addEventListener("DOMContentLoaded", () => {
  console.log("[Listing Inspector] DOM loaded");
  const btn = el("scan");
  if (btn) {
    btn.addEventListener("click", runScan);
  }
});