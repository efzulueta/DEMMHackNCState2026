"""
app.py - API with SynthID detector + Image Similarity + Backboard.io caching
Caches analysis results to avoid redundant processing
"""

import os
import logging
import traceback
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from datetime import datetime
import json

# Load analyzers
from analyzers.synthid_detector import SynthIDDetector
from review_sentiment_analyzer import ReviewSentimentAnalyzer
from listing_risk_calculator import ListingRiskCalculator
from image_similarity_clip import ClipImageSimilarityAnalyzer as ImageSimilarityAnalyzer

# Import Backboard.io cache
from backboard_cache import BackboardCache

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Allow extension to call you

# =====================================================================
# INITIALIZE BACKBOARD.IO CACHE
# =====================================================================
try:
    BACKBOARD_API_KEY = os.getenv('BACKBOARD_API_KEY')
    if BACKBOARD_API_KEY:
        cache = BackboardCache(
            api_key=BACKBOARD_API_KEY,
            base_url=os.getenv('BACKBOARD_BASE_URL', 'https://app.backboard.io/api'),
            assistant_name="Etsy Listing Analyzer Cache",
            default_ttl=int(os.getenv('CACHE_TTL', 86400))  # 24 hours default
        )
        logger.info("✅ Backboard.io cache initialized successfully")
        logger.info(f"   Assistant ID: {cache.assistant_id}")
        logger.info(f"   Thread ID: {cache.thread_id}")
    else:
        cache = None
        logger.warning("⚠️ BACKBOARD_API_KEY not set - caching disabled")
except Exception as e:
    logger.error(f"❌ Failed to initialize Backboard.io cache: {e}")
    cache = None

# Initialize analyzers
try:
    synthid = SynthIDDetector()
    logger.info("✅ SynthID detector initialized successfully")
except Exception as e:
    logger.error(f"❌ Failed to initialize SynthID detector: {e}")
    synthid = None

try:
    sentiment_analyzer = ReviewSentimentAnalyzer()
    logger.info("✅ Sentiment analyzer initialized successfully")
except Exception as e:
    logger.error(f"❌ Failed to initialize sentiment analyzer: {e}")
    sentiment_analyzer = None

try:
    risk_calculator = ListingRiskCalculator()
    logger.info("✅ Risk calculator initialized successfully")
except Exception as e:
    logger.error(f"❌ Failed to initialize risk calculator: {e}")
    risk_calculator = None

# Initialize image similarity analyzer
try:
    image_similarity = ImageSimilarityAnalyzer()
    logger.info("✅ Image similarity analyzer initialized successfully")
except Exception as e:
    logger.error(f"❌ Failed to initialize image similarity analyzer: {e}")
    image_similarity = None

# Placeholders for future analyzers
image_comparator = None
duplicate_detector = None
shop_analyzer = None

@app.route('/analyze', methods=['POST', 'OPTIONS'])
def analyze():
    """
    Main endpoint with Backboard.io caching + Image Similarity
    Checks cache first, only runs analysis if cache miss
    """
    # Handle CORS preflight requests
    if request.method == 'OPTIONS':
        return '', 200
        
    try:
        data = request.json
        if not data:
            logger.error("❌ No JSON data received")
            return jsonify({'success': False, 'error': 'No data received'}), 400
        
        url = data.get('url', 'unknown')
        force_refresh = data.get('force_refresh', False)
        
        logger.info(f"📥 Analyzing: {url}")
        
        # =====================================================================
        # CHECK CACHE FIRST (unless force_refresh)
        # =====================================================================
        if cache and not force_refresh:
            logger.info("🔍 Checking Backboard.io cache...")
            try:
                cached_result = cache.get(url)
                
                if cached_result:
                    logger.info("✨ CACHE HIT! Returning cached analysis")
                    logger.info(f"   Cached at: {cached_result.get('cached_at', 'unknown')}")
                    
                    # Add cache metadata to response
                    response = cached_result.get('analysis_result', {})
                    response['from_cache'] = True
                    response['cached_at'] = cached_result.get('cached_at')
                    
                    return jsonify(response)
                else:
                    logger.info("⊗ Cache MISS - will run full analysis")
            except Exception as e:
                logger.warning(f"⚠️ Cache check failed: {e} - continuing with analysis")
        elif force_refresh:
            logger.info("🔄 Force refresh requested - bypassing cache")

        # =====================================================================
        # CACHE MISS - RUN FULL ANALYSIS
        # =====================================================================
        
        # Show what arrived (keys + samples)
        logger.info("🧾 Top-level keys: %s", sorted(list(data.keys())))
        if isinstance(data.get("data"), dict):
            logger.info("🧾 data keys: %s", sorted(list(data["data"].keys())))

        # Get images from scraper - handle different possible structures
        images = []
        if isinstance(data.get("data"), dict):
            images = data["data"].get("images", []) or []
        elif "images" in data:
            images = data.get("images", []) or []

        logger.info(f"🖼️ Raw images received: {len(images)}")
        logger.info("🖼️ Image sample: %s", json.dumps(images[:3], ensure_ascii=False)[:800])

        # Reviews
        reviews = []
        if isinstance(data.get("data"), dict):
            reviews = data["data"].get("reviews", []) or []
        elif "reviews" in data:
            reviews = data.get("reviews", []) or []

        logger.info(f"📝 Reviews received: {len(reviews)}")
        logger.info("📝 Review sample: %s", json.dumps(reviews[:1], ensure_ascii=False)[:800])

        # Extract review images
        review_images = []
        reviews_with_photos = 0
        for review in reviews:
            review_imgs = review.get('images', [])
            if review_imgs and len(review_imgs) > 0:
                reviews_with_photos += 1
                review_images.extend(review_imgs)
        
        logger.info(f"📸 Review images: {len(review_images)} total from {reviews_with_photos} reviews")
        if review_images:
            logger.info(f"📸 First review image: {review_images[0][:80]}...")

        # =====================================================================
        # RUN SENTIMENT ANALYSIS ON REVIEWS
        # =====================================================================
        sentiment_results = None
        if reviews and sentiment_analyzer:
            logger.info(f"🔍 Running sentiment analysis on {len(reviews)} reviews...")
            try:
                sentiment_results = sentiment_analyzer.analyze_reviews(reviews)
                logger.info(f"✅ Sentiment analysis complete:")
                logger.info(f"   Positive: {sentiment_results['sentiment_counts']['positive']} ({sentiment_results['sentiment_percentages']['positive']}%)")
                logger.info(f"   Negative: {sentiment_results['sentiment_counts']['negative']} ({sentiment_results['sentiment_percentages']['negative']}%)")
                logger.info(f"   Neutral: {sentiment_results['sentiment_counts']['neutral']} ({sentiment_results['sentiment_percentages']['neutral']}%)")
                logger.info(f"   Average sentiment: {sentiment_results['average_sentiment']}")
                logger.info(f"   Suspicious reviews: {sentiment_results['sentiment_rating_mismatch_count']}")
                
            except Exception as e:
                logger.error(f"❌ Error during sentiment analysis: {e}")
                logger.error(traceback.format_exc())
        elif not reviews:
            logger.info("ℹ️ No reviews to analyze")
        elif not sentiment_analyzer:
            logger.warning("⚠️ Sentiment analyzer not initialized")

        # =====================================================================
        # IMAGE SIMILARITY ANALYSIS (Review photos vs Listing images)
        # =====================================================================
        similarity_results = None
        if image_similarity and images and reviews:
            # Extract review images
            review_image_urls = []
            for review in reviews:
                review_imgs = review.get('images', [])
                if review_imgs:
                    review_image_urls.extend(review_imgs)
            
            if review_image_urls and len(images) > 0:
                logger.info(f"🔍 Comparing {len(review_image_urls)} review photos with listing images...")
                try:
                    similarity_results = image_similarity.analyze_review_photos(
                        listing_images=images[:3],  # Use first 3 listing images
                        review_images=review_image_urls[:3],  # Compare up to 3 review photos
                        max_comparisons=3
                    )
                    
                    logger.info(f"✅ Image similarity analysis complete:")
                    logger.info(f"   Average match: {similarity_results.get('average_match_score', 0)}/100")
                    logger.info(f"   Verified authentic: {similarity_results.get('verified_authentic', False)}")
                    logger.info(f"   Message: {similarity_results.get('message', 'N/A')}")
                    
                except Exception as e:
                    logger.error(f"❌ Error during image similarity analysis: {e}")
                    logger.error(traceback.format_exc())
            else:
                logger.info("ℹ️ No review photos available for comparison")
        elif not image_similarity:
            logger.warning("⚠️ Image similarity analyzer not initialized")

        # Extra blocks your extension sends
        logger.info("📦 reviewFetch: %s", json.dumps(data.get("reviewFetch"), ensure_ascii=False)[:800])
        logger.info("📦 report: %s", json.dumps(data.get("report"), ensure_ascii=False)[:800])

        
        # =====================================================================
        # FIXED: Better image URL validation - handles both strings AND objects
        # =====================================================================
        valid_images = []
        for i, img in enumerate(images):
            if img and isinstance(img, dict):
                # It's an image object - try to extract URL from common fields
                url_field = None
                
                # Try different possible field names where URL might be stored
                if 'contentURL' in img and img['contentURL']:
                    url_field = img['contentURL']
                elif 'url' in img and img['url']:
                    url_field = img['url']
                elif 'src' in img and img['src']:
                    url_field = img['src']
                elif 'thumbnail' in img and img['thumbnail']:
                    url_field = img['thumbnail']
                elif 'image' in img and isinstance(img['image'], str):
                    url_field = img['image']
                
                if url_field and isinstance(url_field, str):
                    # Clean up the URL if needed
                    url_field = url_field.strip()
                    if url_field.startswith(('http://', 'https://')):
                        valid_images.append(url_field)
                        logger.info(f"  ✅ Extracted URL from image object {i+1}: {url_field[:100]}...")
                    else:
                        logger.warning(f"  ❌ Extracted URL missing protocol from object {i+1}: {url_field[:100]}")
                else:
                    logger.warning(f"  ❌ Could not extract valid URL from image object {i+1}: {str(img)[:200]}")
                    
            elif img and isinstance(img, str):
                # It's already a string URL
                img = img.strip()
                if img.startswith(('http://', 'https://')):
                    valid_images.append(img)
                    logger.info(f"  ✅ Valid image URL {i+1}: {img[:100]}...")
                else:
                    logger.warning(f"  ❌ Image {i+1} missing http:// or https://: {img[:100]}")
            else:
                logger.warning(f"  ❌ Image {i+1} invalid type: {type(img)} - {str(img)[:100]}")
        
        logger.info(f"📊 Valid images: {len(valid_images)} out of {len(images)}")
        
        # Run SynthID detection
        synthid_results = {
            'status': 'working',
            'results': [],
            'any_ai': False,
            'message': 'No valid images to analyze',
            'images_analyzed': 0,
            'total_images': len(images),
            'valid_images': len(valid_images)
        }
        
        if valid_images and synthid:
            # Analyze first valid image
            first_image = valid_images[0]
            img_preview = first_image[:50] if len(first_image) > 50 else first_image
            logger.info(f"🔍 Analyzing image: {img_preview}...")
            
            try:
                result = synthid.analyze_image(first_image)
                
                if result:
                    ai_detected = result.get('is_ai_generated', False)
                    confidence = result.get('confidence', 0)
                    
                    logger.info(f"  ✅ Analysis complete - AI detected: {ai_detected}")
                    logger.info(f"  📊 Confidence: {confidence}%")
                    logger.info(f"  📝 Explanation: {result.get('explanation', 'No explanation')[:100]}...")
                    
                    if result.get('indicators'):
                        logger.info(f"  🚩 Indicators: {result.get('indicators')}")
                    
                    synthid_results['results'] = [result]
                    synthid_results['any_ai'] = ai_detected
                    synthid_results['message'] = 'Analysis complete'
                    synthid_results['images_analyzed'] = 1
                else:
                    logger.error("  ❌ No result returned from analyzer")
                    synthid_results['message'] = 'Analyzer returned no result'
                    
            except Exception as e:
                logger.error(f"  ❌ Error during image analysis: {e}")
                logger.error(traceback.format_exc())
                synthid_results['message'] = f'Error during analysis: {str(e)}'
        else:
            if not valid_images:
                logger.warning("⚠️ No valid images to analyze")
                if images:
                    # Show sample of first image to help debug
                    sample = str(images[0])[:200] if images else "None"
                    logger.info(f"  First image data sample: {sample}")
            if not synthid:
                logger.warning("⚠️ SynthID detector not initialized")
        
        # =====================================================================
        # CALCULATE COMPREHENSIVE RISK SCORE
        # =====================================================================
        risk = {'score': 0, 'level': 'UNKNOWN', 'message': 'Unable to calculate risk'}
        
        if risk_calculator:
            logger.info("🎯 Calculating comprehensive risk score...")
            try:
                # Prepare data for risk calculator
                risk_data = {
                    'data': data.get('data', {}),
                    'results': {
                        'sentiment': sentiment_results,
                        'synthid': synthid_results,
                        'image_similarity': similarity_results
                    }
                }
                
                risk_assessment = risk_calculator.calculate_risk(risk_data)
                
                risk = {
                    'score': risk_assessment['score'],
                    'level': risk_assessment['level'],
                    'color': risk_assessment['color'],
                    'message': risk_assessment['recommendation'],
                    'warnings': risk_assessment['warnings'],
                    'breakdown': risk_assessment['breakdown']
                }
                
                logger.info(f"📊 RISK ASSESSMENT:")
                logger.info(f"   Score: {risk['score']}/100")
                logger.info(f"   Level: {risk['level']}")
                logger.info(f"   Recommendation: {risk['message']}")
                if risk['warnings']:
                    logger.info(f"   Warnings: {len(risk['warnings'])}")
                    for w in risk['warnings'][:5]:  # Show first 5
                        logger.info(f"      {w}")
                
            except Exception as e:
                logger.error(f"❌ Error calculating risk: {e}")
                logger.error(traceback.format_exc())
        else:
            logger.warning("⚠️ Risk calculator not initialized")
        
        logger.info(f"📊 Final Risk level: {risk['level']} - {risk['message']}")
        
        receipt = {
            "top_level_keys": sorted(list(data.keys())),
            "data_keys": sorted(list(data.get("data", {}).keys())) if isinstance(data.get("data"), dict) else None,
            "url": data.get("url"),
            "images_received": len(images),
            "valid_images": len(valid_images),
            "reviews_received": len((data.get("data") or {}).get("reviews", []) or []),
            "review_fetch": data.get("reviewFetch"),
            "report_received": data.get("report"),
        }

        # Response for extension
        response = {
            'success': True,
            'from_cache': False,
            'receipt': receipt,
            'url': data.get('url', 'unknown'),
            'timestamp': datetime.now().isoformat(),
            'analyzers_status': {
                'synthid': '✅ READY' if synthid else '❌ ERROR',
                'sentiment': '✅ READY' if sentiment_analyzer else '❌ ERROR',
                'image_similarity': '✅ READY' if image_similarity else '❌ ERROR',
                'cache': '✅ READY' if cache else '❌ DISABLED',
                'image_comparator': '⏳ IN PROGRESS',
                'duplicate_detector': '⏳ IN PROGRESS',
                'shop_analyzer': '⏳ IN PROGRESS'
            },
            'results': {
                'synthid': synthid_results,
                'sentiment': sentiment_results if sentiment_results else {'message': 'No sentiment analysis performed'},
                'image_similarity': similarity_results if similarity_results else {'analyzed': False, 'message': 'No review photos to compare'}
            },
            'risk': risk
        }
        
        # =====================================================================
        # STORE IN CACHE for next time
        # =====================================================================
        if cache:
            logger.info("💾 Storing analysis result in Backboard.io cache...")
            try:
                cache_data = {
                    'analysis_result': response,
                    'cached_at': datetime.now().isoformat()
                }
                
                cache_success = cache.set(data.get('url'), cache_data)
                if cache_success:
                    logger.info("✅ Analysis cached successfully in Backboard.io")
                else:
                    logger.warning("⚠️ Failed to cache analysis result")
            except Exception as e:
                logger.warning(f"⚠️ Error caching result: {e}")
        
        logger.info(f"✅ Response sent successfully")
        return jsonify(response)
        
    except Exception as e:
        logger.error(f"❌ Error in analyze endpoint: {e}")
        logger.error(traceback.format_exc())
        return jsonify({
            'success': False, 
            'error': str(e),
            'error_type': str(type(e))
        }), 500

@app.route('/cache/stats', methods=['GET', 'OPTIONS'])
def cache_stats():
    """Get Backboard.io cache statistics"""
    if request.method == 'OPTIONS':
        return '', 200
    
    if not cache:
        return jsonify({
            'success': False,
            'message': 'Cache not initialized'
        }), 503
    
    try:
        stats = cache.get_stats()
        return jsonify({
            'success': True,
            'stats': stats
        })
    except Exception as e:
        logger.error(f"Error getting cache stats: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/cache/clear', methods=['POST', 'OPTIONS'])
def cache_clear():
    """Clear cache for specific URL or all"""
    if request.method == 'OPTIONS':
        return '', 200
    
    if not cache:
        return jsonify({
            'success': False,
            'message': 'Cache not initialized'
        }), 503
    
    try:
        data = request.json or {}
        url = data.get('url')
        
        if url:
            success = cache.delete(url)
            return jsonify({
                'success': success,
                'message': f'Cache cleared for {url}' if success else 'Failed to clear cache'
            })
        else:
            success = cache.clear_all()
            return jsonify({
                'success': success,
                'message': 'All cache cleared' if success else 'Failed to clear all cache'
            })
    except Exception as e:
        logger.error(f"Error clearing cache: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/status', methods=['GET', 'OPTIONS'])
def status():
    """Show which analyzers are ready"""
    if request.method == 'OPTIONS':
        return '', 200
        
    return jsonify({
        'synthid': synthid is not None,
        'sentiment': sentiment_analyzer is not None,
        'image_similarity': image_similarity is not None,
        'risk_calculator': risk_calculator is not None,
        'cache': cache is not None,
        'image_comparator': False,
        'duplicate_detector': False,
        'shop_analyzer': False,
        'api_key_loaded': synthid is not None and hasattr(synthid, 'api_key') and bool(synthid.api_key),
        'message': 'SynthID + Sentiment + Image Similarity + Cache are ready!'
    })

@app.route('/health', methods=['GET', 'OPTIONS'])
def health():
    """Simple health check endpoint"""
    if request.method == 'OPTIONS':
        return '', 200
        
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'synthid_ready': synthid is not None,
        'sentiment_ready': sentiment_analyzer is not None,
        'image_similarity_ready': image_similarity is not None,
        'cache_ready': cache is not None
    })

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    
    print("\n" + "="*70)
    print("🚀 ETSY LISTING ANALYZER API with BACKBOARD.IO CACHING + IMAGE SIMILARITY")
    print("="*70)
    print(f"📡 Port: {port}")
    print(f"🔑 API Key: {'✅ Loaded' if synthid and hasattr(synthid, 'api_key') and synthid.api_key else '❌ Missing'}")
    print(f"🤖 SynthID: {'✅ Ready' if synthid else '❌ Not loaded'}")
    print(f"💬 Sentiment: {'✅ Ready' if sentiment_analyzer else '❌ Not loaded'}")
    print(f"🔍 Image Sim: {'✅ Ready' if image_similarity else '❌ Not loaded'}")
    print(f"🎯 Risk Calc: {'✅ Ready' if risk_calculator else '❌ Not loaded'}")
    print(f"💾 Cache: {'✅ Ready' if cache else '❌ Disabled'}")
    
    if cache:
        print(f"\n💾 BACKBOARD.IO CACHE:")
        print(f"   Assistant ID: {cache.assistant_id}")
        print(f"   Thread ID: {cache.thread_id}")
        print(f"   TTL: {cache.default_ttl}s ({cache.default_ttl/3600:.1f} hours)")
    
    print("\n📊 ANALYZER STATUS:")
    print(f"   SynthID:        {'✅ READY' if synthid else '❌ ERROR'}")
    print(f"   Sentiment:      {'✅ READY' if sentiment_analyzer else '❌ ERROR'}")
    print(f"   Image Similarity: {'✅ READY' if image_similarity else '❌ ERROR'}")
    print(f"   Risk Calc:      {'✅ READY' if risk_calculator else '❌ ERROR'}")
    print(f"   Cache:          {'✅ READY' if cache else '❌ DISABLED'}")
    print(f"   Image Compare:  ⏳ Waiting for teammate")
    print(f"   Duplicate:      ⏳ Waiting for teammate")
    print(f"   Shop:           ⏳ Waiting for teammate")
    print("\n📬 Endpoints:")
    print(f"   POST http://localhost:{port}/analyze")
    print(f"   GET  http://localhost:{port}/status")
    print(f"   GET  http://localhost:{port}/health")
    print(f"   GET  http://localhost:{port}/cache/stats")
    print(f"   POST http://localhost:{port}/cache/clear")
    print("="*70 + "\n")
    
    app.run(host="0.0.0.0", port=port, debug=True, use_reloader=False)
