// popup.js - Updated to call SynthID backend and display SynthID results only

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function el(id) { return document.getElementById(id); }

function render(resp, synthidResult) {
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
  
  // Show SynthID results if available
  if (synthidResult && synthidResult.success && synthidResult.results?.synthid) {
    const aiData = synthidResult.results.synthid;
    
    // Extract SynthID-specific fields
    const hasSynthid = aiData.has_synthid || false;
    const confidence = aiData.confidence || 0;
    const watermarkLocation = aiData.watermark_location || 'unknown';
    const explanation = aiData.explanation || 'No explanation';
    
    // Image stats
    const imagesAnalyzed = aiData.images_analyzed || 0;
    const validImages = aiData.valid_images || 0;
    const totalImages = aiData.total_images || 0;
    
    const synthidDiv = document.createElement('div');
    synthidDiv.style.margin = '15px 0';
    synthidDiv.style.padding = '15px';
    synthidDiv.style.borderRadius = '6px';
    synthidDiv.style.backgroundColor = hasSynthid ? '#ffebee' : '#e8f5e8';
    synthidDiv.style.borderLeft = hasSynthid ? '4px solid #f44336' : '4px solid #4caf50';
    synthidDiv.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
    
    synthidDiv.innerHTML = `
      <div style="display: flex; align-items: center; margin-bottom: 8px;">
        <span style="font-size: 20px; margin-right: 8px;">🔖</span>
        <strong style="font-size: 16px;">SynthID Watermark Detection</strong>
      </div>
      <div style="font-weight: bold; margin: 5px 0; font-size: 16px;">
        ${hasSynthid ? '⚠️ SynthID Watermark DETECTED!' : '✅ No SynthID Watermark Found'}
      </div>
      <div style="margin: 5px 0;">
        <span style="background: ${hasSynthid ? '#ffcdd2' : '#c8e6c9'}; padding: 3px 8px; border-radius: 12px; font-size: 12px;">
          Confidence: ${confidence}%
        </span>
      </div>
      ${watermarkLocation !== 'unknown' && hasSynthid ? `
        <div style="margin: 5px 0; font-size: 13px;">
          <strong>📍 Location:</strong> ${watermarkLocation}
        </div>
      ` : ''}
      <div style="margin: 8px 0; font-size: 13px; color: #555; background: rgba(255,255,255,0.5); padding: 8px; border-radius: 4px;">
        ${explanation}
      </div>
      <div style="margin-top: 8px; font-size: 11px; color: #999; border-top: 1px solid rgba(0,0,0,0.1); padding-top: 8px;">
        <strong>📸 Image Analysis:</strong> ${validImages} valid images found | ${imagesAnalyzed} analyzed
      </div>
    `;
    
    signalsDiv.appendChild(synthidDiv);
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
        <strong>SynthID Detection Unavailable</strong>
      </div>
      <div style="margin-top: 5px; font-size: 12px; color: #666;">
        ${synthidResult.error || 'Could not analyze images for SynthID watermark'}
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
  
  // Show original signals
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
    synthid_detection: synthidResult
  }, null, 2);
}

el("scan").addEventListener("click", async () => {
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
      console.error("Runtime error:", chrome.runtime.lastError);
      el("status").textContent = "❌ Could not scan page. Try refreshing.";
      return;
    }
    
    if (!resp?.ok) {
      el("status").textContent = "❌ Could not scan this page. Open an Etsy listing page.";
      return;
    }
    
    console.log("📦 Data from content.js:", resp);
    el("status").textContent = "🔍 Checking for SynthID watermark...";
    
    try {
      // Call your SynthID backend
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
      
      const synthidResult = await response.json();
      console.log("📊 SynthID result:", synthidResult);
      
      // Render both results
      render(resp, synthidResult);
      
    } catch (error) {
      console.error("❌ Error calling SynthID backend:", error);
      el("status").textContent = "⚠️ SynthID detection unavailable - backend not running?";
      // Still show original results
      render(resp, null);
    }
  });
});

// Add test button functionality (optional)
document.addEventListener('DOMContentLoaded', () => {
  console.log("🚀 Extension popup loaded");
});