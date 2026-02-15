// popup.js — COMPLETE UPDATED VERSION with AI results display and proper ordering
console.log("[Listing Inspector] popup.js loaded - COMPLETE UPDATED VERSION");

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function el(id) { return document.getElementById(id); }

function render(resp) {
  console.log("[Listing Inspector] render() resp =", resp);
  const statusEl = el("status");
  const scoreEl = el("score");
  const signalsEl = el("signals");
  const rawEl = el("raw");

  if (statusEl) statusEl.textContent = "Done.";
  
  // Get risk score from frontend
  const risk = resp?.report?.risk ?? 0;
  const sigs = resp?.report?.signals ?? [];
  
  // Get backend results if they exist
  const backendResults = resp?.backendResults;
  const aiResults = backendResults?.results?.synthid;
  const sentimentResults = backendResults?.results?.sentiment;
  
  if (scoreEl) {
    let riskDisplay = `Risk Score: ${risk}/100`;
    if (backendResults?.risk) {
      riskDisplay = `Risk Score: ${backendResults.risk.score}/100 - ${backendResults.risk.level}`;
    }
    scoreEl.textContent = riskDisplay;
  }

  if (signalsEl) {
    signalsEl.innerHTML = "";
    const container = document.createElement("div");
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.gap = "12px";
    
    // =====================================================================
    // ADD AI DETECTION RESULTS FIRST (MOST IMPORTANT)
    // =====================================================================
    if (aiResults) {
      const aiData = aiResults.results?.[0] || aiResults;
      const isAIDetected = aiData.is_ai_generated || aiResults.any_ai || false;
      const confidence = aiData.confidence || 0;
      const indicators = aiData.indicators || [];
      const explanation = aiData.explanation || '';
      
      const aiDiv = document.createElement("div");
      aiDiv.style.marginBottom = "4px";
      aiDiv.style.padding = "16px";
      aiDiv.style.borderRadius = "8px";
      aiDiv.style.backgroundColor = isAIDetected ? "#ffebee" : "#e8f5e8";
      aiDiv.style.borderLeft = isAIDetected ? "4px solid #f44336" : "4px solid #4caf50";
      aiDiv.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";
      
      let aiHtml = `<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
        <span style="font-size: 20px;">🤖</span>
        <span style="font-weight: bold; font-size: 16px;">AI IMAGE DETECTION</span>
      </div>`;
      
      aiHtml += `<div style="font-weight: bold; font-size: 16px; margin-bottom: 6px;">
        ${isAIDetected ? '⚠️ AI-GENERATED IMAGE DETECTED!' : '✅ No AI Images Detected'}
      </div>`;
      
      aiHtml += `<div style="margin-bottom: 8px;">
        <span style="background: ${isAIDetected ? '#ffcdd2' : '#c8e6c9'}; padding: 4px 10px; border-radius: 16px; font-size: 12px; font-weight: bold;">
          Confidence: ${confidence}%
        </span>
      </div>`;
      
      // Add indicators if available
      if (indicators && indicators.length > 0) {
        aiHtml += `<div style="margin-top: 10px; font-size: 12px; color: #555;">`;
        aiHtml += `<span style="font-weight: bold;">Indicators found:</span>`;
        aiHtml += `<ul style="margin: 5px 0 0 20px; padding: 0;">`;
        indicators.slice(0, 3).forEach(ind => {
          aiHtml += `<li style="margin: 3px 0;">${ind}</li>`;
        });
        if (indicators.length > 3) {
          aiHtml += `<li style="color: #999;">... and ${indicators.length - 3} more</li>`;
        }
        aiHtml += `</ul></div>`;
      }
      
      // Add explanation if available and not an error
      if (explanation && explanation.length > 0 && !explanation.includes('Error')) {
        aiHtml += `<div style="margin-top: 10px; font-size: 11px; color: #666; background: rgba(255,255,255,0.7); padding: 8px; border-radius: 4px;">
          <span style="font-weight: bold;">Analysis:</span> ${explanation.substring(0, 150)}${explanation.length > 150 ? '...' : ''}
        </div>`;
      }
      
      aiDiv.innerHTML = aiHtml;
      container.appendChild(aiDiv);
    }
    
    // =====================================================================
    // ADD SENTIMENT ANALYSIS RESULTS
    // =====================================================================
    if (sentimentResults) {
      const sentiment = sentimentResults;
      
      console.log("📊 [POPUP] Sentiment data:", sentiment);
      
      const sentimentDiv = document.createElement("div");
      sentimentDiv.style.padding = "16px";
      sentimentDiv.style.backgroundColor = "#f8f9fa";
      sentimentDiv.style.borderRadius = "8px";
      sentimentDiv.style.borderLeft = "4px solid #2196f3";
      sentimentDiv.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";
      
      let sentimentHtml = `<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
        <span style="font-size: 20px;">📊</span>
        <span style="font-weight: bold; font-size: 16px;">Sentiment Analysis</span>
      </div>`;
      
      sentimentHtml += `<div style="display: flex; justify-content: space-between; margin-bottom: 8px; gap: 8px;">
        <div style="flex: 1; text-align: center; padding: 8px; background: #4caf50; color: white; border-radius: 4px;">
          <div style="font-size: 18px; font-weight: bold;">${sentiment.sentiment_counts?.positive || 0}</div>
          <div style="font-size: 11px;">Positive</div>
          <div style="font-size: 14px;">${sentiment.sentiment_percentages?.positive || 0}%</div>
        </div>
        <div style="flex: 1; text-align: center; padding: 8px; background: #f44336; color: white; border-radius: 4px;">
          <div style="font-size: 18px; font-weight: bold;">${sentiment.sentiment_counts?.negative || 0}</div>
          <div style="font-size: 11px;">Negative</div>
          <div style="font-size: 14px;">${sentiment.sentiment_percentages?.negative || 0}%</div>
        </div>
        <div style="flex: 1; text-align: center; padding: 8px; background: #ff9800; color: white; border-radius: 4px;">
          <div style="font-size: 18px; font-weight: bold;">${sentiment.sentiment_counts?.neutral || 0}</div>
          <div style="font-size: 11px;">Neutral</div>
          <div style="font-size: 14px;">${sentiment.sentiment_percentages?.neutral || 0}%</div>
        </div>
      </div>`;
      
      sentimentHtml += `<div style="margin-top: 10px; font-size: 13px; color: #555; text-align: center; background: white; padding: 8px; border-radius: 4px;">
        Average Sentiment: ${sentiment.average_sentiment || 0}
      </div>`;
      
      sentimentDiv.innerHTML = sentimentHtml;
      container.appendChild(sentimentDiv);
      
      // Add suspicious reviews warning if any
      if (sentiment.sentiment_rating_mismatch_count > 0) {
        const suspiciousDiv = document.createElement("div");
        suspiciousDiv.style.padding = "12px";
        suspiciousDiv.style.backgroundColor = "#fff3e0";
        suspiciousDiv.style.borderLeft = "4px solid #ff9800";
        suspiciousDiv.style.borderRadius = "8px";
        suspiciousDiv.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";
        suspiciousDiv.innerHTML = `<span style="color: #d94f1a; font-weight: bold;">⚠️ ${sentiment.sentiment_rating_mismatch_count} suspicious review(s) detected</span>`;
        container.appendChild(suspiciousDiv);
        
        console.log("🚩 [POPUP] Suspicious reviews:", sentiment.suspicious_reviews);
      }
    }
    
    // Add original frontend signals
    if (sigs && sigs.length > 0) {
      const signalsDiv = document.createElement("div");
      signalsDiv.style.padding = "16px";
      signalsDiv.style.backgroundColor = "#f0f0f0";
      signalsDiv.style.borderRadius = "8px";
      signalsDiv.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";
      
      let signalsHtml = `<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
        <span style="font-size: 20px;">⚠️</span>
        <span style="font-weight: bold; font-size: 16px;">Seller Signals</span>
      </div>`;
      
      signalsHtml += `<ul style="margin: 0 0 0 20px; padding: 0;">`;
      sigs.forEach(s => {
        signalsHtml += `<li style="margin: 6px 0; font-size: 12px;">${s}</li>`;
      });
      signalsHtml += `</ul>`;
      
      signalsDiv.innerHTML = signalsHtml;
      container.appendChild(signalsDiv);
    }
    
    signalsEl.appendChild(container);
  }

  if (rawEl) rawEl.textContent = JSON.stringify(resp, null, 2);
}

async function openReviewWindow(tabId) {
  console.log("[Listing Inspector] Opening review window...");
  
  // Simple message to open reviews
  chrome.tabs.sendMessage(tabId, { type: "OPEN_REVIEWS" }, (response) => {
    if (chrome.runtime.lastError) {
      console.log("Review open error:", chrome.runtime.lastError.message);
    } else {
      console.log("Review open result:", response);
    }
  });
}

async function runScan() {
  const statusEl = el("status");
  const scoreEl = el("score");
  const signalsEl = el("signals");
  const rawEl = el("raw");

  console.log("🔵 [POPUP] Button clicked!");

  if (statusEl) statusEl.textContent = "Scanning page...";
  if (scoreEl) scoreEl.textContent = "";
  if (signalsEl) signalsEl.innerHTML = "";
  if (rawEl) rawEl.textContent = "";

  const tab = await getActiveTab();
  if (!tab?.id) {
    console.log("🔴 [POPUP] No active tab");
    if (statusEl) statusEl.textContent = "No active tab found.";
    return;
  }

  console.log("🔵 [POPUP] Sending message to content script...");

  chrome.tabs.sendMessage(tab.id, { type: "SCAN_LISTING" }, async (resp) => {
    if (chrome.runtime.lastError) {
      const msg = chrome.runtime.lastError.message || "Unknown error";
      console.log("🔴 [POPUP] Content script error:", msg);
      if (statusEl) statusEl.textContent = "Error: " + msg;
      if (rawEl) rawEl.textContent = JSON.stringify({ ok: false, error: msg }, null, 2);
      return;
    }

    console.log("🟢 [POPUP] Received from content script:", resp);
    
    if (!resp || typeof resp !== "object" || resp.ok !== true) {
      console.log("🔴 [POPUP] Invalid response");
      if (statusEl) statusEl.textContent = "Invalid response from content script.";
      if (rawEl) rawEl.textContent = JSON.stringify(resp, null, 2);
      return;
    }

    // =====================================================================
    // STEP 1: ANALYZE IMAGES WITH AI FIRST
    // =====================================================================
    console.log("🟡 [POPUP] Sending to backend for AI analysis...");
    if (statusEl) statusEl.textContent = "Analyzing images with AI...";

    try {
      console.log("🟡 [POPUP] Calling backend...");
      
      const backendResponse = await fetch('http://localhost:5000/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(resp)
      });

      console.log("🟡 [POPUP] Backend responded with status:", backendResponse.status);

      if (backendResponse.ok) {
        const backendData = await backendResponse.json();
        console.log("🟢 [POPUP] Backend success:", backendData);
        
        // Store backend results
        resp.backendResults = backendData;
        
        if (statusEl) statusEl.textContent = "AI analysis complete!";
      } else {
        const errorText = await backendResponse.text();
        console.log("🔴 [POPUP] Backend error:", errorText);
        if (statusEl) statusEl.textContent = "Backend error: " + backendResponse.status;
      }
    } catch (err) {
      console.log("🔴 [POPUP] Fetch failed:", err);
      if (statusEl) statusEl.textContent = "Cannot reach backend: " + err.message;
    }

    // =====================================================================
    // STEP 2: DISPLAY RESULTS
    // =====================================================================
    render(resp);

    // =====================================================================
    // STEP 3: OPEN REVIEW WINDOW LAST
    // =====================================================================
    setTimeout(() => {
      console.log("🟡 [POPUP] Opening review window...");
      openReviewWindow(tab.id);
    }, 1000); // Wait 1 second after displaying results
  });
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("🟢 [POPUP] DOM loaded");
  const btn = el("scan");
  if (!btn) {
    console.log("🔴 [POPUP] Button not found!");
    return;
  }
  console.log("🟢 [POPUP] Button found, adding listener");
  btn.addEventListener("click", runScan);
});
