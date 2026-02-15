// popup.js - Fixed to match your EXACT backend structure

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function el(id) { return document.getElementById(id); }

function render(resp, backendResult) {
  console.log("📊 Rendering results:", { seller: resp, ai: backendResult });
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
  
  // Check if we have AI results - based on your logs, the data is in results.synthid
  if (backendResult && backendResult.success && backendResult.results?.synthid) {
    const aiData = backendResult.results.synthid;
    console.log("🤖 AI Data from backend:", aiData);
    
    // Extract values - using the EXACT field names from your logs
    const isAIDetected = aiData.is_ai_generated === true;
    const confidence = aiData.confidence || 0;
    const indicators = aiData.indicators || [];
    const explanation = aiData.explanation || 'No explanation provided';
    const method = aiData.method || 'full_analysis';
    
    // Image stats from the main response
    const imagesAnalyzed = aiData.images_analyzed || 1;
    const totalImages = aiData.total_images || 5;
    
    const resultDiv = document.createElement('div');
    resultDiv.style.margin = '15px 0';
    resultDiv.style.padding = '15px';
    resultDiv.style.borderRadius = '6px';
    resultDiv.style.backgroundColor = isAIDetected ? '#ffebee' : '#e8f5e8';
    resultDiv.style.borderLeft = isAIDetected ? '4px solid #f44336' : '4px solid #4caf50';
    resultDiv.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
    
    // Main AI detection header
    let html = `
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
    
    // Indicators section
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
    
    // Explanation section
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
    
    // Image stats and method
    html += `
      <div style="margin-top: 10px; font-size: 11px; color: #999; display: flex; justify-content: space-between;">
        <span>📸 Images analyzed: ${imagesAnalyzed}/${totalImages}</span>
        <span>🔍 Method: ${method}</span>
      </div>
    `;
    
    resultDiv.innerHTML = html;
    signalsDiv.appendChild(resultDiv);
    
    // Add a separator after AI results
    const separator = document.createElement('hr');
    separator.style.margin = '15px 0';
    separator.style.border = 'none';
    separator.style.borderTop = '1px solid #ddd';
    signalsDiv.appendChild(separator);
  }
  
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
    ai_detection: backendResult
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
      // Call your backend
      const YOUR_BACKEND_URL = 'http://localhost:5000/analyze';
      
      console.log("📡 Sending to backend:", YOUR_BACKEND_URL);
      console.log("📤 Payload:", {
        url: resp.url,
        data: resp.data,
        report: resp.report
      });
      
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
      
      const backendResult = await response.json();
      console.log("📊 Full backend result:", backendResult);
      
      // Render both results
      render(resp, backendResult);
      
    } catch (error) {
      console.error("❌ Error calling backend:", error);
      el("status").textContent = "⚠️ AI detection unavailable - backend not running?";
      // Still show original results
      render(resp, null);
    }
  });
});

// Log when popup loads
document.addEventListener('DOMContentLoaded', () => {
  console.log("🚀 Extension popup loaded");
});