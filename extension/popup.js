// popup.js — vFINAL-2026-02-14-01
console.log("[Listing Inspector] popup.js loaded vFINAL-2026-02-14-01");

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

  if (statusEl) statusEl.textContent = "Scanning…";
  if (scoreEl) scoreEl.textContent = "";
  if (signalsEl) signalsEl.innerHTML = "";
  if (rawEl) rawEl.textContent = "";

  const tab = await getActiveTab();
  if (!tab?.id) {
    if (statusEl) statusEl.textContent = "No active tab found.";
    return;
  }

  chrome.tabs.sendMessage(tab.id, { type: "SCAN_LISTING" }, (resp) => {
    if (chrome.runtime.lastError) {
      const msg = chrome.runtime.lastError.message || "Unknown error";
      if (statusEl) statusEl.textContent = "Error: " + msg;
      if (rawEl) rawEl.textContent = JSON.stringify({ ok: false, error: msg }, null, 2);
      return;
    }

    // if content.js returned nothing / wrong shape
    if (!resp || typeof resp !== "object") {
      if (statusEl) statusEl.textContent = "No/invalid response from content script.";
      if (rawEl) rawEl.textContent = JSON.stringify(resp, null, 2);
      return;
    }

    if (resp.ok !== true) {
      if (statusEl) statusEl.textContent = "Scan failed (ok=false).";
      if (rawEl) rawEl.textContent = JSON.stringify(resp, null, 2);
      return;
    }

    render(resp);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const btn = el("scan");
  if (!btn) return;
  btn.addEventListener("click", runScan);
});