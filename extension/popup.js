// In your popup.js, update the render function to show both SynthID and AI results

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
  
  // Show SynthID/AI results if available
  if (synthidResult && synthidResult.success && synthidResult.results?.synthid) {
    const aiData = synthidResult.results.synthid;
    
    const resultDiv = document.createElement('div');
    resultDiv.style.margin = '15px 0';
    resultDiv.style.padding = '15px';
    resultDiv.style.borderRadius = '6px';
    resultDiv.style.backgroundColor = aiData.is_ai_generated ? '#ffebee' : '#e8f5e8';
    resultDiv.style.borderLeft = aiData.is_ai_generated ? '4px solid #f44336' : '4px solid #4caf50';
    resultDiv.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
    
    // Build HTML
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
          Confidence: ${aiData.confidence}%
        </span>
      </div>
    `;
    
    // SynthID section
    html += `
      <div style="margin-top: 15px; padding-top: 10px; border-top: 1px dashed #ccc;">
        <div style="display: flex; align-items: center; margin-bottom: 5px;">
          <span style="font-size: 16px; margin-right: 5px;">🔖</span>
          <strong>SynthID Watermark:</strong>
        </div>
        <div style="margin-left: 20px;">
          <span style="color: ${aiData.has_synthid ? '#f44336' : '#4caf50'}; font-weight: bold;">
            ${aiData.has_synthid ? '✅ DETECTED' : '❌ NOT DETECTED'}
          </span>
          ${aiData.has_synthid ? `
            <div style="margin-top: 3px; font-size: 12px;">
              Confidence: ${aiData.synthid_confidence}%<br>
              Location: ${aiData.synthid_location}
            </div>
          ` : ''}
        </div>
      </div>
    `;
    
    // Indicators
    if (aiData.indicators && aiData.indicators.length > 0) {
      html += `
        <div style="margin-top: 15px;">
          <strong>🚩 AI Indicators Found:</strong>
          <ul style="margin: 5px 0 0 20px;">
            ${aiData.indicators.map(ind => `<li style="font-size: 12px;">${ind}</li>`).join('')}
          </ul>
        </div>
      `;
    }
    
    // Explanation
    html += `
      <div style="margin-top: 15px; background: rgba(255,255,255,0.5); padding: 10px; border-radius: 4px;">
        <strong>📝 Analysis:</strong>
        <div style="margin-top: 5px; font-size: 12px; color: #555;">
          ${aiData.explanation}
        </div>
      </div>
      
      <div style="margin-top: 8px; font-size: 11px; color: #999;">
        Images analyzed: ${aiData.images_analyzed || 0}/${aiData.total_images || 0}
      </div>
    `;
    
    resultDiv.innerHTML = html;
    signalsDiv.appendChild(resultDiv);
  }
  
  // ... rest of your render function (seller signals, etc.)
}