// popup.js - Complete version showing all AI detection results

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function el(id) { return document.getElementById(id); }

function render(resp, synthidResult) {
  console.log("📊 Rendering results:", { resp, synthidResult });
  el("status").textContent = "✅ Done.";
  
  // Show original risk score
  const sellerRisk = resp.report?.risk || 0;
  el("score").innerHTML = `
    <div style="margin-bottom: 15px; padding: 10px; background: #f5f5f5; border-radius: 4px;">
      <strong>📊 Seller Risk Score:</strong> ${sellerRisk}/100
    </div>
  `;
  
  // Clear previous signals
  const signalsDiv = el("signals");
  signalsDiv.innerHTML = '';
  
  // Show SynthID/AI results if available
  if (synthidResult && synthidResult.success && synthidResult.results?.synthid) {
    const aiData = synthidResult.results.synthid;
    console.log("🤖 AI Data:", aiData);
    
    const resultDiv = document.createElement('div');
    resultDiv.style.margin = '15px 0';
    resultDiv.style.padding = '15px';
    resultDiv.style.borderRadius = '6px';
    resultDiv.style.backgroundColor = aiData.is_ai_generated ? '#ffebee' : '#e8f5e8';
    resultDiv.style.borderLeft = aiData.is_ai_generated ? '4px solid #f44336' : '4px solid #4caf50';
    resultDiv.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
    
    // Main AI detection header
    let html = `
      <div style="display: flex; align-items: center; margin-bottom: 8px;">
        <span style="font-size: 20px; margin-right: 8px;">🤖</span>
        <strong style="font-size: 16px;">AI Image Analysis</strong>
      </div>
      
      <div style="font-weight: bold; margin: 10px 0; font-size: 16px;">
        ${aiData.is_ai_generated ? '⚠️ AI-GENERATED IMAGE DETECTED!' : '✅ No AI Generation Detected'}
      </div>
      
      <div style="margin: 5px 0;">
        <span style="background: ${aiData.is_ai_generated ? '#ffcdd2' : '#c8e6c9'}; padding: 3px 8px; border-radius: 12px; font-size: 12px;">
          Confidence: ${aiData.confidence || 0}%
        </span>
      </div>
    `;
    
    // Indicators section
    if (aiData.indicators && aiData.indicators.length > 0) {
      html += `
        <div style="margin-top: 15px;">
          <strong style="color: #d32f2f;">🚩 AI Indicators Found:</strong>
          <ul style="margin: 5px 0 0 20px;">
            ${aiData.indicators.map(ind => `<li style="font-size: 12px; margin: 3px 0;">${ind}</li>`).join('')}
          </ul>
        </div>
      `;
    }
    
    // Explanation section
    if (aiData.explanation) {
      html += `
        <div style="margin-top: 15px; background: rgba(255,255,255,0.5); padding: 10px; border-radius: 4px;">
          <strong>📝 Detailed Analysis:</strong>
          <div style="margin-top: 5px; font-size: 12px; color: #555; line-height: 1.5;">
            ${aiData.explanation}
          </div>
        </div>
      `;
    }
    
    // Image stats
    html += `
      <div style="margin-top: 10px; font-size: 11px; color: #999; display: flex; justify-content: space-between;">
        <span>📸 Images analyzed: ${aiData.images_analyzed || 0}/${aiData.total_images || 0}</span>
        <span>🔍 Method: ${aiData.method || 'unknown'}</span>
      </div>
    `;
    
    resultDiv.innerHTML = html;
    signalsDiv.appendChild(resultDiv);
    
  } else if (synthidResult && !synthidResult.success) {
    // Show error message
    const errorDiv = document.createElement('div');
    errorDiv.style.margin = '15px 0';
    errorDiv.style.padding = '15px';
    errorDiv.style.borderRadius = '6px';
    errorDiv.style.backgroundColor = '#fff3e0';
    errorDiv.style.borderLeft = '4px solid #ff9800';
    errorDiv.innerHTML = `
      <div style="display: flex; align-items: center;">
        <span style="font-size: 20px; margin-right: 8px;">⚠️</span>
        <strong>AI Detection Unavailable</strong>
      </div>
      <div style="margin-top: 5px; font-size: 12px; color: #666;">
        ${synthidResult.error || 'Could not analyze images'}
      </div>
    `;
    signalsDiv.appendChild(errorDiv);
  }
  
  // Add separator
  const separator = document.createElement('hr');
  separator.style.margin = '15px 0';
  separator.style.border = 'none';
  separator.style.borderTop = '1px solid #ddd';
  signalsDiv.appendChild(separator);
  
  // Show original seller signals
  if (resp.report?.signals && resp.report.signals.length > 0) {
    const signalsTitle = document.createElement('div');
    signalsTitle.innerHTML = '<strong>📋 Seller Signals:</strong>';
    signalsDiv.appendChild(signalsTitle);
    
    const ul = document.createElement('ul');
    ul.style.margin = '8px 0 0 20px';
    ul.style.padding = '0';
    for (const s of resp.report.signals) {
      const li = document.createElement('li');
      li.textContent = s;
      li.style.margin = '4px 0';
      li.style.fontSize = '12px';
      ul.appendChild(li);
    }
    signalsDiv.appendChild(ul);
  } else {
    const noSignals = document.createElement('div');
    noSignals.style.color = '#999';
    noSignals.style.fontStyle = 'italic';
    noSignals.style.fontSize = '12px';
    noSignals.textContent = 'No seller signals detected';
    signalsDiv.appendChild(noSignals);
  }
  
  // Show raw data in details section
  el("raw").textContent = JSON.stringify({
    seller_data: resp,
    ai_detection: synthidResult
  }, null, 2);
}

el("scan").addEventListener("click", async () => {
  console.log("🔘 Scan button clicked");
  el("status").textContent = "🔄 Scanning listing...";
  el("signals").innerHTML = "";
  el("score").textContent = "";

  const tab = await getActiveTab();
  if (!tab?.id) {
    el("status").textContent = "❌ No active tab found";
    return;
  }

  // First, get data from content.js
  chrome.tabs.sendMessage(tab.id, { type: "SCAN_LISTING" }, async (resp) => {
    if (chrome.runtime.lastError) {
      console.error("❌ Runtime error:", chrome.runtime.lastError);
      el("status").textContent = "❌ Could not scan page. Try refreshing.";
      return;
    }
    
    if (!resp?.ok) {
      el("status").textContent = "❌ Could not scan this page. Open an Etsy listing page.";
      return;
    }
    
    console.log("📦 Data from content.js:", resp);
    el("status").textContent = "🔍 Analyzing images with AI...";
    
    try {
      // Call your SynthID backend
      const YOUR_BACKEND_URL = 'http://localhost:5000/analyze';
      
      console.log("📡 Sending to backend:", YOUR_BACKEND_URL);
      
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
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const synthidResult = await response.json();
      console.log("📊 Backend result:", synthidResult);
      
      // Render both results
      render(resp, synthidResult);
      
    } catch (error) {
      console.error("❌ Error calling backend:", error);
      el("status").textContent = "⚠️ AI detection unavailable - backend not running?";
      // Still show original results
      render(resp, null);
    }
  });
});

// Add test button functionality (optional)
document.addEventListener('DOMContentLoaded', () => {
  console.log("🚀 Extension popup loaded");
});