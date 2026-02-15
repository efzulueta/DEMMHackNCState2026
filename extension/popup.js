// popup.js - Updated to call SynthID backend

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function el(id) { return document.getElementById(id); }

function render(resp, synthidResult) {
  el("status").textContent = "Done.";
  
  // Show original risk score
  el("score").innerHTML = `
    <div style="margin-bottom: 10px;">
      <strong>Seller Risk Score:</strong> ${resp.report.risk}/100
    </div>
  `;
  
  // Show SynthID results if available
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
    
    el("signals").prepend(aiDiv);
  }
  
  // Show original signals
  const ul = document.createElement("ul");
  for (const s of resp.report.signals) {
    const li = document.createElement("li");
    li.textContent = s;
    ul.appendChild(li);
  }
  el("signals").appendChild(ul);
  
  // Show raw data
  el("raw").textContent = JSON.stringify({...resp, synthid: synthidResult}, null, 2);
}

el("scan").addEventListener("click", async () => {
  el("status").textContent = "Scanning…";
  el("signals").innerHTML = "";
  el("score").textContent = "";

  const tab = await getActiveTab();
  if (!tab?.id) return;

  // First, get data from content.js
  chrome.tabs.sendMessage(tab.id, { type: "SCAN_LISTING" }, async (resp) => {
    if (chrome.runtime.lastError || !resp?.ok) {
      el("status").textContent = "Could not scan this page. Open an Etsy listing page and refresh.";
      return;
    }
    
    // Show initial status
    el("status").textContent = "Analyzing images with AI...";
    
    try {
      // NOW call YOUR SynthID backend
      const YOUR_BACKEND_URL = 'http://localhost:5000/analyze';
      
      console.log("📡 Sending to backend:", YOUR_BACKEND_URL);
      console.log("📦 Data:", resp);
      
      const response = await fetch(YOUR_BACKEND_URL, {
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
      const synthidResult = await response.json();
      console.log("📊 SynthID result:", synthidResult);
      
      // Render both results
      render(resp, synthidResult);
      
    } catch (error) {
      console.error("❌ Error calling SynthID backend:", error);
      el("status").textContent = "AI detection unavailable - backend not running?";
      // Still show original results
      render(resp, null);
    }
  });
});