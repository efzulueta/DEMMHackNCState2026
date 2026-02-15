// // popup.js — vFINAL-2026-02-14-01
// console.log("[Listing Inspector] popup.js loaded vFINAL-2026-02-14-01");

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

//   const risk = resp?.report?.risk ?? 0;
//   const sigs = resp?.report?.signals ?? [];

//   if (scoreEl) scoreEl.textContent = `Risk Score: ${risk}/100`;

//   if (signalsEl) {
//     signalsEl.innerHTML = "";
//     const ul = document.createElement("ul");
//     for (const s of sigs) {
//       const li = document.createElement("li");
//       li.textContent = s;
//       ul.appendChild(li);
//     }
//     signalsEl.appendChild(ul);
//   }

//   if (rawEl) rawEl.textContent = JSON.stringify(resp, null, 2);
// }

// async function runScan() {
//   const statusEl = el("status");
//   const scoreEl = el("score");
//   const signalsEl = el("signals");
//   const rawEl = el("raw");

//   if (statusEl) statusEl.textContent = "Scanning…";
//   if (scoreEl) scoreEl.textContent = "";
//   if (signalsEl) signalsEl.innerHTML = "";
//   if (rawEl) rawEl.textContent = "";

//   const tab = await getActiveTab();
//   if (!tab?.id) {
//     if (statusEl) statusEl.textContent = "No active tab found.";
//     return;
//   }

//   chrome.tabs.sendMessage(tab.id, { type: "SCAN_LISTING" }, (resp) => {
//     if (chrome.runtime.lastError) {
//       const msg = chrome.runtime.lastError.message || "Unknown error";
//       if (statusEl) statusEl.textContent = "Error: " + msg;
//       if (rawEl) rawEl.textContent = JSON.stringify({ ok: false, error: msg }, null, 2);
//       return;
//     }

//     // if content.js returned nothing / wrong shape
//     if (!resp || typeof resp !== "object") {
//       if (statusEl) statusEl.textContent = "No/invalid response from content script.";
//       if (rawEl) rawEl.textContent = JSON.stringify(resp, null, 2);
//       return;
//     }

//     if (resp.ok !== true) {
//       if (statusEl) statusEl.textContent = "Scan failed (ok=false).";
//       if (rawEl) rawEl.textContent = JSON.stringify(resp, null, 2);
//       return;
//     }

//     render(resp);
//   });
// }

// document.addEventListener("DOMContentLoaded", () => {
//   const btn = el("scan");
//   if (!btn) return;
//   btn.addEventListener("click", runScan);
// });

// popup.js — BACKEND-CALLER v1
console.log("[Listing Inspector] popup.js loaded - BACKEND CALLER VERSION");

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
  const risk = resp?.report?.risk ?? 0;
  const sigs = resp?.report?.signals ?? [];
  if (scoreEl) scoreEl.textContent = `Risk Score: ${risk}/100`;

  if (signalsEl) {
    signalsEl.innerHTML = "";
    const ul = document.createElement("ul");
    for (const s of sigs) {
      const li = document.createElement("li");
      li.textContent = s;
      ul.appendChild(li);
    }
    signalsEl.appendChild(ul);
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
    // THIS IS THE PART THAT WAS MISSING - SEND TO BACKEND!
    // =====================================================================
    console.log("🟡 [POPUP] Sending to backend...");
    if (statusEl) statusEl.textContent = "Sending to backend...";

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
        if (statusEl) statusEl.textContent = "Backend received data!";
      } else {
        const errorText = await backendResponse.text();
        console.log("🔴 [POPUP] Backend error:", errorText);
        if (statusEl) statusEl.textContent = "Backend error: " + backendResponse.status;
      }
    } catch (err) {
      console.log("🔴 [POPUP] Fetch failed:", err);
      if (statusEl) statusEl.textContent = "Cannot reach backend: " + err.message;
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
