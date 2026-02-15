// popup.js — SUPER SIMPLE TEST VERSION
console.log("🔴 TEST VERSION - I AM ALIVE");

const BACKEND_URL = 'http://localhost:5000/analyze';

document.getElementById("scan").addEventListener("click", async () => {
  console.log("🔴 BUTTON CLICKED!");
  
  document.getElementById("status").textContent = "Button clicked!";
  
  const tab = await chrome.tabs.query({ active: true, currentWindow: true });
  const currentTab = tab[0];
  
  console.log("🔴 Tab URL:", currentTab.url);
  
  // Try to call backend directly FIRST
  try {
    console.log("🔴 Testing backend connection...");
    const testResponse = await fetch('http://localhost:5000/health');
    const testData = await testResponse.json();
    console.log("✅ Backend health check:", testData);
    document.getElementById("status").textContent = "✅ Backend connected!";
  } catch (error) {
    console.error("❌ Backend not reachable:", error);
    document.getElementById("status").textContent = "❌ Backend not running!";
    return;
  }
  
  // Now try to get data from content.js
  console.log("🔴 Getting data from content.js...");
  
  chrome.tabs.sendMessage(currentTab.id, { type: "SCAN_LISTING" }, async (resp) => {
    if (chrome.runtime.lastError) {
      console.error("❌ Content script error:", chrome.runtime.lastError);
      document.getElementById("status").textContent = "❌ Content script error: " + chrome.runtime.lastError.message;
      return;
    }
    
    console.log("✅ Got data from content.js:", resp);
    document.getElementById("status").textContent = "✅ Got page data!";
    document.getElementById("raw").textContent = JSON.stringify(resp, null, 2);
    
    // Send to backend
    try {
      console.log("🔴 Sending to backend...");
      const response = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: resp.url,
          data: resp.data,
          report: resp.report
        })
      });
      
      console.log("✅ Backend response status:", response.status);
      const result = await response.json();
      console.log("✅ Backend result:", result);
      document.getElementById("status").textContent = "✅ Complete!";
      document.getElementById("raw").textContent = JSON.stringify(result, null, 2);
      
    } catch (error) {
      console.error("❌ Backend error:", error);
      document.getElementById("status").textContent = "❌ Backend error";
    }
  });
});