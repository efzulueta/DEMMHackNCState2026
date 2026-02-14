// content.js
function text(el) {
  return el ? el.textContent.trim() : null;
}

function firstMatch(selectors) {
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  return null;
}

function parseNumber(str) {
  if (!str) return null;
  const cleaned = str.replace(/[^\d.]/g, "");
  if (!cleaned) return null;
  // handle 1,234
  const n = Number(cleaned.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function getJsonLd() {
  const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
  const items = [];
  for (const s of scripts) {
    try {
      const json = JSON.parse(s.textContent);
      if (Array.isArray(json)) items.push(...json);
      else items.push(json);
    } catch {}
  }
  return items;
}

function extractFromJsonLd() {
  const ld = getJsonLd();
  // Etsy typically includes Product schema on listing pages (may vary)
  const product = ld.find(x => x && (x["@type"] === "Product" || (Array.isArray(x["@type"]) && x["@type"].includes("Product"))));
  if (!product) return null;

  const images = Array.isArray(product.image) ? product.image : (product.image ? [product.image] : []);
  const title = product.name || null;

  // offers/seller varies
  const seller = product.brand?.name || product.seller?.name || null;

  return {
    title,
    images,
    sellerName: seller
  };
}

function extractFromDom() {
  // Title
  const titleEl = firstMatch([
    'h1[data-buy-box-listing-title="true"]',
    "h1",
  ]);
  const title = text(titleEl);

  // Images (grab visible gallery images)
  const imgEls = Array.from(document.querySelectorAll('img'))
    .filter(img => {
      const src = img.currentSrc || img.src;
      if (!src) return false;
      // Heuristic: Etsy listing images often come from i.etsystatic.com
      return src.includes("etsystatic.com") && (img.width >= 200 || img.naturalWidth >= 200);
    });

  const images = Array.from(new Set(imgEls.map(img => img.currentSrc || img.src))).slice(0, 20);

  // Shop/Seller name (varies; try a few)
  const shopNameEl = firstMatch([
    'a[data-shop-name="true"]',
    'a[href*="/shop/"]',
    '[data-shop-name] a',
  ]);
  const sellerName = text(shopNameEl);

  // Sales count often appears as "<number> Sales" somewhere near shop header
  const salesEl = Array.from(document.querySelectorAll("span,div"))
    .find(n => /sales/i.test(n.textContent) && /\d/.test(n.textContent) && n.textContent.length < 40);
  const salesCount = parseNumber(salesEl?.textContent || null);

  // "On Etsy since <year>" sometimes present on shop card / about section
  const sinceEl = Array.from(document.querySelectorAll("span,div"))
    .find(n => /on etsy since/i.test(n.textContent));
  const sinceYear = sinceEl ? parseNumber(sinceEl.textContent) : null;

  // Review snippets on listing page can be limited; still grab visible review blocks
  const reviewBlocks = Array.from(document.querySelectorAll('[data-review-region], [data-region="reviews"], section'))
    .flatMap(sec => Array.from(sec.querySelectorAll("p,span")))
    .filter(n => n.textContent && n.textContent.trim().length >= 10 && n.textContent.trim().length <= 400);

  // This can be noisy; we’ll keep first ~20 unique short texts
  const reviewTexts = Array.from(new Set(reviewBlocks.map(n => n.textContent.trim()))).slice(0, 20);

  return { title, images, sellerName, salesCount, sinceYear, reviewTexts };
}

// --- simple sentiment (hackathon-friendly) ---
const POS = ["love", "great", "amazing", "perfect", "excellent", "beautiful", "fast", "quality", "recommend"];
const NEG = ["bad", "poor", "terrible", "awful", "broken", "late", "cheap", "refund", "scam", "fake"];

function sentimentScore(text) {
  if (!text) return 0;
  const t = text.toLowerCase();
  let score = 0;
  for (const w of POS) if (t.includes(w)) score += 1;
  for (const w of NEG) if (t.includes(w)) score -= 1;
  return score;
}

// --- review authenticity heuristics ---
function reviewSignals(reviews) {
  if (!reviews || reviews.length === 0) return { signals: [], score: 0 };

  const signals = [];
  let score = 0;

  // Generic praise ratio
  const generic = reviews.filter(r => r.split(/\s+/).length <= 6).length;
  if (generic / reviews.length > 0.5) {
    signals.push("Many reviews are very short/generic.");
    score += 10;
  }

  // Repetition
  const lower = reviews.map(r => r.toLowerCase());
  const unique = new Set(lower).size;
  if (unique / reviews.length < 0.7) {
    signals.push("Review text appears repetitive.");
    score += 15;
  }

  // Sentiment uniformity
  const s = reviews.map(sentimentScore);
  const allPositive = s.filter(x => x > 0).length / s.length > 0.9;
  if (allPositive && reviews.length >= 8) {
    signals.push("Reviews are overwhelmingly positive with little variation.");
    score += 10;
  }

  return { signals, score };
}

// --- title sanity heuristics ---
function titleSignals(title) {
  if (!title) return { signals: [], score: 0 };
  const signals = [];
  let score = 0;

  if (title.length > 140) {
    signals.push("Title is unusually long (possible keyword stuffing).");
    score += 10;
  }

  const caps = (title.match(/[A-Z]/g) || []).length / Math.max(1, title.length);
  if (caps > 0.35) {
    signals.push("Title has excessive capitalization.");
    score += 8;
  }

  const repeats = title.toLowerCase().split(/\s+/);
  const uniq = new Set(repeats).size / Math.max(1, repeats.length);
  if (uniq < 0.75) {
    signals.push("Title repeats words unusually often.");
    score += 8;
  }

  return { signals, score };
}

// --- overall scoring ---
function computeRisk(data) {
  const signals = [];
  let risk = 0;

  // Seller age
  const year = data.sinceYear;
  if (year) {
    const ageYears = (new Date()).getFullYear() - year;
    data.shopAgeYears = ageYears;
    if (ageYears < 1) { signals.push("Shop appears very new (< 1 year)."); risk += 15; }
    else if (ageYears < 2) { signals.push("Shop is relatively new (< 2 years)."); risk += 8; }
  }

  // Sales
  if (typeof data.salesCount === "number") {
    if (data.salesCount < 20) { signals.push("Very low sales history."); risk += 12; }
    else if (data.salesCount < 100) { signals.push("Low sales history."); risk += 6; }
  }

  // Reviews
  const rs = reviewSignals(data.reviewTexts || []);
  risk += rs.score;
  signals.push(...rs.signals);

  // Title
  const ts = titleSignals(data.title || "");
  risk += ts.score;
  signals.push(...ts.signals);

  // Clamp
  risk = Math.max(0, Math.min(100, risk));
  return { risk, signals };
}

// Listen for popup requests
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "SCAN_LISTING") {
    const base = extractFromDom();
    const ld = extractFromJsonLd() || {};
    const merged = { ...base, ...Object.fromEntries(Object.entries(ld).filter(([_,v]) => v != null)) };

    const { risk, signals } = computeRisk(merged);

    sendResponse({
      ok: true,
      url: location.href,
      data: merged,
      report: { risk, signals }
    });
  }
  return true;
});
