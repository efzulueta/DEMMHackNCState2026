async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function el(id) { return document.getElementById(id); }

function render(resp) {
  el("status").textContent = "Done.";
  el("score").textContent = `Risk Score: ${resp.report.risk}/100`;

  const ul = document.createElement("ul");
  for (const s of resp.report.signals) {
    const li = document.createElement("li");
    li.textContent = s;
    ul.appendChild(li);
  }
  const signals = el("signals");
  signals.innerHTML = "";
  signals.appendChild(ul);

  el("raw").textContent = JSON.stringify(resp, null, 2);
}

el("scan").addEventListener("click", async () => {
  el("status").textContent = "Scanning…";
  el("signals").innerHTML = "";
  el("score").textContent = "";

  const tab = await getActiveTab();
  if (!tab?.id) return;

  chrome.tabs.sendMessage(tab.id, { type: "SCAN_LISTING" }, (resp) => {
    if (chrome.runtime.lastError || !resp?.ok) {
      el("status").textContent = "Could not scan this page. Open an Etsy listing page and refresh.";
      return;
    }
    render(resp);
  });
});
