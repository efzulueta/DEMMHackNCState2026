// console.log("[Listing Inspector] popup.js loaded - WITH CLIP SIMILARITY");

// async function getActiveTab() {
//   const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
//   return tab;
// }

// function el(id) { return document.getElementById(id); }

// function render(resp) {
//   console.log("[Listing Inspector] render() resp =", resp);
//   const statusEl = el("status");
//   const scoreEl = el("score");
//   const signalsEl = el("signals");
//   const rawEl = el("raw");

//   if (statusEl) statusEl.textContent = "Done.";

//   // Get risk data from backend
//   const backendRisk = resp?.aiRisk || {};
//   const riskScore = backendRisk?.score || 0;
//   const riskLevel = backendRisk?.level || 'UNKNOWN';
//   const riskColor = backendRisk?.color || '#666';
//   const warnings = backendRisk?.warnings || [];
//   const breakdown = backendRisk?.breakdown || {};

//   // Display overall risk score with color
//   if (scoreEl) {
//     scoreEl.innerHTML = `<span style="color: ${riskColor}; font-weight: bold;">Risk Score: ${riskScore}/100 - ${riskLevel}</span>`;
//   }

//   if (signalsEl) {
//     signalsEl.innerHTML = "";
    
//     // Create main container
//     const container = document.createElement("div");
    
//     // ================================================================
//     // SECTION 1: RISK BREAKDOWN (Category Subscores)
//     // ================================================================
//     if (Object.keys(breakdown).length > 0) {
//       const breakdownSection = document.createElement("div");
//       breakdownSection.style.marginBottom = "15px";
//       breakdownSection.style.padding = "10px";
//       breakdownSection.style.backgroundColor = "#f9fafb";
//       breakdownSection.style.borderRadius = "6px";
      
//       const breakdownTitle = document.createElement("strong");
//       breakdownTitle.textContent = "📊 Risk Breakdown:";
//       breakdownSection.appendChild(breakdownTitle);
      
//       const breakdownList = document.createElement("div");
//       breakdownList.style.marginTop = "8px";
//       breakdownList.style.fontSize = "13px";
      
//       // Category labels
//       const categoryLabels = {
//         'reviews': '📝 Reviews',
//         'seller': '👤 Seller Credibility',
//         'review_photos': '📸 Review Photos (CLIP)',
//         'sentiment': '💭 Sentiment',
//         'ai_images': '🤖 AI Detection'
//       };
      
//       for (const [category, score] of Object.entries(breakdown)) {
//         const row = document.createElement("div");
//         row.style.marginBottom = "4px";
//         row.style.display = "flex";
//         row.style.justifyContent = "space-between";
        
//         const label = categoryLabels[category] || category;
//         const scoreColor = score < 0 ? '#22c55e' : (score > 10 ? '#ef4444' : '#666');
        
//         row.innerHTML = `
//           <span>${label}:</span>
//           <span style="color: ${scoreColor}; font-weight: bold;">${score > 0 ? '+' : ''}${score} pts</span>
//         `;
//         breakdownList.appendChild(row);
//       }
      
//       breakdownSection.appendChild(breakdownList);
//       container.appendChild(breakdownSection);
//     }
    
//     // ================================================================
//     // SECTION 2: AI IMAGE DETECTION
//     // ================================================================
//     const synthid = resp?.aiAnalysis?.synthid;
//     if (synthid) {
//       const aiSection = document.createElement("div");
//       aiSection.style.marginBottom = "15px";
//       aiSection.style.padding = "10px";
//       aiSection.style.backgroundColor = synthid.any_ai ? "#fef3c7" : "#f0fdf4";
//       aiSection.style.borderRadius = "6px";
//       aiSection.style.border = synthid.any_ai ? "1px solid #fbbf24" : "1px solid #86efac";
      
//       const aiTitle = document.createElement("strong");
//       aiTitle.textContent = synthid.any_ai ? "🤖 AI-Generated Image Detected" : "✅ No AI Images Detected";
//       aiSection.appendChild(aiTitle);
      
//       if (synthid.any_ai) {
//         const aiDetails = document.createElement("div");
//         aiDetails.style.marginTop = "6px";
//         aiDetails.style.fontSize = "12px";
        
//         const result = synthid.results?.[0] || {};
//         const confidence = result.confidence || 0;
        
//         aiDetails.innerHTML = `
//           <div>Confidence: ${confidence}%</div>
//           <div style="margin-top: 4px; color: #666;">${result.explanation || 'AI patterns detected in listing image'}</div>
//         `;
//         aiSection.appendChild(aiDetails);
//       }
      
//       container.appendChild(aiSection);
//     }
    
//     // ================================================================
//     // SECTION 3: CLIP IMAGE SIMILARITY (NEW!)
//     // ================================================================
//     const clipResults = resp?.aiAnalysis?.clip_similarity;
//     if (clipResults && clipResults.analyzed) {
//       const clipSection = document.createElement("div");
//       clipSection.style.marginBottom = "15px";
//       clipSection.style.padding = "12px";
//       clipSection.style.borderRadius = "6px";
      
//       const avgScore = clipResults.average_match_score || 0;
//       const verified = clipResults.verified_authentic;
//       const highMatches = clipResults.high_confidence_matches || 0;
//       const totalComparisons = clipResults.total_comparisons || 0;
      
//       // Color based on verification status
//       const bgColor = verified ? "#f0fdf4" : "#fef3c7";
//       const borderColor = verified ? "#86efac" : "#fbbf24";
      
//       clipSection.style.backgroundColor = bgColor;
//       clipSection.style.border = `1px solid ${borderColor}`;
      
//       const clipTitle = document.createElement("strong");
//       clipTitle.textContent = verified ? "🔍 CLIP: Review Photos Verified ✅" : "🔍 CLIP: Review Photos Show Differences ⚠️";
//       clipSection.appendChild(clipTitle);
      
//       const clipDetails = document.createElement("div");
//       clipDetails.style.marginTop = "10px";
//       clipDetails.style.fontSize = "13px";
      
//       clipDetails.innerHTML = `
//         <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 8px;">
//           <div style="text-align: center; background: white; padding: 8px; border-radius: 4px;">
//             <div style="font-size: 18px; font-weight: bold; color: #1976d2;">${avgScore}%</div>
//             <div style="font-size: 11px; color: #666;">Avg Match</div>
//           </div>
//           <div style="text-align: center; background: white; padding: 8px; border-radius: 4px;">
//             <div style="font-size: 18px; font-weight: bold; color: #2e7d32;">${highMatches}</div>
//             <div style="font-size: 11px; color: #666;">High Matches</div>
//           </div>
//           <div style="text-align: center; background: white; padding: 8px; border-radius: 4px;">
//             <div style="font-size: 18px; font-weight: bold; color: #757575;">${totalComparisons}</div>
//             <div style="font-size: 11px; color: #666;">Photos Checked</div>
//           </div>
//         </div>
//         <div style="font-size: 12px; color: #555; background: rgba(255,255,255,0.7); padding: 8px; border-radius: 4px;">
//           ${clipResults.message || 'Image comparison complete'}
//         </div>
//       `;
      
//       clipSection.appendChild(clipDetails);
      
//       // Show individual comparisons if available
//       if (clipResults.comparisons && clipResults.comparisons.length > 0) {
//         const comparisonsDetails = document.createElement("details");
//         comparisonsDetails.style.marginTop = "10px";
//         comparisonsDetails.style.fontSize = "12px";
        
//         const summary = document.createElement("summary");
//         summary.textContent = "View detailed comparisons";
//         summary.style.cursor = "pointer";
//         summary.style.fontWeight = "bold";
//         summary.style.color = "#555";
//         comparisonsDetails.appendChild(summary);
        
//         const comparisonsList = document.createElement("div");
//         comparisonsList.style.marginTop = "8px";
//         comparisonsList.style.maxHeight = "200px";
//         comparisonsList.style.overflowY = "auto";
        
//         clipResults.comparisons.slice(0, 5).forEach((comp, idx) => {
//           const score = comp.match_score || 0;
//           const verdict = comp.verdict || 'UNKNOWN';
//           const verdictColor = score >= 70 ? '#4caf50' : score >= 50 ? '#ff9800' : '#f44336';
          
//           const compDiv = document.createElement("div");
//           compDiv.style.padding = "6px";
//           compDiv.style.margin = "4px 0";
//           compDiv.style.background = "white";
//           compDiv.style.borderLeft = `3px solid ${verdictColor}`;
//           compDiv.style.borderRadius = "3px";
          
//           compDiv.innerHTML = `
//             <div><strong>Review Photo ${idx + 1}:</strong> ${score}% match - ${verdict}</div>
//             <div style="font-size: 10px; color: #666;">${comp.explanation || ''}</div>
//           `;
          
//           comparisonsList.appendChild(compDiv);
//         });
        
//         comparisonsDetails.appendChild(comparisonsList);
//         clipSection.appendChild(comparisonsDetails);
//       }
      
//       container.appendChild(clipSection);
//     }
    
//     // ================================================================
//     // SECTION 4: SELLER TRUSTWORTHINESS
//     // ================================================================
//     const sellerData = resp?.data || {};
//     const sellerSection = document.createElement("div");
//     sellerSection.style.marginBottom = "15px";
//     sellerSection.style.padding = "10px";
//     sellerSection.style.backgroundColor = "#f9fafb";
//     sellerSection.style.borderRadius = "6px";
    
//     const sellerTitle = document.createElement("strong");
//     sellerTitle.textContent = "👤 Seller Information:";
//     sellerSection.appendChild(sellerTitle);
    
//     const sellerDetails = document.createElement("div");
//     sellerDetails.style.marginTop = "8px";
//     sellerDetails.style.fontSize = "13px";
    
//     const sellerAge = sellerData.sellerAgeMonths;
//     const salesCount = sellerData.salesCount;
//     const reviewCount = sellerData.reviews?.length || 0;
    
//     let sellerTrustLevel = "Unknown";
//     let sellerTrustColor = "#666";
    
//     if (sellerAge >= 24 && salesCount >= 1000) {
//       sellerTrustLevel = "Very Trustworthy";
//       sellerTrustColor = "#22c55e";
//     } else if (sellerAge >= 12 && salesCount >= 100) {
//       sellerTrustLevel = "Trustworthy";
//       sellerTrustColor = "#84cc16";
//     } else if (sellerAge >= 6 || salesCount >= 50) {
//       sellerTrustLevel = "Moderately Trustworthy";
//       sellerTrustColor = "#f59e0b";
//     } else {
//       sellerTrustLevel = "New/Unestablished";
//       sellerTrustColor = "#ef4444";
//     }
    
//     sellerDetails.innerHTML = `
//       <div style="margin-bottom: 4px;">
//         <strong style="color: ${sellerTrustColor};">${sellerTrustLevel}</strong>
//       </div>
//       <div>Shop Age: ${sellerAge ? Math.floor(sellerAge/12) + ' years ' + (sellerAge%12) + ' months' : 'Unknown'}</div>
//       <div>Total Sales: ${salesCount?.toLocaleString() || 'Unknown'}</div>
//       <div>Reviews: ${reviewCount}</div>
//     `;
//     sellerSection.appendChild(sellerDetails);
//     container.appendChild(sellerSection);
    
//     // ================================================================
//     // SECTION 5: SENTIMENT ANALYSIS
//     // ================================================================
//     const sentiment = resp?.aiAnalysis?.sentiment;
//     if (sentiment && sentiment.total_reviews > 0) {
//       const sentimentSection = document.createElement("div");
//       sentimentSection.style.marginBottom = "15px";
//       sentimentSection.style.padding = "10px";
//       sentimentSection.style.backgroundColor = "#f0f9ff";
//       sentimentSection.style.borderRadius = "6px";
//       sentimentSection.style.border = "1px solid #bfdbfe";
      
//       const sentimentTitle = document.createElement("strong");
//       sentimentTitle.textContent = "💭 Sentiment Analysis:";
//       sentimentSection.appendChild(sentimentTitle);
      
//       const sentimentDetails = document.createElement("div");
//       sentimentDetails.style.marginTop = "8px";
//       sentimentDetails.style.fontSize = "13px";
      
//       const positivePct = sentiment.sentiment_percentages?.positive || 0;
//       const negativePct = sentiment.sentiment_percentages?.negative || 0;
//       const neutralPct = sentiment.sentiment_percentages?.neutral || 0;
//       const avgSentiment = sentiment.average_sentiment || 0;
//       const suspiciousCount = sentiment.sentiment_rating_mismatch_count || 0;
      
//       sentimentDetails.innerHTML = `
//         <div>Positive: <span style="color: #22c55e; font-weight: bold;">${positivePct}%</span></div>
//         <div>Negative: <span style="color: #ef4444; font-weight: bold;">${negativePct}%</span></div>
//         <div>Neutral: <span style="color: #666; font-weight: bold;">${neutralPct}%</span></div>
//         <div style="margin-top: 4px;">Average Sentiment: ${avgSentiment.toFixed(3)}</div>
//         ${suspiciousCount > 0 ? `<div style="margin-top: 6px; color: #dc2626; font-weight: bold;">⚠️ ${suspiciousCount} suspicious review(s) detected</div>` : ''}
//       `;
//       sentimentSection.appendChild(sentimentDetails);
//       container.appendChild(sentimentSection);
//     }
    
//     // ================================================================
//     // SECTION 6: WARNINGS & RECOMMENDATIONS
//     // ================================================================
//     if (warnings.length > 0) {
//       const warningsSection = document.createElement("div");
//       warningsSection.style.marginBottom = "10px";
      
//       const warningsTitle = document.createElement("strong");
//       warningsTitle.textContent = "⚠️ Key Findings:";
//       warningsSection.appendChild(warningsTitle);
      
//       const warningsList = document.createElement("ul");
//       warningsList.style.marginTop = "6px";
//       warningsList.style.fontSize = "12px";
//       warningsList.style.paddingLeft = "20px";
      
//       warnings.forEach(warning => {
//         const li = document.createElement("li");
//         li.textContent = warning;
//         li.style.marginBottom = "4px";
        
//         // Color code warnings
//         if (warning.includes('🚩')) {
//           li.style.color = '#dc2626';
//         } else if (warning.includes('✅')) {
//           li.style.color = '#22c55e';
//         } else if (warning.includes('⚠️')) {
//           li.style.color = '#f59e0b';
//         }
        
//         warningsList.appendChild(li);
//       });
      
//       warningsSection.appendChild(warningsList);
//       container.appendChild(warningsSection);
//     }
    
//     // ================================================================
//     // SECTION 7: RECOMMENDATION
//     // ================================================================
//     if (backendRisk?.message) {
//       const recommendationSection = document.createElement("div");
//       recommendationSection.style.marginTop = "15px";
//       recommendationSection.style.padding = "12px";
//       recommendationSection.style.backgroundColor = riskScore < 40 ? "#f0fdf4" : (riskScore < 60 ? "#fef3c7" : "#fee2e2");
//       recommendationSection.style.borderRadius = "6px";
//       recommendationSection.style.border = `2px solid ${riskColor}`;
//       recommendationSection.style.fontWeight = "bold";
//       recommendationSection.style.fontSize = "13px";
//       recommendationSection.textContent = backendRisk.message;
      
//       container.appendChild(recommendationSection);
//     }
    
//     signalsEl.appendChild(container);
//   }

//   if (rawEl) rawEl.textContent = JSON.stringify(resp, null, 2);
// }

// async function runScan() {
//   const statusEl = el("status");
//   const scoreEl = el("score");
//   const signalsEl = el("signals");
//   const rawEl = el("raw");

//   console.log("🔵 [POPUP] Button clicked!");

//   if (statusEl) statusEl.textContent = "Scanning…";
//   if (scoreEl) scoreEl.textContent = "";
//   if (signalsEl) signalsEl.innerHTML = "";
//   if (rawEl) rawEl.textContent = "";

//   const tab = await getActiveTab();
//   if (!tab?.id) {
//     console.log("🔴 [POPUP] No active tab");
//     if (statusEl) statusEl.textContent = "No active tab found.";
//     return;
//   }

//   console.log("🔵 [POPUP] Sending message to content script...");

//   chrome.tabs.sendMessage(tab.id, { type: "SCAN_LISTING" }, async (resp) => {
//     if (chrome.runtime.lastError) {
//       const msg = chrome.runtime.lastError.message || "Unknown error";
//       console.log("🔴 [POPUP] Content script error:", msg);
//       if (statusEl) statusEl.textContent = "Error: " + msg;
//       if (rawEl) rawEl.textContent = JSON.stringify({ ok: false, error: msg }, null, 2);
//       return;
//     }

//     console.log("🟢 [POPUP] Received from content script:", resp);
    
//     // Log review images for debugging
//     if (resp?.data?.reviews) {
//       const reviewsWithImages = resp.data.reviews.filter(r => r.images && r.images.length > 0);
//       console.log(`📸 [POPUP] Reviews with images: ${reviewsWithImages.length}/${resp.data.reviews.length}`);
//       reviewsWithImages.slice(0, 3).forEach((review, i) => {
//         console.log(`  Review ${i+1}: ${review.images.length} images`);
//         review.images.forEach((img, j) => {
//           console.log(`    Image ${j+1}: ${img.substring(0, 80)}...`);
//         });
//       });
//     }

//     if (!resp || typeof resp !== "object") {
//       console.log("🔴 [POPUP] Invalid response");
//       if (statusEl) statusEl.textContent = "No/invalid response from content script.";
//       if (rawEl) rawEl.textContent = JSON.stringify(resp, null, 2);
//       return;
//     }

//     if (resp.ok !== true) {
//       console.log("🔴 [POPUP] Scan failed");
//       if (statusEl) statusEl.textContent = "Scan failed (ok=false).";
//       if (rawEl) rawEl.textContent = JSON.stringify(resp, null, 2);
//       return;
//     }

//     // =====================================================================
//     // SEND TO BACKEND FOR AI ANALYSIS
//     // =====================================================================
//     console.log("🟡 [POPUP] Sending to backend...");
//     if (statusEl) statusEl.textContent = "Analyzing with AI (SynthID, CLIP, Sentiment)...";

//     try {
//       console.log("🟡 [POPUP] Calling fetch...");
      
//       const backendResponse = await fetch('http://localhost:5000/analyze', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify(resp)
//       });

//       console.log("🟡 [POPUP] Backend responded with status:", backendResponse.status);

//       if (backendResponse.ok) {
//         const backendData = await backendResponse.json();
//         console.log("🟢 [POPUP] Backend success:", backendData);
        
//         // Store backend analysis results
//         resp.aiAnalysis = backendData.results;
//         resp.aiRisk = backendData.risk;
//         resp.analyzersStatus = backendData.analyzers_status;
        
//         // Log CLIP results
//         if (backendData.results?.clip_similarity) {
//           console.log("🔍 [POPUP] CLIP Similarity Results:", backendData.results.clip_similarity);
//         }
        
//         if (statusEl) statusEl.textContent = "AI analysis complete!";
//       } else {
//         const errorText = await backendResponse.text();
//         console.log("🔴 [POPUP] Backend error:", errorText);
//         if (statusEl) statusEl.textContent = "Backend error: " + backendResponse.status;
//       }
//     } catch (err) {
//       console.log("🔴 [POPUP] Fetch failed:", err);
//       if (statusEl) statusEl.textContent = "Cannot reach backend: " + err.message;
//     }

//     render(resp);
//   });
// }

// document.addEventListener("DOMContentLoaded", () => {
//   console.log("🟢 [POPUP] DOM loaded");
//   const btn = el("scan");
//   if (!btn) {
//     console.log("🔴 [POPUP] Button not found!");
//     return;
//   }
//   console.log("🟢 [POPUP] Button found, adding listener");
//   btn.addEventListener("click", runScan);
// });

console.log("[Listing Inspector] popup.js loaded - WITH CLIP SIMILARITY");

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

  // Get risk data from backend
  const backendRisk = resp?.aiRisk || {};
  const riskScore = backendRisk?.score || 0;
  const riskLevel = backendRisk?.level || 'UNKNOWN';
  const riskColor = backendRisk?.color || '#666';
  const warnings = backendRisk?.warnings || [];
  const breakdown = backendRisk?.breakdown || {};

  // Display overall risk score with color
  if (scoreEl) {
    scoreEl.innerHTML = `<span style="color: ${riskColor}; font-weight: bold;">Risk Score: ${riskScore}/100 - ${riskLevel}</span>`;
  }

  if (signalsEl) {
    signalsEl.innerHTML = "";
    
    // Create main container
    const container = document.createElement("div");
    
    // ================================================================
    // SECTION 1: RISK BREAKDOWN (Category Subscores)
    // ================================================================
    if (Object.keys(breakdown).length > 0) {
      const breakdownSection = document.createElement("div");
      breakdownSection.style.marginBottom = "15px";
      breakdownSection.style.padding = "10px";
      breakdownSection.style.backgroundColor = "#f9fafb";
      breakdownSection.style.borderRadius = "6px";
      
      const breakdownTitle = document.createElement("strong");
      breakdownTitle.textContent = "📊 Risk Breakdown:";
      breakdownSection.appendChild(breakdownTitle);
      
      const breakdownList = document.createElement("div");
      breakdownList.style.marginTop = "8px";
      breakdownList.style.fontSize = "13px";
      
      // Category labels
      const categoryLabels = {
        'reviews': '📝 Reviews',
        'seller': '👤 Seller Credibility',
        'review_photos': '📸 Review Photos (CLIP)',
        'sentiment': '💭 Sentiment',
        'ai_images': '🤖 AI Detection'
      };
      
      for (const [category, score] of Object.entries(breakdown)) {
        const row = document.createElement("div");
        row.style.marginBottom = "4px";
        row.style.display = "flex";
        row.style.justifyContent = "space-between";
        
        const label = categoryLabels[category] || category;
        const scoreColor = score < 0 ? '#22c55e' : (score > 10 ? '#ef4444' : '#666');
        
        row.innerHTML = `
          <span>${label}:</span>
          <span style="color: ${scoreColor}; font-weight: bold;">${score > 0 ? '+' : ''}${score} pts</span>
        `;
        breakdownList.appendChild(row);
      }
      
      breakdownSection.appendChild(breakdownList);
      container.appendChild(breakdownSection);
    }
    
    // ================================================================
    // SECTION 2: AI IMAGE DETECTION
    // ================================================================
    const synthid = resp?.aiAnalysis?.synthid;
    if (synthid) {
      const aiSection = document.createElement("div");
      aiSection.style.marginBottom = "15px";
      aiSection.style.padding = "10px";
      aiSection.style.backgroundColor = synthid.any_ai ? "#fef3c7" : "#f0fdf4";
      aiSection.style.borderRadius = "6px";
      aiSection.style.border = synthid.any_ai ? "1px solid #fbbf24" : "1px solid #86efac";
      
      const aiTitle = document.createElement("strong");
      aiTitle.textContent = synthid.any_ai ? "🤖 AI-Generated Image Detected" : "✅ No AI Images Detected";
      aiSection.appendChild(aiTitle);
      
      if (synthid.any_ai) {
        const aiDetails = document.createElement("div");
        aiDetails.style.marginTop = "6px";
        aiDetails.style.fontSize = "12px";
        
        const result = synthid.results?.[0] || {};
        const confidence = result.confidence || 0;
        
        aiDetails.innerHTML = `
          <div>Confidence: ${confidence}%</div>
          <div style="margin-top: 4px; color: #666;">${result.explanation || 'AI patterns detected in listing image'}</div>
        `;
        aiSection.appendChild(aiDetails);
      }
      
      container.appendChild(aiSection);
    }
    
    // ================================================================
    // SECTION 3: CLIP IMAGE SIMILARITY (NEW!)
    // ================================================================
    const clipResults = resp?.aiAnalysis?.image_similarity;
    if (clipResults && clipResults.analyzed) {
      const clipSection = document.createElement("div");
      clipSection.className = "clip-similarity-section";
      clipSection.style.marginBottom = "15px";
      clipSection.style.padding = "12px";
      clipSection.style.borderRadius = "8px";
      
      const avgScore = clipResults.average_match_score || 0;
      const verified = clipResults.verified_authentic;
      const highMatches = clipResults.high_confidence_matches || 0;
      const totalComparisons = clipResults.total_comparisons || 0;
      
      // Color based on verification status
      const bgColor = verified ? "#f0fdf4" : (avgScore >= 50 ? "#fef3c7" : "#fee2e2");
      const borderColor = verified ? "#86efac" : (avgScore >= 50 ? "#fbbf24" : "#f87171");
      
      clipSection.style.backgroundColor = bgColor;
      clipSection.style.border = `2px solid ${borderColor}`;
      
      const clipTitle = document.createElement("strong");
      clipTitle.textContent = verified ? 
        "🔍 CLIP: Review Photos Verified ✅" : 
        avgScore >= 50 ? "🔍 CLIP: Partial Match Found ⚠️" : "🔍 CLIP: Poor Photo Match 🚩";
      clipSection.appendChild(clipTitle);
      
      const clipDetails = document.createElement("div");
      clipDetails.style.marginTop = "12px";
      clipDetails.style.fontSize = "13px";
      
      clipDetails.innerHTML = `
        <div class="clip-stats-grid" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 10px;">
          <div class="clip-stat-card" style="text-align: center; background: rgba(255,255,255,0.9); padding: 10px 6px; border-radius: 6px; border: 1px solid rgba(0,0,0,0.08);">
            <div class="clip-stat-value" style="font-size: 20px; font-weight: bold; color: ${avgScore >= 70 ? '#22c55e' : avgScore >= 50 ? '#f59e0b' : '#ef4444'};">${avgScore}%</div>
            <div class="clip-stat-label" style="font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">Match Score</div>
          </div>
          <div class="clip-stat-card" style="text-align: center; background: rgba(255,255,255,0.9); padding: 10px 6px; border-radius: 6px; border: 1px solid rgba(0,0,0,0.08);">
            <div class="clip-stat-value" style="font-size: 20px; font-weight: bold; color: #2e7d32;">${highMatches}</div>
            <div class="clip-stat-label" style="font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">High Match</div>
          </div>
          <div class="clip-stat-card" style="text-align: center; background: rgba(255,255,255,0.9); padding: 10px 6px; border-radius: 6px; border: 1px solid rgba(0,0,0,0.08);">
            <div class="clip-stat-value" style="font-size: 20px; font-weight: bold; color: #757575;">${totalComparisons}</div>
            <div class="clip-stat-label" style="font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">Analyzed</div>
          </div>
        </div>
        <div style="font-size: 12px; color: #555; background: rgba(255,255,255,0.8); padding: 10px; border-radius: 6px; border-left: 4px solid ${borderColor};">
          <strong>${clipResults.message || 'Image comparison complete'}</strong>
          <div style="margin-top: 6px; font-size: 11px; color: #666;">
            ${verified ? 
              'Review photos show the same products as in listing images.' :
              avgScore >= 50 ? 
                'Some review photos match listing images, but verification is incomplete.' :
                'Review photos may show different products than listing images.'
            }
          </div>
        </div>
      `;
      
      clipSection.appendChild(clipDetails);
      
      // Show individual comparisons if available
      if (clipResults.comparisons && clipResults.comparisons.length > 0) {
        const comparisonsDetails = document.createElement("details");
        comparisonsDetails.style.marginTop = "10px";
        comparisonsDetails.style.fontSize = "12px";
        
        const summary = document.createElement("summary");
        summary.textContent = "View detailed comparisons";
        summary.style.cursor = "pointer";
        summary.style.fontWeight = "bold";
        summary.style.color = "#555";
        comparisonsDetails.appendChild(summary);
        
        const comparisonsList = document.createElement("div");
        comparisonsList.style.marginTop = "8px";
        comparisonsList.style.maxHeight = "200px";
        comparisonsList.style.overflowY = "auto";
        
        clipResults.comparisons.slice(0, 5).forEach((comp, idx) => {
          const score = comp.match_score || 0;
          const verdict = comp.verdict || 'UNKNOWN';
          const verdictColor = score >= 70 ? '#4caf50' : score >= 50 ? '#ff9800' : '#f44336';
          
          const compDiv = document.createElement("div");
          compDiv.style.padding = "6px";
          compDiv.style.margin = "4px 0";
          compDiv.style.background = "white";
          compDiv.style.borderLeft = `3px solid ${verdictColor}`;
          compDiv.style.borderRadius = "3px";
          
          compDiv.innerHTML = `
            <div><strong>Review Photo ${idx + 1}:</strong> ${score}% match - ${verdict}</div>
            <div style="font-size: 10px; color: #666;">${comp.explanation || ''}</div>
          `;
          
          comparisonsList.appendChild(compDiv);
        });
        
        comparisonsDetails.appendChild(comparisonsList);
        clipSection.appendChild(comparisonsDetails);
      }
      
      container.appendChild(clipSection);
    }
    
    // ================================================================
    // SECTION 4: SELLER TRUSTWORTHINESS
    // ================================================================
    const sellerData = resp?.data || {};
    const sellerSection = document.createElement("div");
    sellerSection.style.marginBottom = "15px";
    sellerSection.style.padding = "10px";
    sellerSection.style.backgroundColor = "#f9fafb";
    sellerSection.style.borderRadius = "6px";
    
    const sellerTitle = document.createElement("strong");
    sellerTitle.textContent = "👤 Seller Information:";
    sellerSection.appendChild(sellerTitle);
    
    const sellerDetails = document.createElement("div");
    sellerDetails.style.marginTop = "8px";
    sellerDetails.style.fontSize = "13px";
    
    const sellerAge = sellerData.sellerAgeMonths;
    const salesCount = sellerData.salesCount;
    const reviewCount = sellerData.reviews?.length || 0;
    
    let sellerTrustLevel = "Unknown";
    let sellerTrustColor = "#666";
    
    if (sellerAge >= 24 && salesCount >= 1000) {
      sellerTrustLevel = "Very Trustworthy";
      sellerTrustColor = "#22c55e";
    } else if (sellerAge >= 12 && salesCount >= 100) {
      sellerTrustLevel = "Trustworthy";
      sellerTrustColor = "#84cc16";
    } else if (sellerAge >= 6 || salesCount >= 50) {
      sellerTrustLevel = "Moderately Trustworthy";
      sellerTrustColor = "#f59e0b";
    } else {
      sellerTrustLevel = "New/Unestablished";
      sellerTrustColor = "#ef4444";
    }
    
    sellerDetails.innerHTML = `
      <div style="margin-bottom: 4px;">
        <strong style="color: ${sellerTrustColor};">${sellerTrustLevel}</strong>
      </div>
      <div>Shop Age: ${sellerAge ? Math.floor(sellerAge/12) + ' years ' + (sellerAge%12) + ' months' : 'Unknown'}</div>
      <div>Total Sales: ${salesCount?.toLocaleString() || 'Unknown'}</div>
      <div>Reviews: ${reviewCount}</div>
    `;
    sellerSection.appendChild(sellerDetails);
    container.appendChild(sellerSection);
    
    // ================================================================
    // SECTION 5: SENTIMENT ANALYSIS
    // ================================================================
    const sentiment = resp?.aiAnalysis?.sentiment;
    if (sentiment && sentiment.total_reviews > 0) {
      const sentimentSection = document.createElement("div");
      sentimentSection.style.marginBottom = "15px";
      sentimentSection.style.padding = "10px";
      sentimentSection.style.backgroundColor = "#f0f9ff";
      sentimentSection.style.borderRadius = "6px";
      sentimentSection.style.border = "1px solid #bfdbfe";
      
      const sentimentTitle = document.createElement("strong");
      sentimentTitle.textContent = "💭 Sentiment Analysis:";
      sentimentSection.appendChild(sentimentTitle);
      
      const sentimentDetails = document.createElement("div");
      sentimentDetails.style.marginTop = "8px";
      sentimentDetails.style.fontSize = "13px";
      
      const positivePct = sentiment.sentiment_percentages?.positive || 0;
      const negativePct = sentiment.sentiment_percentages?.negative || 0;
      const neutralPct = sentiment.sentiment_percentages?.neutral || 0;
      const avgSentiment = sentiment.average_sentiment || 0;
      const suspiciousCount = sentiment.sentiment_rating_mismatch_count || 0;
      
      sentimentDetails.innerHTML = `
        <div>Positive: <span style="color: #22c55e; font-weight: bold;">${positivePct}%</span></div>
        <div>Negative: <span style="color: #ef4444; font-weight: bold;">${negativePct}%</span></div>
        <div>Neutral: <span style="color: #666; font-weight: bold;">${neutralPct}%</span></div>
        <div style="margin-top: 4px;">Average Sentiment: ${avgSentiment.toFixed(3)}</div>
        ${suspiciousCount > 0 ? `<div style="margin-top: 6px; color: #dc2626; font-weight: bold;">⚠️ ${suspiciousCount} suspicious review(s) detected</div>` : ''}
      `;
      sentimentSection.appendChild(sentimentDetails);
      container.appendChild(sentimentSection);
    }
    
    // ================================================================
    // SECTION 6: WARNINGS & RECOMMENDATIONS
    // ================================================================
    if (warnings.length > 0) {
      const warningsSection = document.createElement("div");
      warningsSection.style.marginBottom = "10px";
      
      const warningsTitle = document.createElement("strong");
      warningsTitle.textContent = "⚠️ Key Findings:";
      warningsSection.appendChild(warningsTitle);
      
      const warningsList = document.createElement("ul");
      warningsList.style.marginTop = "6px";
      warningsList.style.fontSize = "12px";
      warningsList.style.paddingLeft = "20px";
      
      warnings.forEach(warning => {
        const li = document.createElement("li");
        li.textContent = warning;
        li.style.marginBottom = "4px";
        
        // Color code warnings
        if (warning.includes('🚩')) {
          li.style.color = '#dc2626';
        } else if (warning.includes('✅')) {
          li.style.color = '#22c55e';
        } else if (warning.includes('⚠️')) {
          li.style.color = '#f59e0b';
        }
        
        warningsList.appendChild(li);
      });
      
      warningsSection.appendChild(warningsList);
      container.appendChild(warningsSection);
    }
    
    // ================================================================
    // SECTION 7: RECOMMENDATION
    // ================================================================
    if (backendRisk?.message) {
      const recommendationSection = document.createElement("div");
      recommendationSection.style.marginTop = "15px";
      recommendationSection.style.padding = "12px";
      recommendationSection.style.backgroundColor = riskScore < 40 ? "#f0fdf4" : (riskScore < 60 ? "#fef3c7" : "#fee2e2");
      recommendationSection.style.borderRadius = "6px";
      recommendationSection.style.border = `2px solid ${riskColor}`;
      recommendationSection.style.fontWeight = "bold";
      recommendationSection.style.fontSize = "13px";
      recommendationSection.textContent = backendRisk.message;
      
      container.appendChild(recommendationSection);
    }
    
    signalsEl.appendChild(container);
  }

  if (rawEl) rawEl.textContent = JSON.stringify(resp, null, 2);
}

async function runScan() {
  const statusEl = el("status");
  const scoreEl = el("score");
  const signalsEl = el("signals");
  const rawEl = el("raw");

  console.log("🔵 [POPUP] Button clicked!");

  if (statusEl) statusEl.textContent = "Scanning…";
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
    
    // Log review images for debugging
    if (resp?.data?.reviews) {
      const reviewsWithImages = resp.data.reviews.filter(r => r.images && r.images.length > 0);
      console.log(`📸 [POPUP] Reviews with images: ${reviewsWithImages.length}/${resp.data.reviews.length}`);
      reviewsWithImages.slice(0, 3).forEach((review, i) => {
        console.log(`  Review ${i+1}: ${review.images.length} images`);
        review.images.forEach((img, j) => {
          console.log(`    Image ${j+1}: ${img.substring(0, 80)}...`);
        });
      });
    }

    if (!resp || typeof resp !== "object") {
      console.log("🔴 [POPUP] Invalid response");
      if (statusEl) statusEl.textContent = "No/invalid response from content script.";
      if (rawEl) rawEl.textContent = JSON.stringify(resp, null, 2);
      return;
    }

    if (resp.ok !== true) {
      console.log("🔴 [POPUP] Scan failed");
      if (statusEl) statusEl.textContent = "Scan failed (ok=false).";
      if (rawEl) rawEl.textContent = JSON.stringify(resp, null, 2);
      return;
    }

    // =====================================================================
    // SEND TO BACKEND FOR AI ANALYSIS
    // =====================================================================
    console.log("🟡 [POPUP] Sending to backend...");
    if (statusEl) statusEl.textContent = "Analyzing with AI (SynthID, CLIP similarity, Sentiment)...";

    try {
      console.log("🟡 [POPUP] Calling fetch...");
      
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
        
        // Store backend analysis results
        resp.aiAnalysis = backendData.results;
        resp.aiRisk = backendData.risk;
        resp.analyzersStatus = backendData.analyzers_status;
        
        // Log image similarity results
        if (backendData.results?.image_similarity) {
          console.log("🔍 [POPUP] Image Similarity Results:", backendData.results.image_similarity);
          const similarity = backendData.results.image_similarity;
          if (similarity.analyzed) {
            console.log(`   Average match: ${similarity.average_match_score}%`);
            console.log(`   Verified authentic: ${similarity.verified_authentic}`);
            console.log(`   High confidence matches: ${similarity.high_confidence_matches}`);
          }
        }
        
        if (statusEl) statusEl.textContent = "Complete! Risk analysis with image verification finished.";
      } else {
        const errorText = await backendResponse.text();
        console.log("🔴 [POPUP] Backend error:", errorText);
        if (statusEl) statusEl.textContent = "Backend error: " + backendResponse.status;
      }
    } catch (err) {
      console.log("🔴 [POPUP] Fetch failed:", err);
      if (statusEl) statusEl.textContent = "Cannot reach AI backend: " + err.message;
    }

    render(resp);
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