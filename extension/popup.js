// popup.js — MINIMAL TEST VERSION
console.log("%c🔴 MINIMAL TEST VERSION LOADED", "background: red; color: white; font-size: 16px;");

const BACKEND_URL = 'http://localhost:5000/analyze';

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function el(id) { return document.getElementById(id); }

// Test 1: Just test if we can click the button
document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ DOM Content Loaded");
  
  const btn = document.getElementById("scan");
  if (btn) {
    console.log("✅ Scan button found");
    btn.addEventListener("click", async () => {
      console.log("🔴 BUTTON CLICKED!");
      
      const statusEl = document.getElementById("status");
      const rawEl = document.getElementById("raw");
      
      if (statusEl) statusEl.textContent = "Button clicked!";
      
      try {
        // Test 2: Can we get the active tab?
        console.log("📌 Getting active tab...");
        const tab = await getActiveTab();
        console.log("✅ Active tab:", tab);
        
        if (!tab?.id) {
          throw new Error("No tab ID");
        }
        
        if (statusEl) statusEl.textContent = "Got tab, checking URL...";
        
        // Test 3: What's the URL?
        console.log("🔗 Tab URL:", tab.url);
        
        // Test 4: Can we reach the backend directly?
        if (statusEl) statusEl.textContent = "Testing backend connection...";
        
        const testResponse = await fetch('http://localhost:5000/health');
        const testData = await testResponse.json();
        console.log("✅ Backend health check:", testData);
        
        if (statusEl) statusEl.textContent = "Backend reachable, trying content script...";
        
        // Test 5: Try to get data from content.js
        console.log("📤 Sending message to content.js...");
        
        chrome.tabs.sendMessage(tab.id, { type: "SCAN_LISTING" }, (response) => {
          if (chrome.runtime.lastError) {
            console.error("❌ Content script error:", chrome.runtime.lastError);
            if (statusEl) statusEl.textContent = "Error: " + chrome.runtime.lastError.message;
            if (rawEl) rawEl.textContent = JSON.stringify({ error: chrome.runtime.lastError }, null, 2);
          } else {
            console.log("✅ Content script response:", response);
            if (statusEl) statusEl.textContent = "Got content data!";
            if (rawEl) rawEl.textContent = JSON.stringify(response, null, 2);
          }
        });
        
      } catch (error) {
        console.error("❌ Error:", error);
        if (statusEl) statusEl.textContent = "Error: " + error.message;
        if (rawEl) rawEl.textContent = error.stack;
      }
    });
  } else {
    console.error("❌ Scan button not found!");
  }
});