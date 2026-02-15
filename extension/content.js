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

function parseNumber(str) {
  if (!str) return null;
  const m = String(str).match(/\d+/);
  return m ? Number(m[0]) : null;
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
      const eventData = wrapper.getAttribute("data-appears-event-data");
      if (eventData) {
        try {
          const obj = JSON.parse(eventData);
          const tenureStr = String(obj.tenure || "");
          if (/month/i.test(tenureStr)) return 0;
          const yrs = parseNumber(tenureStr);
          if (yrs != null) return yrs;
        } catch { }
      }

      const txt = String(wrapper.textContent || "");
      if (/month/i.test(txt)) return 0;
      const yrs = parseNumber(txt);
      if (yrs != null) return yrs;
    }

    const ageEl = Array.from(document.querySelectorAll("span,div,a,p,li,button"))
      .find(n => /(years?\s+on\s+etsy|months?\s+on\s+etsy|on\s+etsy\s+since|since\s+\d{4}|opened\s+in\s+\d{4})/i
        .test((n.textContent || "")));

    if (ageEl) {
      const t = String(ageEl.textContent || "");
      if (/month/i.test(t)) return 0;
      return parseNumber(t);
    }

    return null;
  } catch (e) {
    console.warn("[EXT] getSellerAgeYears failed:", e);
    return null;
  }
}

function getListingCreatedDate() {
  try {
    // Find any node that contains "Listed on ..."
    const el = Array.from(document.querySelectorAll("span,div,p,li,a"))
      .find(n => /listed\s+on/i.test((n.textContent || "")));

    if (!el) return null;

    const txt = (el.textContent || "").trim();
    const m = txt.match(/listed\s+on\s+(.+)/i);
    if (!m) return null;

    // Remove any trailing stuff like "1296 favorites"
    const dateStr = m[1].split("•")[0].trim();

    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function daysSince(date) {
  if (!date) return null;
  const diffMs = Date.now() - date.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
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

  // Seller age often appears as "X years on Etsy" or "X years on Etsy"
  const sellerAge = getSellerAgeYears();

  // Listing age often appears as "Listed on <date>"
  const listedDate = getListingCreatedDate();
  const listingAgeDays = daysSince(listedDate);

  // Review snippets on listing page can be limited; still grab visible review blocks
  const reviewBlocks = Array.from(document.querySelectorAll('[data-review-region], [data-region="reviews"], section'))
    .flatMap(sec => Array.from(sec.querySelectorAll("p,span")))
    .filter(n => n.textContent && n.textContent.trim().length >= 10 && n.textContent.trim().length <= 400);

  // This can be noisy; we’ll keep first ~20 unique short texts
  const reviewTexts = Array.from(new Set(reviewBlocks.map(n => n.textContent.trim()))).slice(0, 20);

  return { title, images, sellerName, salesCount, sellerAge, listingAgeDays, reviewTexts };
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
  const likelyNodes = [
    ...document.querySelectorAll('script[type="application/json"], script:not([src]), [data-page-data], [data-appears-component]'),
  ].slice(0, 250);

  for (const n of likelyNodes) {
    const t = n.textContent;
    if (!t || t.length < 50) continue;

    let m = t.match(/"shop_id"\s*:\s*(\d{4,})/);
    if (m) return Number(m[1]);

    m = t.match(/\bshop_id\b["']?\s*[:=]\s*(\d{4,})/);
    if (m) return Number(m[1]);
  }

  const scripts = Array.from(document.querySelectorAll("script"));
  for (const s of scripts) {
    const t = s.textContent;
    if (!t) continue;
    if (!t.includes("shop_id")) continue;

    let m = t.match(/"shop_id"\s*:\s*(\d{4,})/);
    if (m) return Number(m[1]);

    m = t.match(/\bshop_id\b["']?\s*[:=]\s*(\d{4,})/);
    if (m) return Number(m[1]);
  }

  const bodyText = document.body?.innerText || "";
  if (bodyText.includes("shop_id")) {
    const m = bodyText.match(/"shop_id"\s*:\s*(\d{4,})/);
    if (m) return Number(m[1]);
  }

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
  const meta = document.querySelector(
    'meta[name="csrf-token"], meta[name="csrf_token"], meta[name="etsy-csrf-token"]'
  );
  if (meta?.content) return meta.content;

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
  // Use just [data-review-region] without .review-card class
  const reviewEls = Array.from(container.querySelectorAll('[data-review-region]'));

  console.log(`[DEBUG] Found ${reviewEls.length} review elements in container`);

  for (const el of reviewEls) {
    // Get rating from aria-label
    const ratingEl = el.querySelector('[aria-label*="out of"]');
    let rating = '';
    if (ratingEl) {
      const ariaLabel = ratingEl.getAttribute('aria-label') || '';
      const match = ariaLabel.match(/(\d+)\s+out of/);
      rating = match ? match[1] : '';
    }

    // Get review text - try multiple selectors
    let reviewText = '';
    const textEl = el.querySelector('.wt-text-body') || 
                   el.querySelector('[class*="review-text"]') ||
                   el.querySelector('p');
    if (textEl) {
      reviewText = normalizeSpaces(textEl.textContent);
    }
    
    if (!reviewText || reviewText.length < 5) {
      console.log('[DEBUG] No valid review text, skipping');
      continue;
    }

    // Get reviewer name
    const reviewerLink = el.querySelector('a[href*="/people/"]');
    const reviewer = reviewerLink ? normalizeSpaces(reviewerLink.textContent) : null;

    // Get date
    const dateEl = el.querySelector('.wt-sem-text-secondary, .wt-text-body-small');
    const date = dateEl ? (() => {
      const match = dateEl.textContent.match(DATE_RE);
      return match ? match[0] : null;
    })() : null;

    // Check for video/images
    const hasVideo = el.querySelector('video, [class*="video"]') !== null;
    

    reviews.push({
      text: reviewText.slice(0, 500),
      rating: rating,
      date,
      reviewer,
      hasVideo,
      hasPhoto
    });
  }

  console.log(`[DEBUG] Successfully extracted ${reviews.length} reviews`);
  return reviews;
}

// async function expandAndScrapeReviews() {
//   const reviewsHeading = Array.from(document.querySelectorAll("h2,h3,h4"))
//     .find(h => /reviews for this item/i.test(h.textContent || ""));

//   const reviewsRoot = reviewsHeading?.closest("section") || reviewsHeading?.closest("div") || document;

//   const ctl = findViewAllReviewsControl(reviewsRoot) || findViewAllReviewsControl(document);
//   if (!ctl) return { reviews: [], mode: "no_control_found" };

//   // If it's a link, fetch the page
//   if (ctl.tagName === "A") {
//     const href = ctl.getAttribute("href");
//     if (href) {
//       const url = new URL(href, location.href).toString();
//       const resp = await fetch(url, { credentials: "include" });
//       const html = await resp.text();
//       const doc = new DOMParser().parseFromString(html, "text/html");

//       const h = Array.from(doc.querySelectorAll("h1,h2,h3,h4"))
//         .find(x => /reviews for this item/i.test(x.textContent || ""));
//       const root =
//         h?.closest("section") ||
//         h?.closest("div") ||
//         doc.querySelector('[data-region="reviews"]') ||
//         doc.body;

//       const reviews = parseReviewsFromContainer(root);
//       return { reviews, mode: "fetched_reviews_page", url };
//     }
//   }

//   // It's a button - click it to open dialog
//   console.log('[DEBUG] Clicking view all reviews button');
//   ctl.click();

//   // Wait for dialog to appear (increased wait time)
//   await sleep(2000);

//   // Find the deep-dive-sheet dialog
//   const dialog = await waitFor(
//     () => {
//       const d = document.querySelector('.deep-dive-sheet, [class*="deep-dive"]');
//       if (!d) return null;
      
//       const isVisible = window.getComputedStyle(d).display !== 'none';
//       return isVisible ? d : null;
//     },
//     { timeoutMs: 10000 }
//   );

//   if (!dialog) {
//     console.log('[DEBUG] Dialog not found, checking for inline expansion');
//     const container = document.querySelector('[data-reviews-container]');
//     if (container) {
//       const reviews = parseReviewsFromContainer(container);
//       return { reviews, mode: "clicked_inline" };
//     }
//     return { reviews: [], mode: "clicked_but_not_found" };
//   }

//   console.log('[DEBUG] Dialog opened, collecting reviews from all pages');
  
//   // Wait for first batch of reviews to load (increased wait)
//   await sleep(1500);

//   // Collect reviews from each page
//   const allReviews = [];
//   let currentPage = 1;
//   const maxPages = 20; // Increased limit

//   while (currentPage <= maxPages) {
//     console.log(`[DEBUG] Extracting reviews from page ${currentPage}`);
    
//     // Wait a bit to ensure page is fully loaded
//     await sleep(500);
    
//     // Extract reviews from CURRENT page
//     const pageReviews = parseReviewsFromContainer(dialog);
    
//     console.log(`[DEBUG] Page ${currentPage}: found ${pageReviews.length} reviews`);
    
//     // Add to collection with deduplication
//     pageReviews.forEach(review => {
//       const isDuplicate = allReviews.some(r => 
//         r.text === review.text && r.date === review.date && r.reviewer === review.reviewer
//       );
//       if (!isDuplicate) {
//         allReviews.push(review);
//       }
//     });
    
//     console.log(`[DEBUG] Total unique reviews so far: ${allReviews.length}`);

//     // Look for next page button
//     currentPage++;
//     const nextPageBtn = Array.from(dialog.querySelectorAll('button')).find(btn => {
//       const text = btn.textContent.trim();
//       return text === String(currentPage);
//     });

//     if (!nextPageBtn) {
//       console.log('[DEBUG] No more pagination buttons found');
//       break;
//     }

//     // Click next page
//     console.log(`[DEBUG] Clicking page ${currentPage} button`);
//     nextPageBtn.click();
    
//     // CRITICAL: Wait longer for new page to load (increased from 1200ms to 2000ms)
//     await sleep(2000);
//   }

//   console.log(`[DEBUG] Finished! Total reviews collected: ${allReviews.length}`);

//   return { reviews: allReviews, mode: "dialog_paginated" };
function parseReviewsFromContainer(container) {
  const reviews = [];
  const reviewEls = Array.from(container.querySelectorAll('[data-review-region]'));

  console.log(`[DEBUG] Found ${reviewEls.length} review elements in container`);

  for (const el of reviewEls) {
    // Get rating from aria-label
    const ratingEl = el.querySelector('[aria-label*="out of"]');
    let rating = '';
    if (ratingEl) {
      const ariaLabel = ratingEl.getAttribute('aria-label') || '';
      const match = ariaLabel.match(/(\d+)\s+out of/);
      rating = match ? match[1] : '';
    }

    // Get review text
    let reviewText = '';
    const textEl = el.querySelector('.wt-text-body') || 
                   el.querySelector('[class*="review-text"]') ||
                   el.querySelector('p');
    if (textEl) {
      reviewText = normalizeSpaces(textEl.textContent);
    }
    
    if (!reviewText || reviewText.length < 5) {
      console.log('[DEBUG] No valid review text, skipping');
      continue;
    }

    // Get reviewer name
    const reviewerLink = el.querySelector('a[href*="/people/"]');
    const reviewer = reviewerLink ? normalizeSpaces(reviewerLink.textContent) : null;

    // Get date
    const dateEl = el.querySelector('.wt-sem-text-secondary, .wt-text-body-small');
    const date = dateEl ? (() => {
      const match = dateEl.textContent.match(DATE_RE);
      return match ? match[0] : null;
    })() : null;

    // Check for video
    const hasVideo = el.querySelector('video, [class*="video"]') !== null;

    // Get review images (only actual review photos, not user avatars)
    const images = [];
    const imageElements = el.querySelectorAll('img');
    
    imageElements.forEach(img => {
      let src = img.src || img.getAttribute('data-src');
      
      // Filter out avatars (circular, small images)
      const isCircle = img.className.includes('wt-circle');
      const isSmall = img.width < 50;
      
      // Only include review photos (/iap/), NOT user avatars (/iusa/)
      if (src && src.includes('/iap/') && !isCircle && !isSmall) {
        // Upgrade to full size by replacing size variants
        const fullSrc = src
          .replace(/iap_75x75\./g, 'iap_fullxfull.')
          .replace(/iap_100x100\./g, 'iap_fullxfull.')
          .replace(/iap_300x300\./g, 'iap_fullxfull.')
          .replace(/iap_640x640\./g, 'iap_fullxfull.');
        
        images.push(fullSrc);
      }
    });

    // Deduplicate images
    const uniqueImages = Array.from(new Set(images));

    reviews.push({
      text: reviewText.slice(0, 500),
      rating: rating,
      date,
      reviewer,
      hasVideo,
      hasPhoto: uniqueImages.length > 0,
      images: uniqueImages
    });
  }

  console.log(`[DEBUG] Successfully extracted ${reviews.length} reviews`);
  return reviews;
}

async function expandAndScrapeReviews() {
  const reviewsHeading = Array.from(document.querySelectorAll("h2,h3,h4"))
    .find(h => /reviews for this item/i.test(h.textContent || ""));

  const reviewsRoot = reviewsHeading?.closest("section") || reviewsHeading?.closest("div") || document;

  const ctl = findViewAllReviewsControl(reviewsRoot) || findViewAllReviewsControl(document);
  if (!ctl) return { reviews: [], mode: "no_control_found" };

  // If it's a link, fetch the page
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

  // It's a button - click it to open dialog
  console.log('[DEBUG] Clicking view all reviews button');
  ctl.click();

  // Wait for dialog to appear
  await sleep(2000);

  const dialog = document.querySelector('.deep-dive-sheet, [class*="deep-dive"]');
  
  if (!dialog) {
    console.log('[DEBUG] Dialog not found');
    const container = document.querySelector('[data-reviews-container]');
    if (container) {
      const reviews = parseReviewsFromContainer(container);
      return { reviews, mode: "clicked_inline" };
    }
    return { reviews: [], mode: "clicked_but_not_found" };
  }

  console.log('[DEBUG] Dialog opened');
  
  // Wait for initial reviews to load with retry logic
  let retries = 0;
  while (retries < 10) {
    const initialReviews = dialog.querySelectorAll('[data-review-region]');
    if (initialReviews.length > 0) {
      console.log('[DEBUG] Initial reviews loaded:', initialReviews.length);
      break;
    }
    console.log('[DEBUG] Waiting for reviews to load, retry', retries + 1);
    await sleep(500);
    retries++;
  }

  // Collect reviews from each page
  const allReviews = [];
  let currentPage = 1;
  const maxPages = 20;

  while (currentPage <= maxPages) {
    console.log(`[DEBUG] === PAGE ${currentPage} ===`);
    
    // Wait for page to stabilize
    await sleep(800);
    
    // Count reviews before extraction
    const beforeCount = dialog.querySelectorAll('[data-review-region]').length;
    console.log(`[DEBUG] Review elements on page: ${beforeCount}`);
    
    // Extract reviews from current page
    const pageReviews = parseReviewsFromContainer(dialog);
    console.log(`[DEBUG] Extracted ${pageReviews.length} reviews from page ${currentPage}`);
    
    // Add to collection
    let addedCount = 0;
    pageReviews.forEach(review => {
      const isDuplicate = allReviews.some(r => 
        r.text === review.text && r.reviewer === review.reviewer
      );
      if (!isDuplicate) {
        allReviews.push(review);
        addedCount++;
      }
    });
    
    console.log(`[DEBUG] Added ${addedCount} new reviews, total: ${allReviews.length}`);

    // Find next page button
    currentPage++;
    const allButtons = Array.from(dialog.querySelectorAll('button'));
    const nextPageBtn = allButtons.find(btn => btn.textContent.trim() === String(currentPage));

    if (!nextPageBtn) {
      console.log(`[DEBUG] No button for page ${currentPage} found, stopping`);
      break;
    }

    // Click next page and wait for content to change
    console.log(`[DEBUG] Clicking page ${currentPage}`);
    const beforeClickCount = dialog.querySelectorAll('[data-review-region]').length;
    
    nextPageBtn.click();
    
    // Wait for reviews to change
    let waited = 0;
    let contentChanged = false;
    while (waited < 5000) {
      await sleep(200);
      waited += 200;
      
      const afterClickCount = dialog.querySelectorAll('[data-review-region]').length;
      
      if (afterClickCount !== beforeClickCount) {
        console.log(`[DEBUG] Reviews changed (${beforeClickCount} → ${afterClickCount})`);
        contentChanged = true;
        break;
      }
      
      const firstReviewer = dialog.querySelector('[data-review-region] a[href*="/people/"]');
      const firstReviewerName = firstReviewer?.textContent.trim();
      if (pageReviews[0] && firstReviewerName && firstReviewerName !== pageReviews[0].reviewer) {
        console.log(`[DEBUG] First reviewer changed (${pageReviews[0].reviewer} → ${firstReviewerName})`);
        contentChanged = true;
        break;
      }
    }
    
    if (!contentChanged) {
      console.log('[DEBUG] Content did not change after clicking, stopping');
      break;
    }
    
    await sleep(500);
  }

  console.log(`[DEBUG] ✅ Finished! Total reviews: ${allReviews.length}`);

  return { reviews: allReviews, mode: "dialog_paginated" };
}
// function parseReviewsFromContainer(container) {
//   const reviews = [];
//   const reviewEls = Array.from(container.querySelectorAll('[data-review-region]'));

//   console.log(`[DEBUG] Found ${reviewEls.length} review elements in container`);

//   for (const el of reviewEls) {
//     // Get rating from aria-label
//     const ratingEl = el.querySelector('[aria-label*="out of"]');
//     let rating = '';
//     if (ratingEl) {
//       const ariaLabel = ratingEl.getAttribute('aria-label') || '';
//       const match = ariaLabel.match(/(\d+)\s+out of/);
//       rating = match ? match[1] : '';
//     }

//     // Get review text
//     let reviewText = '';
//     const textEl = el.querySelector('.wt-text-body') || 
//                    el.querySelector('[class*="review-text"]') ||
//                    el.querySelector('p');
//     if (textEl) {
//       reviewText = normalizeSpaces(textEl.textContent);
//     }
    
//     if (!reviewText || reviewText.length < 5) {
//       console.log('[DEBUG] No valid review text, skipping');
//       continue;
//     }

//     // Get reviewer name
//     const reviewerLink = el.querySelector('a[href*="/people/"]');
//     const reviewer = reviewerLink ? normalizeSpaces(reviewerLink.textContent) : null;

//     // Get date
//     const dateEl = el.querySelector('.wt-sem-text-secondary, .wt-text-body-small');
//     const date = dateEl ? (() => {
//       const match = dateEl.textContent.match(DATE_RE);
//       return match ? match[0] : null;
//     })() : null;

//     // Check for video
//     const hasVideo = el.querySelector('video, [class*="video"]') !== null;

//     // Get review images (only user-uploaded photos, not product photos)
//     const images = [];
//     const imageElements = el.querySelectorAll('img');
    
//     imageElements.forEach(img => {
//       let src = img.src || img.getAttribute('data-src');
      
    
      
//     });

//     // Deduplicate images
//     const uniqueImages = Array.from(new Set(images));

//     reviews.push({
//       text: reviewText.slice(0, 500),
//       rating: rating,
//       date,
//       reviewer,
//       hasVideo,
//       hasPhoto: uniqueImages.length > 0,
//       images: uniqueImages
//     });
//   }

//   console.log(`[DEBUG] Successfully extracted ${reviews.length} reviews`);
//   return reviews;
// }
function parseReviewsFromContainer(container) {
  const reviews = [];
  const reviewEls = Array.from(container.querySelectorAll('[data-review-region]'));

  console.log(`[DEBUG] Found ${reviewEls.length} review elements in container`);

  for (const el of reviewEls) {
    // Get rating from aria-label
    const ratingEl = el.querySelector('[aria-label*="out of"]');
    let rating = '';
    if (ratingEl) {
      const ariaLabel = ratingEl.getAttribute('aria-label') || '';
      const match = ariaLabel.match(/(\d+)\s+out of/);
      rating = match ? match[1] : '';
    }

    // Get review text
    let reviewText = '';
    const textEl = el.querySelector('.wt-text-body') || 
                   el.querySelector('[class*="review-text"]') ||
                   el.querySelector('p');
    if (textEl) {
      reviewText = normalizeSpaces(textEl.textContent);
    }
    
    if (!reviewText || reviewText.length < 5) {
      console.log('[DEBUG] No valid review text, skipping');
      continue;
    }

    // Get reviewer name
    const reviewerLink = el.querySelector('a[href*="/people/"]');
    const reviewer = reviewerLink ? normalizeSpaces(reviewerLink.textContent) : null;

    // Get date
    const dateEl = el.querySelector('.wt-sem-text-secondary, .wt-text-body-small');
    const date = dateEl ? (() => {
      const match = dateEl.textContent.match(DATE_RE);
      return match ? match[0] : null;
    })() : null;

    // Check for video
    const hasVideo = el.querySelector('video, [class*="video"]') !== null;

    // Get review images (user-uploaded review photos - both /iap/ and /iusa/)
    const images = [];
    const imageElements = el.querySelectorAll('img');
    
    imageElements.forEach(img => {
      let src = img.src || img.getAttribute('data-src');
      
      // Filter out avatars (circular, small images)
      const isCircle = img.className.includes('wt-circle');
      const isSmall = img.width < 50;
      
      // Include BOTH /iap/ and /iusa/ review photos (excluding small circular avatars)
      if (src && (src.includes('/iap/') || src.includes('/iusa/')) && !isCircle && !isSmall) {
        // Upgrade to full size by replacing size variants
        const fullSrc = src
          .replace(/iap_75x75\./g, 'iap_fullxfull.')
          .replace(/iap_100x100\./g, 'iap_fullxfull.')
          .replace(/iap_300x300\./g, 'iap_fullxfull.')
          .replace(/iap_640x640\./g, 'iap_fullxfull.')
          .replace(/iusa_75x75\./g, 'iusa_fullxfull.')
          .replace(/iusa_300x300\./g, 'iusa_fullxfull.')
          .replace(/iusa_640x640\./g, 'iusa_fullxfull.');
        
        images.push(fullSrc);
      }
    });

    // Deduplicate images
    const uniqueImages = Array.from(new Set(images));

    reviews.push({
      text: reviewText.slice(0, 500),
      rating: rating,
      date,
      reviewer,
      hasVideo,
      hasPhoto: uniqueImages.length > 0,
      images: uniqueImages
    });
  }

  console.log(`[DEBUG] Successfully extracted ${reviews.length} reviews`);
  return reviews;
}

async function getReviewsBestEffort() {
  const listing_id = getListingIdFromUrl();
  const shop_id = findShopIdOnPage();

  console.log("[Listing Inspector] IDs:", { listing_id, shop_id });

  let apiError = null;

  // Try API first if we have IDs
  if (listing_id && shop_id) {
    try {
      const reviews = await fetchAllReviewsViaApi({ listing_id, shop_id });
      return { reviews, mode: "api_deep_dive_reviews", url: null, debug: { listing_id, shop_id } };
    } catch (e) {
      console.log("[Listing Inspector] API failed, falling back to DOM:", e);
      apiError = String(e);
      // Don't return here - continue to DOM scraper below
    }
  }

  // Fallback to DOM scraper
  const r = await expandAndScrapeReviews();
  return { 
    ...r, 
    debug: { 
      listing_id, 
      shop_id, 
      ...(apiError ? { apiError } : {})
    } 
  };
}

/* ---------------------------
   Risk report
--------------------------- */
function computeRiskReport(data) {
  const signals = [];
  let risk = 0;

  // Seller age
  const age = data.sellerAge;
  if (age !== null && age !== undefined) {
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

      // API path uses appreciationPhotoUrl, DOM path uses hasPhoto
      merged.anyReviewHasVideo = reviews.some(r => r.hasVideo) || false;
      merged.anyReviewHasPhoto = reviews.some(r => !!r.appreciationPhotoUrl || !!r.hasPhoto);

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