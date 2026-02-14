// content.js — scrape listing + click/fetch "View all reviews" + extract reviews
console.log("[Listing Inspector] content.js loaded on", location.href);

/* ---------------------------
   Helpers
--------------------------- */
function text(el) { return el ? el.textContent.trim() : null; }

function firstMatch(selectors) {
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  return null;
}

function normalizeSpaces(s) {
  return (s || "").replace(/\s+/g, " ").trim();
}

function parseCompactNumber(str) {
  if (!str) return null;
  const s = str.trim().toLowerCase();
  const m = s.match(/([\d,.]+)\s*([km])?/i);
  if (!m) return null;
  const num = Number(m[1].replace(/,/g, ""));
  if (!Number.isFinite(num)) return null;
  const suffix = (m[2] || "").toLowerCase();
  if (suffix === "k") return Math.round(num * 1_000);
  if (suffix === "m") return Math.round(num * 1_000_000);
  return Math.round(num);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function waitFor(getterFn, { timeoutMs = 8000, intervalMs = 200 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const v = getterFn();
    if (v) return v;
    await sleep(intervalMs);
  }
  return null;
}

function norm(s) { return normalizeSpaces(s); }

/* ---------------------------
   JSON-LD extraction
--------------------------- */
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

function normalizeLdImages(images) {
  if (!images) return [];
  const arr = Array.isArray(images) ? images : [images];
  return arr
    .map(img => (typeof img === "string" ? img : (img?.contentURL || img?.url || img?.thumbnail || null)))
    .filter(Boolean);
}

function extractFromJsonLd() {
  const ld = getJsonLd();
  const product = ld.find(x =>
    x && (x["@type"] === "Product" || (Array.isArray(x["@type"]) && x["@type"].includes("Product")))
  );
  if (!product) return null;

  const images = normalizeLdImages(product.image);
  const title = product.name || null;
  const seller = product.brand?.name || product.seller?.name || null;
  return { title, images, sellerName: seller };
}

/* ---------------------------
   DOM extraction
--------------------------- */
function getSellerAgeYears() {
  try {
    const wrapper =
      document.querySelector('[data-appears-component-name="lp_seller_cred_tenure"]') ||
      document.querySelector('[data-appears-component-name*="seller_cred_tenure"]');

    if (wrapper) {
      // 1) Try attribute first
      const eventData = wrapper.getAttribute("data-appears-event-data");
      if (eventData) {
        try {
          const obj = JSON.parse(eventData);
          const tenureStr = String(obj.tenure || "");
          if (/month/i.test(tenureStr)) return 0;            // <-- months => 0 years
          const yrs = parseNumber(tenureStr);
          if (yrs != null) return yrs;
        } catch { }
      }

      // 2) Fallback: visible text
      const txt = String(wrapper.textContent || "");
      if (/month/i.test(txt)) return 0;                     // <-- months => 0 years
      const yrs = parseNumber(txt);
      if (yrs != null) return yrs;
    }

    // 3) Fallback scan
    const ageEl = Array.from(document.querySelectorAll("span,div,a,p,li,button"))
      .find(n => /(years?\s+on\s+etsy|months?\s+on\s+etsy|on\s+etsy\s+since|since\s+\d{4}|opened\s+in\s+\d{4})/i
        .test((n.textContent || "")));

    if (ageEl) {
      const t = String(ageEl.textContent || "");
      if (/month/i.test(t)) return 0;                       // <-- months => 0 years
      return parseNumber(t);
    }

    return null;
  } catch (e) {
    console.warn("[EXT] getSellerAgeYears failed:", e);
    return null;
  }
}

function extractFromDom() {
  const titleEl = firstMatch(['h1[data-buy-box-listing-title="true"]', "h1"]);
  const title = text(titleEl);

  const imgEls = Array.from(document.querySelectorAll("img")).filter(img => {
    const src = img.currentSrc || img.src;
    if (!src) return false;
    return src.includes("etsystatic.com") && (img.width >= 200 || img.naturalWidth >= 200);
  });
  const images = Array.from(new Set(imgEls.map(img => img.currentSrc || img.src))).slice(0, 30);

  const shopNameEl = firstMatch([
    'a[data-shop-name="true"]',
    'a[href*="/shop/"]',
    '[data-shop-name] a',
  ]);
  const sellerName = text(shopNameEl);

  const salesEl = Array.from(document.querySelectorAll("span,div"))
    .find(n => /sales/i.test(n.textContent) && /\d/.test(n.textContent) && n.textContent.length < 120);
  const salesCount = parseCompactNumber(salesEl?.textContent || null);

  const sinceEl = Array.from(document.querySelectorAll("span,div"))
    .find(n => /on etsy since/i.test(n.textContent || ""));
  const sinceYear = sinceEl ? parseCompactNumber(sinceEl.textContent) : null;
  const sellerAge = getSellerAgeYears();

  const listedEl = Array.from(document.querySelectorAll("span,div"))
    .find(n => /listed on/i.test(n.textContent || ""));
  const listedText = listedEl ? normalizeSpaces(listedEl.textContent) : null;

  return { title, images, sellerName, salesCount, sinceYear, listedText };
  // This can be noisy; we’ll keep first ~20 unique short texts
  const reviewTexts = Array.from(new Set(reviewBlocks.map(n => n.textContent.trim()))).slice(0, 20);

  return { title, images, sellerName, salesCount, sellerAge, reviewTexts };
}

/* ---------------------------
   Reviews: API (deep_dive_reviews) + fallback DOM scraper
--------------------------- */
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DATE_RE = new RegExp(`\\b(${MONTHS.join("|")})\\s+\\d{1,2},\\s+\\d{4}\\b`);

function getListingIdFromUrl() {
  const m = location.pathname.match(/\/listing\/(\d+)\b/);
  return m ? Number(m[1]) : null;
}

function findShopIdOnPage() {
  // A) Best: find in any inline JSON snippets visible in the DOM (Etsy embeds many specs)
  // Scan the FULL textContent of a limited set of nodes that are likely to contain it.
  // This is faster and more reliable than innerHTML slicing.
  const likelyNodes = [
    ...document.querySelectorAll('script[type="application/json"], script:not([src]), [data-page-data], [data-appears-component]'),
  ].slice(0, 250); // cap to avoid huge work

  for (const n of likelyNodes) {
    const t = n.textContent;
    if (!t || t.length < 50) continue;

    let m = t.match(/"shop_id"\s*:\s*(\d{4,})/);
    if (m) return Number(m[1]);

    m = t.match(/\bshop_id\b["']?\s*[:=]\s*(\d{4,})/);
    if (m) return Number(m[1]);
  }

  // B) Next: scan all script tags (no 2MB cutoff; but bail early per script)
  const scripts = Array.from(document.querySelectorAll("script"));
  for (const s of scripts) {
    const t = s.textContent;
    if (!t) continue;

    // quick reject: if it doesn't even contain shop_id substring, skip
    if (!t.includes("shop_id")) continue;

    let m = t.match(/"shop_id"\s*:\s*(\d{4,})/);
    if (m) return Number(m[1]);

    m = t.match(/\bshop_id\b["']?\s*[:=]\s*(\d{4,})/);
    if (m) return Number(m[1]);
  }

  // C) Fallback: look for JSON-looking blobs in body text (your earlier output had it there)
  const bodyText = document.body?.innerText || "";
  if (bodyText.includes("shop_id")) {
    const m = bodyText.match(/"shop_id"\s*:\s*(\d{4,})/);
    if (m) return Number(m[1]);
  }

  // D) Fallback: sometimes it exists as a data attribute
  const attrEl =
    document.querySelector("[data-shop-id]") ||
    document.querySelector("[data-shopid]") ||
    document.querySelector("[data-shop_id]");
  if (attrEl) {
    const v = attrEl.getAttribute("data-shop-id")
      || attrEl.getAttribute("data-shopid")
      || attrEl.getAttribute("data-shop_id");
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }

  return null;
}

function getCsrfToken() {
  // Meta tags (common)
  const meta = document.querySelector(
    'meta[name="csrf-token"], meta[name="csrf_token"], meta[name="etsy-csrf-token"]'
  );
  if (meta?.content) return meta.content;

  // Cookie fallback (names vary)
  const m = document.cookie.match(/(?:^|;\s*)(csrf_token|csrfToken|etsy_csrf_token)=([^;]+)/i);
  return m ? decodeURIComponent(m[2]) : null;
}

async function readBodySnippet(resp, max = 200) {
  try {
    const t = await resp.text();
    return t.slice(0, max);
  } catch {
    return "";
  }
}
//comments
async function fetchAllReviewsViaApi({ listing_id, shop_id, sort_option = "Relevancy", throttleMs = 250 }) {
  const url = "https://www.etsy.com/api/v3/ajax/bespoke/member/neu/specs/deep_dive_reviews";
  const csrf = getCsrfToken();

  const all = [];
  let page = 1;
  let totalPages = 1;
  const seen = new Set();

  while (page <= totalPages) {
    const payload = {
      log_performance_metrics: true,
      runtime_analysis: false,
      specs: {
        deep_dive_reviews: [
          "Etsy\\Modules\\ListingPage\\Reviews\\DeepDive\\AsyncApiSpec",
          {
            listing_id,
            shop_id,
            scope: "listingReviews",
            page,
            sort_option,
            rating_filter: null,
            review_highlight_transaction_id: null,
            tag_filters: [],
            photo_aesthetics_ranking_dataset_version: "v1",
            should_lazy_load_images: false,
            should_show_variations: false,
          },
        ],
      },
    };

    const resp = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        "x-requested-with": "XMLHttpRequest",
        ...(csrf ? { "x-csrf-token": csrf } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const snip = await readBodySnippet(resp);
      throw new Error(`deep_dive_reviews HTTP ${resp.status} ${resp.statusText}; body_snip=${snip}`);
    }

    let json;
    try {
      json = await resp.json();
    } catch {
      const snip = await readBodySnippet(resp);
      throw new Error(`deep_dive_reviews invalid JSON; body_snip=${snip}`);
    }

    const jsData = json?.jsData;
    if (!jsData) {
      throw new Error(`deep_dive_reviews missing jsData; keys=${Object.keys(json || {}).join(",")}`);
    }

    totalPages = Number(jsData.totalPages || 1);

    const pageReviews = Array.isArray(jsData.reviews) ? jsData.reviews : [];
    for (const r of pageReviews) {
      const id =
        r?.transactionId ??
        `${r?.buyerInfo?.profileUrl ?? ""}|${r?.reviewInfo?.reviewDate ?? ""}|${r?.reviewContent?.reviewText ?? ""}`;

      if (seen.has(id)) continue;
      seen.add(id);

      all.push({
        transactionId: r?.transactionId ?? null,
        rating: r?.reviewInfo?.rating ?? null,
        date: r?.reviewInfo?.reviewDate ?? null,
        isRecommended: r?.reviewInfo?.isRecommended ?? null,

        buyerName: r?.buyerInfo?.name ?? null,
        buyerProfileUrl: r?.buyerInfo?.profileUrl ?? null,
        buyerAvatarUrl: r?.buyerInfo?.avatarUrl ?? null,

        text: r?.reviewContent?.reviewText ?? null,
        textTranslated: r?.reviewContent?.reviewTextTranslated ?? null,
        appreciationPhotoUrl: r?.reviewContent?.appreciationPhotoUrl ?? null,

        sellerResponse: r?.sellerResponse ?? null,
        listingTitle: r?.reviewInfo?.transactionData?.listingTitle ?? null,
        listingUrl: r?.reviewInfo?.transactionData?.listingUrl
          ? new URL(r.reviewInfo.transactionData.listingUrl, location.origin).toString()
          : null,
      });
    }

    page += 1;
    if (page <= totalPages) await sleep(throttleMs);
  }

  return all;
}

function findViewAllReviewsControl(root = document) {
  // Most reliable: attribute you already found
  const direct = root.querySelector('[data-view-all-reviews-button]');
  if (direct) return direct;

  const candidates = Array.from(root.querySelectorAll("a, button"))
    .filter(el => {
      const t = norm(el.innerText || el.textContent);
      if (!t) return false;
      return (
        /view all reviews/i.test(t) ||
        /show all reviews/i.test(t) ||
        /see all reviews/i.test(t) ||
        (/view all/i.test(t) && /reviews/i.test(t))
      );
    });
  if (candidates.length) return candidates[0];

  const aria = Array.from(root.querySelectorAll("a[aria-label],button[aria-label]"))
    .find(el => /reviews/i.test(el.getAttribute("aria-label") || ""));
  return aria || null;
}

function parseReviewsFromContainer(container) {
  const reviews = [];
  const reviewEls = Array.from(container.querySelectorAll('.review-card, [data-review-region]'));

  console.log(`[DEBUG] Found ${reviewEls.length} review cards`);

  for (const el of reviewEls) {
    const textWrapper = el.querySelector('[data-review-text-toggle-wrapper] p, .wt-text-body');
    const reviewText = textWrapper ? normalizeSpaces(textWrapper.textContent) : '';
    if (!reviewText || reviewText.length < 5) continue;

    const ratingEl = el.querySelector('[data-rating], [aria-label*="out of 5 stars"]');
    let rating = '';
    if (ratingEl) {
      const ariaLabel = ratingEl.getAttribute('aria-label') || '';
      const match = ariaLabel.match(/(\d+)\s+out of/);
      rating = match ? match[1] : '';
    }

    const fullText = normalizeSpaces(el.textContent);
    const dateMatch = fullText.match(DATE_RE);
    const date = dateMatch ? dateMatch[0] : null;

    const hasVideo = el.querySelector('video, [class*="video"]') !== null;

    reviews.push({
      text: reviewText.slice(0, 500),
      rating: rating,
      date,
      hasVideo
    });
  }

  console.log(`[DEBUG] Extracted ${reviews.length} reviews`);
  return reviews;
}

async function expandAndScrapeReviews() {
  const reviewsHeading = Array.from(document.querySelectorAll("h2,h3,h4"))
    .find(h => /reviews for this item/i.test(h.textContent || ""));

  const reviewsRoot = reviewsHeading?.closest("section") || reviewsHeading?.closest("div") || document;

  const ctl = findViewAllReviewsControl(reviewsRoot) || findViewAllReviewsControl(document);
  if (!ctl) return { reviews: [], mode: "no_control_found" };

  if (ctl.tagName === "A") {
    const href = ctl.getAttribute("href");
    if (href) {
      const url = new URL(href, location.href).toString();
      const resp = await fetch(url, { credentials: "include" });
      const html = await resp.text();
      const doc = new DOMParser().parseFromString(html, "text/html");

      const h = Array.from(doc.querySelectorAll("h1,h2,h3,h4"))
        .find(x => /reviews for this item/i.test(x.textContent || ""));
      const root =
        h?.closest("section") ||
        h?.closest("div") ||
        doc.querySelector('[data-region="reviews"]') ||
        doc.body;

      const reviews = parseReviewsFromContainer(root);
      return { reviews, mode: "fetched_reviews_page", url };
    }
  }

  ctl.click();

  const modal = await waitFor(
    () => document.querySelector('[role="dialog"], [aria-modal="true"], .wt-modal, [data-review-modal]'),
    { timeoutMs: 8000 }
  );

  if (modal) {
    await sleep(700);
    const reviews = parseReviewsFromContainer(modal);
    return { reviews, mode: "clicked_modal" };
  }

  const expanded = await waitFor(() => {
    const h2 = Array.from(document.querySelectorAll("h2,h3,h4"))
      .find(x => /reviews for this item/i.test(x.textContent || ""));
    return h2?.closest("section") || h2?.closest("div") || null;
  }, { timeoutMs: 8000 });

  if (expanded) {
    await sleep(500);
    const reviews = parseReviewsFromContainer(expanded);
    return { reviews, mode: "clicked_inline" };
  }

  return { reviews: [], mode: "clicked_but_not_found" };
}

async function getReviewsBestEffort() {
  const listing_id = getListingIdFromUrl();
  const shop_id = findShopIdOnPage();

  console.log("[Listing Inspector] IDs:", { listing_id, shop_id });

  if (listing_id && shop_id) {
    try {
      const reviews = await fetchAllReviewsViaApi({ listing_id, shop_id });
      return { reviews, mode: "api_deep_dive_reviews", url: null, debug: { listing_id, shop_id } };
    } catch (e) {
      // IMPORTANT: return the failure so your response shows it
      return {
        reviews: [],
        mode: "api_failed_fallback_dom",
        url: null,
        debug: { listing_id, shop_id, apiError: String(e) }
      };
    }
  }

  const r = await expandAndScrapeReviews();
  return { ...r, debug: { listing_id, shop_id } };
}

/* ---------------------------
   Risk report
--------------------------- */
function computeRiskReport(data) {
  const signals = [];
  let risk = 0;

  // Seller age
  const age = data.sellerAge;
  if (age) {
    if (age < 1) { signals.push("Shop appears very new (< 1 year)."); risk += 15; }
    else if (age < 2) { signals.push("Shop is relatively new (< 2 years)."); risk += 8; }
  }

  // Sales
  if (typeof data.salesCount === "number") {
    if (data.salesCount < 20) { signals.push("Very low sales history."); risk += 12; }
    else if (data.salesCount < 100) { signals.push("Low sales history."); risk += 6; }
  }

  if ((data.reviews || []).length === 0) {
    signals.push("No reviews extracted (may be hidden/lazy-loaded).");
    risk += 5;
  }

  risk = Math.max(0, Math.min(100, risk));
  return { risk, signals };
}

/* ---------------------------
   Message handler
--------------------------- */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "SCAN_LISTING") {
    (async () => {
      const base = extractFromDom();
      const ld = extractFromJsonLd() || {};
      const merged = { ...base, ...Object.fromEntries(Object.entries(ld).filter(([_, v]) => v != null)) };

      let reviews = [];
      let mode = "none";
      let reviewsUrl = null;
      let error = null;

      try {
        const r = await getReviewsBestEffort();
        reviews = r.reviews || [];
        mode = r.mode || "unknown";
        reviewsUrl = r.url || null;
        merged.reviewDebug = r.debug || null;
      } catch (e) {
        error = String(e);
      }

      merged.reviews = reviews;

      // API path uses appreciationPhotoUrl, DOM path uses hasVideo — keep both signals
      merged.anyReviewHasVideo = reviews.some(r => r.hasVideo) || false;
      merged.anyReviewHasPhoto = reviews.some(r => !!r.appreciationPhotoUrl);

      const { risk, signals } = computeRiskReport(merged);

      sendResponse({
        ok: true,
        url: location.href,
        data: merged,
        report: { risk, signals },
        reviewFetch: {
          source: mode,
          reviewsUrl,
          count: reviews.length,
          error
        }
      });
    })();
    return true;
  }
  return true;
});