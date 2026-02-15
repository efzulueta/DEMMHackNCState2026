"""
image_similarity_analyzer_clip.py
Open-source, local model (OpenCLIP) for image similarity via embeddings.
URL-only input (downloads images like your current code).
No paid APIs.

Core idea:
- Download listing image and review image
- Encode both with OpenCLIP
- Cosine similarity -> match score (0-100)
"""

import logging
import requests
from PIL import Image
from io import BytesIO
import torch
import open_clip

logger = logging.getLogger(__name__)


class ClipImageSimilarityAnalyzer:
    """
    Compare listing image vs review photo using OpenCLIP embeddings.
    """

    def __init__(
        self,
        model_name: str = "ViT-B-32",
        pretrained: str = "laion2b_s34b_b79k",
        timeout: int = 10,
    ):
        self.timeout = timeout
        self.device = "cuda" if torch.cuda.is_available() else "cpu"

        logger.info("🔧 Loading OpenCLIP model...")
        self.model, _, self.preprocess = open_clip.create_model_and_transforms(
            model_name, pretrained=pretrained
        )
        self.model = self.model.to(self.device).eval()

        logger.info(
            f"✅ ClipImageSimilarityAnalyzer initialized: {model_name} ({pretrained}) on {self.device}"
        )

    def download_pil(self, url: str) -> Image.Image | None:
        """Download image URL -> PIL.Image (RGB)."""
        try:
            resp = requests.get(
                url,
                timeout=self.timeout,
                headers={"User-Agent": "Mozilla/5.0"},
            )
            resp.raise_for_status()
            img = Image.open(BytesIO(resp.content))
            if img.mode != "RGB":
                img = img.convert("RGB")
            return img
        except Exception as e:
            logger.error(f"❌ Error downloading image {url[:80]}: {e}")
            return None

    @torch.no_grad()
    def embed_image(self, url: str):
        """Encode image URL -> normalized embedding tensor [1, d]."""
        img = self.download_pil(url)
        if img is None:
            return None

        x = self.preprocess(img).unsqueeze(0).to(self.device)
        feat = self.model.encode_image(x)
        feat = feat / feat.norm(dim=-1, keepdim=True)
        return feat

    def cosine_similarity(self, emb1, emb2) -> float:
        """Cosine similarity of normalized embeddings."""
        return float((emb1 @ emb2.T).item())

    def similarity_to_score(self, sim: float) -> float:
        """
        Convert cosine similarity to a 0-100 score.

        CLIP cosine sim is usually ~[0.15..0.85] in practice for images.
        We use a piecewise mapping with clipping:
          - sim <= 0.20 -> 0
          - sim >= 0.80 -> 100
          - linear in between
        Tune these bounds if needed.
        """
        lo, hi = 0.20, 0.80
        sim_clamped = max(lo, min(hi, sim))
        score = (sim_clamped - lo) / (hi - lo) * 100.0
        return float(score)

    def verdict_from_score(self, score: float):
        """
        Thresholds you can tune:
          70+  -> MATCH
          50+  -> LIKELY_MATCH
          30+  -> UNCLEAR
          else -> MISMATCH
        """
        if score >= 70:
            return "MATCH", "high", True
        elif score >= 50:
            return "LIKELY_MATCH", "medium", True
        elif score >= 30:
            return "UNCLEAR", "low", False
        else:
            return "MISMATCH", "high", False

    def compare_images(self, listing_image_url: str, review_image_url: str) -> dict:
        """
        Compare two images via OpenCLIP cosine similarity.
        """
        try:
            logger.info("Comparing images (OpenCLIP)...")
            logger.info(f"  Listing: {str(listing_image_url)[:80]}...")
            logger.info(f"  Review:  {str(review_image_url)[:80]}...")

            emb1 = self.embed_image(listing_image_url)
            emb2 = self.embed_image(review_image_url)

            if emb1 is None or emb2 is None:
                return {
                    "match_score": 0,
                    "confidence": "low",
                    "explanation": "Failed to download or encode images",
                    "is_same_product": False,
                    "verdict": "ERROR",
                }

            sim = self.cosine_similarity(emb1, emb2)
            score = self.similarity_to_score(sim)
            verdict, confidence, is_same = self.verdict_from_score(score)

            explanation = f"CLIP cosine similarity: {sim:.3f} -> score {score:.1f}/100"

            return {
                "match_score": round(score, 1),
                "confidence": confidence,
                "verdict": verdict,
                "is_same_product": is_same,
                "explanation": explanation,
                "details": {
                    "clip_cosine_similarity": round(sim, 6),
                    "score_mapping": {"lo": 0.20, "hi": 0.80},
                },
            }

        except Exception as e:
            logger.error(f"Error comparing images: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return {
                "match_score": 0,
                "confidence": "low",
                "explanation": f"Error: {str(e)}",
                "is_same_product": False,
                "verdict": "ERROR",
            }

    def analyze_review_photos(self, listing_images: list, review_images: list, max_comparisons: int = 5) -> dict:
        """
        Compare each review image against up to 3 listing images.
        For each review image, take the BEST match.
        """
        if not listing_images or not review_images:
            return {
                "analyzed": False,
                "message": "No images to compare",
                "comparisons": [],
                "average_match_score": 0,
                "verified_authentic": False,
            }

        listing_candidates = listing_images[:3]
        review_candidates = review_images[:max_comparisons]

        logger.info(
            f"🔍 Analyzing {len(review_candidates)} review photos vs {len(listing_candidates)} listing images (OpenCLIP)"
        )

        comparisons = []
        total_score = 0.0
        high_matches = 0

        for i, review_img in enumerate(review_candidates):
            best_result = None
            best_score = -1.0
            best_listing_url = None

            for li in listing_candidates:
                r = self.compare_images(li, review_img)
                s = float(r.get("match_score", 0))
                if s > best_score:
                    best_score = s
                    best_result = r
                    best_listing_url = li

            comparisons.append({
                "review_image_index": i,
                "review_image_url": review_img,
                "best_listing_image_url": best_listing_url,
                **(best_result or {
                    "match_score": 0,
                    "confidence": "low",
                    "explanation": "No result",
                    "is_same_product": False,
                    "verdict": "ERROR"
                })
            })

            score = float((best_result or {}).get("match_score", 0))
            total_score += score
            if score >= 70:
                high_matches += 1

        avg_score = total_score / len(comparisons) if comparisons else 0.0
        verified = (high_matches >= 1 and avg_score >= 60) or high_matches >= 2

        return {
            "analyzed": True,
            "total_comparisons": len(comparisons),
            "comparisons": comparisons,
            "average_match_score": round(float(avg_score), 1),
            "high_confidence_matches": int(high_matches),
            "verified_authentic": bool(verified),
            "message": self._get_message(avg_score, high_matches, len(comparisons)),
            "method": "OpenCLIP (embeddings + cosine)",
            "model": "ViT-B-32 / laion2b_s34b_b79k",
        }

    def _get_message(self, avg_score: float, high_matches: int, total: int) -> str:
        if high_matches >= 2:
            return f"✅ Strong verification: {high_matches}/{total} review photos match"
        elif high_matches == 1 and avg_score >= 60:
            return f"✅ Good verification: Review photos likely show same product"
        elif avg_score >= 50:
            return f"⚠️ Partial match: Some similarity detected"
        else:
            return f"🚩 Poor match: Review photos may show different products"
