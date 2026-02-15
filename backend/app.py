
# import os
# import logging
# import traceback
# from flask import Flask, request, jsonify
# from flask_cors import CORS
# from dotenv import load_dotenv
# from datetime import datetime
# import json

# # Load analyzers
# from analyzers.synthid_detector import SynthIDDetector
# from review_sentiment_analyzer import ReviewSentimentAnalyzer
# from listing_risk_calculator import ListingRiskCalculator
# from image_similarity_analyzer_free import FreeImageSimilarityAnalyzer as ImageSimilarityAnalyzer

# load_dotenv()
# logging.basicConfig(level=logging.INFO)
# logger = logging.getLogger(__name__)

# app = Flask(__name__)
# CORS(app)  # Allow extension to call you

# def normalize_image_url(img):
#     if isinstance(img, str):
#         s = img.strip()
#         return s if s.startswith(("http://", "https://")) else None
#     if isinstance(img, dict):
#         for k in ("contentURL", "url", "src", "thumbnail", "image"):
#             v = img.get(k)
#             if isinstance(v, str):
#                 v = v.strip()
#                 if v.startswith(("http://", "https://")):
#                     return v
#     return None

# # Initialize ONLY the detectors that are ready
# try:
#     synthid = SynthIDDetector()
#     logger.info("✅ SynthID detector initialized successfully")
# except Exception as e:
#     logger.error(f"❌ Failed to initialize SynthID detector: {e}")
#     synthid = None

# # Initialize sentiment analyzer
# try:
#     sentiment_analyzer = ReviewSentimentAnalyzer()
#     logger.info("✅ Sentiment analyzer initialized successfully")
# except Exception as e:
#     logger.error(f"❌ Failed to initialize sentiment analyzer: {e}")
#     sentiment_analyzer = None

# # Initialize risk calculator
# try:
#     risk_calculator = ListingRiskCalculator()
#     logger.info("✅ Risk calculator initialized successfully")
# except Exception as e:
#     logger.error(f"❌ Failed to initialize risk calculator: {e}")
#     risk_calculator = None

# # Initialize image similarity analyzer
# try:
#     image_similarity = ImageSimilarityAnalyzer()
#     logger.info("✅ Image similarity analyzer initialized successfully")
# except Exception as e:
#     logger.error(f"❌ Failed to initialize image similarity analyzer: {e}")
#     image_similarity = None

# # Placeholders for future analyzers
# image_comparator = None
# duplicate_detector = None
# shop_analyzer = None

# @app.route('/analyze', methods=['POST', 'OPTIONS'])
# def analyze():
#     """
#     Main endpoint - currently only SynthID works
#     Others will be added when teammates finish
#     """
#     # Handle CORS preflight requests
#     if request.method == 'OPTIONS':
#         return '', 200
        
#     try:
#         data = request.json
#         if not data:
#             logger.error("❌ No JSON data received")
#             return jsonify({'success': False, 'error': 'No data received'}), 400
        
#         logger.info(f"📥 Analyzing: {data.get('url', 'unknown')}")

#         # Show what arrived (keys + samples)
#         logger.info("🧾 Top-level keys: %s", sorted(list(data.keys())))
#         if isinstance(data.get("data"), dict):
#             logger.info("🧾 data keys: %s", sorted(list(data["data"].keys())))

#         # Get images from scraper - handle different possible structures
#         images = []
#         if isinstance(data.get("data"), dict):
#             images = data["data"].get("images", []) or []
#         elif "images" in data:
#             images = data.get("images", []) or []

#         logger.info(f"🖼️ Raw images received: {len(images)}")
#         logger.info("🖼️ Image sample: %s", json.dumps(images[:3], ensure_ascii=False)[:800])

#         # Reviews
#         reviews = []
#         if isinstance(data.get("data"), dict):
#             reviews = data["data"].get("reviews", []) or []
#         elif "reviews" in data:
#             reviews = data.get("reviews", []) or []

#         logger.info(f"📝 Reviews received: {len(reviews)}")
#         logger.info("📝 Review sample: %s", json.dumps(reviews[:1], ensure_ascii=False)[:800])

#         # Extract review images
#         review_images = []
#         reviews_with_photos = 0
#         for review in reviews:
#             review_imgs = review.get('images', [])
#             if review_imgs and len(review_imgs) > 0:
#                 reviews_with_photos += 1
#                 review_images.extend(review_imgs)
        
#         logger.info(f"📸 Review images: {len(review_images)} total from {reviews_with_photos} reviews")
#         if review_images:
#             logger.info(f"📸 First review image: {review_images[0][:80]}...")

#         # =====================================================================
#         # RUN SENTIMENT ANALYSIS ON REVIEWS
#         # =====================================================================
#         sentiment_results = None
#         if reviews and sentiment_analyzer:
#             logger.info(f"🔍 Running sentiment analysis on {len(reviews)} reviews...")
#             try:
#                 sentiment_results = sentiment_analyzer.analyze_reviews(reviews)
#                 logger.info(f"✅ Sentiment analysis complete:")
#                 logger.info(f"   Positive: {sentiment_results['sentiment_counts']['positive']} ({sentiment_results['sentiment_percentages']['positive']}%)")
#                 logger.info(f"   Negative: {sentiment_results['sentiment_counts']['negative']} ({sentiment_results['sentiment_percentages']['negative']}%)")
#                 logger.info(f"   Neutral: {sentiment_results['sentiment_counts']['neutral']} ({sentiment_results['sentiment_percentages']['neutral']}%)")
#                 logger.info(f"   Average sentiment: {sentiment_results['average_sentiment']}")
#                 logger.info(f"   Suspicious reviews: {sentiment_results['sentiment_rating_mismatch_count']}")
                
#             except Exception as e:
#                 logger.error(f"❌ Error during sentiment analysis: {e}")
#                 logger.error(traceback.format_exc())
#         elif not reviews:
#             logger.info("ℹ️ No reviews to analyze")
#         elif not sentiment_analyzer:
#             logger.warning("⚠️ Sentiment analyzer not initialized")

#         # =====================================================================
#         # IMAGE SIMILARITY ANALYSIS (Review photos vs Listing images)
#         # =====================================================================
#         similarity_results = None
#         if image_similarity and images and reviews:
#             # Extract review images
#             review_image_urls = []
#             for review in reviews:
#                 review_imgs = review.get('images', [])
#                 if review_imgs:
#                     review_image_urls.extend(review_imgs)
            
#             if review_image_urls and len(images) > 0:
#                 logger.info(f"🔍 Comparing {len(review_image_urls)} review photos with listing images...")
#                 try:
#                     similarity_results = image_similarity.analyze_review_photos(
#                         listing_images=images[:3],  # Use first 3 listing images
#                         review_images=review_image_urls[:3],  # Compare up to 3 review photos
#                         max_comparisons=3
#                     )
                    
#                     logger.info(f"✅ Image similarity analysis complete:")
#                     logger.info(f"   Average match: {similarity_results.get('average_match_score', 0)}/100")
#                     logger.info(f"   Verified authentic: {similarity_results.get('verified_authentic', False)}")
#                     logger.info(f"   Message: {similarity_results.get('message', 'N/A')}")
                    
#                 except Exception as e:
#                     logger.error(f"❌ Error during image similarity analysis: {e}")
#                     logger.error(traceback.format_exc())
#             else:
#                 logger.info("ℹ️ No review photos available for comparison")
#         elif not image_similarity:
#             logger.warning("⚠️ Image similarity analyzer not initialized")

#         # Extra blocks your extension sends
#         logger.info("📦 reviewFetch: %s", json.dumps(data.get("reviewFetch"), ensure_ascii=False)[:800])
#         logger.info("📦 report: %s", json.dumps(data.get("report"), ensure_ascii=False)[:800])

        
#         # =====================================================================
#         # FIXED: Better image URL validation - handles both strings AND objects
#         # =====================================================================
#         valid_images = []
#         for i, img in enumerate(images):
#             if img and isinstance(img, dict):
#                 # It's an image object - try to extract URL from common fields
#                 url = None
                
#                 # Try different possible field names where URL might be stored
#                 if 'contentURL' in img and img['contentURL']:
#                     url = img['contentURL']
#                 elif 'url' in img and img['url']:
#                     url = img['url']
#                 elif 'src' in img and img['src']:
#                     url = img['src']
#                 elif 'thumbnail' in img and img['thumbnail']:
#                     url = img['thumbnail']
#                 elif 'image' in img and isinstance(img['image'], str):
#                     url = img['image']
                
#                 if url and isinstance(url, str):
#                     # Clean up the URL if needed
#                     url = url.strip()
#                     if url.startswith(('http://', 'https://')):
#                         valid_images.append(url)
#                         logger.info(f"  ✅ Extracted URL from image object {i+1}: {url[:100]}...")
#                     else:
#                         logger.warning(f"  ❌ Extracted URL missing protocol from object {i+1}: {url[:100]}")
#                 else:
#                     logger.warning(f"  ❌ Could not extract valid URL from image object {i+1}: {str(img)[:200]}")
                    
#             elif img and isinstance(img, str):
#                 # It's already a string URL
#                 img = img.strip()
#                 if img.startswith(('http://', 'https://')):
#                     valid_images.append(img)
#                     logger.info(f"  ✅ Valid image URL {i+1}: {img[:100]}...")
#                 else:
#                     logger.warning(f"  ❌ Image {i+1} missing http:// or https://: {img[:100]}")
#             else:
#                 logger.warning(f"  ❌ Image {i+1} invalid type: {type(img)} - {str(img)[:100]}")
        
#         logger.info(f"📊 Valid images: {len(valid_images)} out of {len(images)}")
        
#         # Run SynthID detection
#         synthid_results = {
#             'status': 'working',
#             'results': [],
#             'any_ai': False,
#             'message': 'No valid images to analyze',
#             'images_analyzed': 0,
#             'total_images': len(images),
#             'valid_images': len(valid_images)
#         }
        
#         if valid_images and synthid:
#             # Analyze first valid image
#             first_image = valid_images[0]
#             img_preview = first_image[:50] if len(first_image) > 50 else first_image
#             logger.info(f"🔍 Analyzing image: {img_preview}...")
            
#             try:
#                 result = synthid.analyze_image(first_image)
                
#                 if result:
#                     ai_detected = result.get('is_ai_generated', False)
#                     confidence = result.get('confidence', 0)
                    
#                     logger.info(f"  ✅ Analysis complete - AI detected: {ai_detected}")
#                     logger.info(f"  📊 Confidence: {confidence}%")
#                     logger.info(f"  📝 Explanation: {result.get('explanation', 'No explanation')[:100]}...")
                    
#                     if result.get('indicators'):
#                         logger.info(f"  🚩 Indicators: {result.get('indicators')}")
                    
#                     synthid_results['results'] = [result]
#                     synthid_results['any_ai'] = ai_detected
#                     synthid_results['message'] = 'Analysis complete'
#                     synthid_results['images_analyzed'] = 1
#                 else:
#                     logger.error("  ❌ No result returned from analyzer")
#                     synthid_results['message'] = 'Analyzer returned no result'
                    
#             except Exception as e:
#                 logger.error(f"  ❌ Error during image analysis: {e}")
#                 logger.error(traceback.format_exc())
#                 synthid_results['message'] = f'Error during analysis: {str(e)}'
#         else:
#             if not valid_images:
#                 logger.warning("⚠️ No valid images to analyze")
#                 if images:
#                     # Show sample of first image to help debug
#                     sample = str(images[0])[:200] if images else "None"
#                     logger.info(f"  First image data sample: {sample}")
#             if not synthid:
#                 logger.warning("⚠️ SynthID detector not initialized")
        
#         # =====================================================================
#         # CALCULATE COMPREHENSIVE RISK SCORE
#         # =====================================================================
#         risk = {'score': 0, 'level': 'UNKNOWN', 'message': 'Unable to calculate risk'}
        
#         if risk_calculator:
#             logger.info("🎯 Calculating comprehensive risk score...")
#             try:
#                 # Prepare data for risk calculator
#                 risk_data = {
#                     'data': data.get('data', {}),
#                     'results': {
#                         'sentiment': sentiment_results,
#                         'synthid': synthid_results
#                     }
#                 }
                
#                 risk_assessment = risk_calculator.calculate_risk(risk_data)
                
#                 risk = {
#                     'score': risk_assessment['score'],
#                     'level': risk_assessment['level'],
#                     'color': risk_assessment['color'],
#                     'message': risk_assessment['recommendation'],
#                     'warnings': risk_assessment['warnings'],
#                     'breakdown': risk_assessment['breakdown']
#                 }
                
#                 logger.info(f"📊 RISK ASSESSMENT:")
#                 logger.info(f"   Score: {risk['score']}/100")
#                 logger.info(f"   Level: {risk['level']}")
#                 logger.info(f"   Recommendation: {risk['message']}")
#                 if risk['warnings']:
#                     logger.info(f"   Warnings: {len(risk['warnings'])}")
#                     for w in risk['warnings'][:5]:  # Show first 5
#                         logger.info(f"      {w}")
                
#             except Exception as e:
#                 logger.error(f"❌ Error calculating risk: {e}")
#                 logger.error(traceback.format_exc())
#         else:
#             logger.warning("⚠️ Risk calculator not initialized")
        
#         logger.info(f"📊 Final Risk level: {risk['level']} - {risk['message']}")
        
#         receipt = {
#         "top_level_keys": sorted(list(data.keys())),
#         "data_keys": sorted(list(data.get("data", {}).keys())) if isinstance(data.get("data"), dict) else None,
#         "url": data.get("url"),
#         "images_received": len(images),
#         "valid_images": len(valid_images),
#         "reviews_received": len((data.get("data") or {}).get("reviews", []) or []),
#         "review_fetch": data.get("reviewFetch"),
#         "report_received": data.get("report"),
#         }

#         # Response for extension
#         response = {
#             'success': True,
#             'receipt': receipt,
#             'url': data.get('url', 'unknown'),
#             'timestamp': datetime.now().isoformat(),
#             'analyzers_status': {
#                 'synthid': '✅ READY' if synthid else '❌ ERROR',
#                 'sentiment': '✅ READY' if sentiment_analyzer else '❌ ERROR',
#                 'image_comparator': '⏳ IN PROGRESS',
#                 'duplicate_detector': '⏳ IN PROGRESS',
#                 'shop_analyzer': '⏳ IN PROGRESS'
#             },
#             'results': {
#                 'synthid': synthid_results,
#                 'sentiment': sentiment_results if sentiment_results else {'message': 'No sentiment analysis performed'},
#                 'image_similarity': similarity_results if similarity_results else {'analyzed': False, 'message': 'No review photos to compare'}
#             },
#             'risk': risk
#         }
        
#         logger.info(f"✅ Response sent successfully")
#         return jsonify(response)
        
#     except Exception as e:
#         logger.error(f"❌ Error in analyze endpoint: {e}")
#         logger.error(traceback.format_exc())
#         return jsonify({
#             'success': False, 
#             'error': str(e),
#             'error_type': str(type(e))
#         }), 500

# @app.route('/status', methods=['GET', 'OPTIONS'])
# def status():
#     """Show which analyzers are ready"""
#     if request.method == 'OPTIONS':
#         return '', 200
        
#     return jsonify({
#         'synthid': synthid is not None,
#         'image_comparator': False,
#         'duplicate_detector': False,
#         'shop_analyzer': False,
#         'api_key_loaded': synthid is not None and hasattr(synthid, 'api_key') and bool(synthid.api_key),
#         'message': 'SynthID is ready! Others coming soon.'
#     })

# @app.route('/health', methods=['GET', 'OPTIONS'])
# def health():
#     """Simple health check endpoint"""
#     if request.method == 'OPTIONS':
#         return '', 200
        
#     return jsonify({
#         'status': 'healthy',
#         'timestamp': datetime.now().isoformat(),
#         'synthid_ready': synthid is not None
#     })

# if __name__ == '__main__':
#     port = int(os.getenv('PORT', 5000))
    
#     print("\n" + "="*70)
#     print("🚀 SYNTHID DETECTOR API RUNNING")
#     print("="*70)
#     print(f"📡 Port: {port}")
#     print(f"🔑 API Key: {'✅ Loaded' if synthid and hasattr(synthid, 'api_key') and synthid.api_key else '❌ Missing'}")
#     print(f"🤖 SynthID: {'✅ Ready' if synthid else '❌ Not loaded'}")
#     print(f"💬 Sentiment: {'✅ Ready' if sentiment_analyzer else '❌ Not loaded'}")
#     print("\n📊 ANALYZER STATUS:")
#     print(f"   SynthID:        {'✅ READY' if synthid else '❌ ERROR'}")
#     print(f"   Sentiment:      {'✅ READY' if sentiment_analyzer else '❌ ERROR'}")
#     print(f"   Image Compare:  ⏳ Waiting for teammate")
#     print(f"   Duplicate:      ⏳ Waiting for teammate")
#     print(f"   Shop:           ⏳ Waiting for teammate")
#     print("\n📬 Endpoints:")
#     print(f"   POST http://localhost:{port}/analyze")
#     print(f"   GET  http://localhost:{port}/status")
#     print(f"   GET  http://localhost:{port}/health")
#     print("\n🎯 Test with curl:")
#     print(f'   curl -X POST http://localhost:{port}/analyze -H "Content-Type: application/json" -d "{{\\"url\\":\\"test\\",\\"data\\":{{\\"images\\":[\\"https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400\\"]}}}}"')
#     print("="*70 + "\n")
    
#     # app.run(host='0.0.0.0', port=port, debug=True)
#     app.run(host="0.0.0.0", port=port, debug=True, use_reloader=False)


# import os
# import logging
# import traceback
# from flask import Flask, request, jsonify
# from flask_cors import CORS
# from dotenv import load_dotenv
# from datetime import datetime
# import json

# # Load analyzers
# from analyzers.synthid_detector import SynthIDDetector
# from review_sentiment_analyzer import ReviewSentimentAnalyzer
# from listing_risk_calculator import ListingRiskCalculator
# from image_similarity_analyzer_free import FreeImageSimilarityAnalyzer as ImageSimilarityAnalyzer

# load_dotenv()
# logging.basicConfig(level=logging.INFO)
# logger = logging.getLogger(__name__)

# app = Flask(__name__)
# CORS(app)  # Allow extension to call you


# def normalize_image_url(img):
#     """
#     Accepts:
#       - string URL
#       - dict like {contentURL: "..."} or {src: "..."} etc.
#     Returns:
#       - clean http(s) URL string or None
#     """
#     if isinstance(img, str):
#         s = img.strip()
#         return s if s.startswith(("http://", "https://")) else None

#     if isinstance(img, dict):
#         for k in ("contentURL", "url", "src", "thumbnail", "image"):
#             v = img.get(k)
#             if isinstance(v, str):
#                 v = v.strip()
#                 if v.startswith(("http://", "https://")):
#                     return v
#     return None


# def normalize_image_list(items):
#     """
#     Normalize a list of mixed image representations into URL strings.
#     """
#     out = []
#     for it in (items or []):
#         u = normalize_image_url(it)
#         if u:
#             out.append(u)
#     return out


# # Initialize SynthID detector
# try:
#     synthid = SynthIDDetector()
#     logger.info("✅ SynthID detector initialized successfully")
# except Exception as e:
#     logger.error(f"❌ Failed to initialize SynthID detector: {e}")
#     synthid = None

# # Initialize sentiment analyzer
# try:
#     sentiment_analyzer = ReviewSentimentAnalyzer()
#     logger.info("✅ Sentiment analyzer initialized successfully")
# except Exception as e:
#     logger.error(f"❌ Failed to initialize sentiment analyzer: {e}")
#     sentiment_analyzer = None

# # Initialize risk calculator
# try:
#     risk_calculator = ListingRiskCalculator()
#     logger.info("✅ Risk calculator initialized successfully")
# except Exception as e:
#     logger.error(f"❌ Failed to initialize risk calculator: {e}")
#     risk_calculator = None

# # Initialize image similarity analyzer
# try:
#     image_similarity = ImageSimilarityAnalyzer()
#     logger.info("✅ Image similarity analyzer initialized successfully")
# except Exception as e:
#     logger.error(f"❌ Failed to initialize image similarity analyzer: {e}")
#     image_similarity = None


# @app.route('/analyze', methods=['POST', 'OPTIONS'])
# def analyze():
#     # Handle CORS preflight requests
#     if request.method == 'OPTIONS':
#         return '', 200

#     try:
#         data = request.json
#         if not data:
#             logger.error("❌ No JSON data received")
#             return jsonify({'success': False, 'error': 'No data received'}), 400

#         logger.info(f"📥 Analyzing: {data.get('url', 'unknown')}")

#         # Show what arrived (keys + samples)
#         logger.info("🧾 Top-level keys: %s", sorted(list(data.keys())))
#         if isinstance(data.get("data"), dict):
#             logger.info("🧾 data keys: %s", sorted(list(data["data"].keys())))

#         # Get images from scraper - handle different possible structures
#         images_raw = []
#         if isinstance(data.get("data"), dict):
#             images_raw = data["data"].get("images", []) or []
#         elif "images" in data:
#             images_raw = data.get("images", []) or []

#         logger.info(f"🖼️ Raw images received: {len(images_raw)}")
#         logger.info("🖼️ Image sample: %s", json.dumps(images_raw[:3], ensure_ascii=False)[:800])

#         # Reviews
#         reviews = []
#         if isinstance(data.get("data"), dict):
#             reviews = data["data"].get("reviews", []) or []
#         elif "reviews" in data:
#             reviews = data.get("reviews", []) or []

#         logger.info(f"📝 Reviews received: {len(reviews)}")
#         logger.info("📝 Review sample: %s", json.dumps(reviews[:1], ensure_ascii=False)[:800])

#         # Extract review images (raw)
#         review_images_raw = []
#         reviews_with_photos = 0
#         for review in reviews:
#             review_imgs = review.get('images', []) or []
#             if review_imgs:
#                 reviews_with_photos += 1
#                 review_images_raw.extend(review_imgs)

#         logger.info(f"📸 Review images (raw): {len(review_images_raw)} total from {reviews_with_photos} reviews")
#         if review_images_raw:
#             logger.info(f"📸 First review image raw: {str(review_images_raw[0])[:120]}...")

#         # =====================================================================
#         # Normalize all image URLs EARLY (IMPORTANT)
#         # =====================================================================
#         listing_image_urls = normalize_image_list(images_raw)
#         review_image_urls = normalize_image_list(review_images_raw)

#         logger.info(f"📊 Listing valid image URLs: {len(listing_image_urls)} / {len(images_raw)}")
#         logger.info(f"📊 Review valid image URLs: {len(review_image_urls)} / {len(review_images_raw)}")

#         # =====================================================================
#         # RUN SENTIMENT ANALYSIS ON REVIEWS
#         # =====================================================================
#         sentiment_results = None
#         if reviews and sentiment_analyzer:
#             logger.info(f"🔍 Running sentiment analysis on {len(reviews)} reviews...")
#             try:
#                 sentiment_results = sentiment_analyzer.analyze_reviews(reviews)
#                 logger.info(f"✅ Sentiment analysis complete:")
#                 logger.info(
#                     f"   Positive: {sentiment_results['sentiment_counts']['positive']} "
#                     f"({sentiment_results['sentiment_percentages']['positive']}%)"
#                 )
#                 logger.info(
#                     f"   Negative: {sentiment_results['sentiment_counts']['negative']} "
#                     f"({sentiment_results['sentiment_percentages']['negative']}%)"
#                 )
#                 logger.info(
#                     f"   Neutral: {sentiment_results['sentiment_counts']['neutral']} "
#                     f"({sentiment_results['sentiment_percentages']['neutral']}%)"
#                 )
#                 logger.info(f"   Average sentiment: {sentiment_results['average_sentiment']}")
#                 logger.info(f"   Suspicious reviews: {sentiment_results['sentiment_rating_mismatch_count']}")
#             except Exception as e:
#                 logger.error(f"❌ Error during sentiment analysis: {e}")
#                 logger.error(traceback.format_exc())
#         elif not reviews:
#             logger.info("ℹ️ No reviews to analyze")
#         elif not sentiment_analyzer:
#             logger.warning("⚠️ Sentiment analyzer not initialized")

#         # =====================================================================
#         # IMAGE SIMILARITY ANALYSIS (Review photos vs Listing images)
#         #   - Uses normalized URLs
#         #   - Compares each review photo against up to 3 listing images
#         # =====================================================================
#         similarity_results = None
#         if image_similarity and listing_image_urls and review_image_urls:
#             logger.info(
#                 f"🔍 Comparing {min(len(review_image_urls), 6)} review photos "
#                 f"with {min(len(listing_image_urls), 3)} listing images..."
#             )
#             try:
#                 similarity_results = image_similarity.analyze_review_photos(
#                     listing_images=listing_image_urls[:3],     # up to 3 listing images
#                     review_images=review_image_urls[:6],       # up to 6 review images
#                     max_comparisons=6
#                 )

#                 logger.info(f"✅ Image similarity analysis complete:")
#                 logger.info(f"   Average match: {similarity_results.get('average_match_score', 0)}/100")
#                 logger.info(f"   High matches: {similarity_results.get('high_confidence_matches', 0)}")
#                 logger.info(f"   Verified authentic: {similarity_results.get('verified_authentic', False)}")
#                 logger.info(f"   Message: {similarity_results.get('message', 'N/A')}")
#             except Exception as e:
#                 logger.error(f"❌ Error during image similarity analysis: {e}")
#                 logger.error(traceback.format_exc())
#         else:
#             if not image_similarity:
#                 logger.warning("⚠️ Image similarity analyzer not initialized")
#             elif not listing_image_urls:
#                 logger.info("ℹ️ No valid listing images for similarity")
#             elif not review_image_urls:
#                 logger.info("ℹ️ No valid review images for similarity")

#         # Extra blocks your extension sends
#         logger.info("📦 reviewFetch: %s", json.dumps(data.get("reviewFetch"), ensure_ascii=False)[:800])
#         logger.info("📦 report: %s", json.dumps(data.get("report"), ensure_ascii=False)[:800])

#         # =====================================================================
#         # Run SynthID detection (use listing_image_urls)
#         # =====================================================================
#         synthid_results = {
#             'status': 'working',
#             'results': [],
#             'any_ai': False,
#             'message': 'No valid images to analyze',
#             'images_analyzed': 0,
#             'total_images': len(images_raw),
#             'valid_images': len(listing_image_urls)
#         }

#         if listing_image_urls and synthid:
#             first_image = listing_image_urls[0]
#             img_preview = first_image[:50] if len(first_image) > 50 else first_image
#             logger.info(f"🔍 SynthID analyzing image: {img_preview}...")

#             try:
#                 result = synthid.analyze_image(first_image)

#                 if result:
#                     ai_detected = result.get('is_ai_generated', False)
#                     confidence = result.get('confidence', 0)

#                     logger.info(f"  ✅ Analysis complete - AI detected: {ai_detected}")
#                     logger.info(f"  📊 Confidence: {confidence}%")
#                     logger.info(f"  📝 Explanation: {result.get('explanation', 'No explanation')[:100]}...")

#                     if result.get('indicators'):
#                         logger.info(f"  🚩 Indicators: {result.get('indicators')}")

#                     synthid_results['results'] = [result]
#                     synthid_results['any_ai'] = ai_detected
#                     synthid_results['message'] = 'Analysis complete'
#                     synthid_results['images_analyzed'] = 1
#                 else:
#                     logger.error("  ❌ No result returned from SynthID analyzer")
#                     synthid_results['message'] = 'Analyzer returned no result'

#             except Exception as e:
#                 logger.error(f"  ❌ Error during SynthID analysis: {e}")
#                 logger.error(traceback.format_exc())
#                 synthid_results['message'] = f'Error during analysis: {str(e)}'
#         else:
#             if not listing_image_urls:
#                 logger.warning("⚠️ No valid images to analyze for SynthID")
#             if not synthid:
#                 logger.warning("⚠️ SynthID detector not initialized")

#         # =====================================================================
#         # CALCULATE COMPREHENSIVE RISK SCORE
#         # =====================================================================
#         risk = {'score': 0, 'level': 'UNKNOWN', 'message': 'Unable to calculate risk'}

#         if risk_calculator:
#             logger.info("🎯 Calculating comprehensive risk score...")
#             try:
#                 risk_data = {
#                     'data': data.get('data', {}),
#                     'results': {
#                         'sentiment': sentiment_results,
#                         'synthid': synthid_results,
#                         'image_similarity': similarity_results
#                     }
#                 }

#                 risk_assessment = risk_calculator.calculate_risk(risk_data)

#                 risk = {
#                     'score': risk_assessment['score'],
#                     'level': risk_assessment['level'],
#                     'color': risk_assessment.get('color'),
#                     'message': risk_assessment['recommendation'],
#                     'warnings': risk_assessment['warnings'],
#                     'breakdown': risk_assessment['breakdown']
#                 }

#                 logger.info(f"📊 RISK ASSESSMENT:")
#                 logger.info(f"   Score: {risk['score']}/100")
#                 logger.info(f"   Level: {risk['level']}")
#                 logger.info(f"   Recommendation: {risk['message']}")
#                 if risk['warnings']:
#                     logger.info(f"   Warnings: {len(risk['warnings'])}")
#                     for w in risk['warnings'][:5]:
#                         logger.info(f"      {w}")

#             except Exception as e:
#                 logger.error(f"❌ Error calculating risk: {e}")
#                 logger.error(traceback.format_exc())
#         else:
#             logger.warning("⚠️ Risk calculator not initialized")

#         logger.info(f"📊 Final Risk level: {risk['level']} - {risk['message']}")

#         receipt = {
#             "top_level_keys": sorted(list(data.keys())),
#             "data_keys": sorted(list(data.get("data", {}).keys())) if isinstance(data.get("data"), dict) else None,
#             "url": data.get("url"),
#             "images_received": len(images_raw),
#             "valid_images": len(listing_image_urls),
#             "reviews_received": len((data.get("data") or {}).get("reviews", []) or []),
#             "review_fetch": data.get("reviewFetch"),
#             "report_received": data.get("report"),
#         }

#         response = {
#             'success': True,
#             'receipt': receipt,
#             'url': data.get('url', 'unknown'),
#             'timestamp': datetime.now().isoformat(),
#             'analyzers_status': {
#                 'synthid': '✅ READY' if synthid else '❌ ERROR',
#                 'sentiment': '✅ READY' if sentiment_analyzer else '❌ ERROR',
#                 'image_similarity': '✅ READY' if image_similarity else '❌ ERROR',
#                 'duplicate_detector': '⏳ IN PROGRESS',
#                 'shop_analyzer': '⏳ IN PROGRESS'
#             },
#             'results': {
#                 'synthid': synthid_results,
#                 'sentiment': sentiment_results if sentiment_results else {'message': 'No sentiment analysis performed'},
#                 'image_similarity': similarity_results if similarity_results else {
#                     'analyzed': False,
#                     'message': 'No review photos to compare'
#                 }
#             },
#             'risk': risk
#         }

#         logger.info("✅ Response sent successfully")
#         return jsonify(response)

#     except Exception as e:
#         logger.error(f"❌ Error in analyze endpoint: {e}")
#         logger.error(traceback.format_exc())
#         return jsonify({
#             'success': False,
#             'error': str(e),
#             'error_type': str(type(e))
#         }), 500


# @app.route('/status', methods=['GET', 'OPTIONS'])
# def status():
#     if request.method == 'OPTIONS':
#         return '', 200

#     return jsonify({
#         'synthid': synthid is not None,
#         'sentiment': sentiment_analyzer is not None,
#         'image_similarity': image_similarity is not None,
#         'message': 'Status OK'
#     })


# @app.route('/health', methods=['GET', 'OPTIONS'])
# def health():
#     if request.method == 'OPTIONS':
#         return '', 200

#     return jsonify({
#         'status': 'healthy',
#         'timestamp': datetime.now().isoformat(),
#         'synthid_ready': synthid is not None
#     })


# if __name__ == '__main__':
#     port = int(os.getenv('PORT', 5000))

#     print("\n" + "=" * 70)
#     print("🚀 API RUNNING")
#     print("=" * 70)
#     print(f"📡 Port: {port}")
#     print(f"🤖 SynthID: {'✅ Ready' if synthid else '❌ Not loaded'}")
#     print(f"💬 Sentiment: {'✅ Ready' if sentiment_analyzer else '❌ Not loaded'}")
#     print(f"🖼️ Image Similarity: {'✅ Ready' if image_similarity else '❌ Not loaded'}")
#     print("\n📬 Endpoints:")
#     print(f"   POST http://localhost:{port}/analyze")
#     print(f"   GET  http://localhost:{port}/status")
#     print(f"   GET  http://localhost:{port}/health")
#     print("=" * 70 + "\n")

#     app.run(host="0.0.0.0", port=port, debug=True, use_reloader=False)

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

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Allow extension to call you

# Initialize ONLY the detectors that are ready
try:
    synthid = SynthIDDetector()
    logger.info("✅ SynthID detector initialized successfully")
except Exception as e:
    logger.error(f"❌ Failed to initialize SynthID detector: {e}")
    synthid = None

# Initialize sentiment analyzer
try:
    sentiment_analyzer = ReviewSentimentAnalyzer()
    logger.info("✅ Sentiment analyzer initialized successfully")
except Exception as e:
    logger.error(f"❌ Failed to initialize sentiment analyzer: {e}")
    sentiment_analyzer = None

# Initialize risk calculator
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
    Main endpoint - currently only SynthID works
    Others will be added when teammates finish
    """
    # Handle CORS preflight requests
    if request.method == 'OPTIONS':
        return '', 200
        
    try:
        data = request.json
        if not data:
            logger.error("❌ No JSON data received")
            return jsonify({'success': False, 'error': 'No data received'}), 400
        
        logger.info(f"📥 Analyzing: {data.get('url', 'unknown')}")

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
                url = None
                
                # Try different possible field names where URL might be stored
                if 'contentURL' in img and img['contentURL']:
                    url = img['contentURL']
                elif 'url' in img and img['url']:
                    url = img['url']
                elif 'src' in img and img['src']:
                    url = img['src']
                elif 'thumbnail' in img and img['thumbnail']:
                    url = img['thumbnail']
                elif 'image' in img and isinstance(img['image'], str):
                    url = img['image']
                
                if url and isinstance(url, str):
                    # Clean up the URL if needed
                    url = url.strip()
                    if url.startswith(('http://', 'https://')):
                        valid_images.append(url)
                        logger.info(f"  ✅ Extracted URL from image object {i+1}: {url[:100]}...")
                    else:
                        logger.warning(f"  ❌ Extracted URL missing protocol from object {i+1}: {url[:100]}")
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
                        'synthid': synthid_results
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
            'receipt': receipt,
            'url': data.get('url', 'unknown'),
            'timestamp': datetime.now().isoformat(),
            'analyzers_status': {
                'synthid': '✅ READY' if synthid else '❌ ERROR',
                'sentiment': '✅ READY' if sentiment_analyzer else '❌ ERROR',
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

@app.route('/status', methods=['GET', 'OPTIONS'])
def status():
    """Show which analyzers are ready"""
    if request.method == 'OPTIONS':
        return '', 200
        
    return jsonify({
        'synthid': synthid is not None,
        'image_comparator': False,
        'duplicate_detector': False,
        'shop_analyzer': False,
        'api_key_loaded': synthid is not None and hasattr(synthid, 'api_key') and bool(synthid.api_key),
        'message': 'SynthID is ready! Others coming soon.'
    })

@app.route('/health', methods=['GET', 'OPTIONS'])
def health():
    """Simple health check endpoint"""
    if request.method == 'OPTIONS':
        return '', 200
        
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'synthid_ready': synthid is not None
    })

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    
    print("\n" + "="*70)
    print("🚀 SYNTHID DETECTOR API RUNNING")
    print("="*70)
    print(f"📡 Port: {port}")
    print(f"🔑 API Key: {'✅ Loaded' if synthid and hasattr(synthid, 'api_key') and synthid.api_key else '❌ Missing'}")
    print(f"🤖 SynthID: {'✅ Ready' if synthid else '❌ Not loaded'}")
    print(f"💬 Sentiment: {'✅ Ready' if sentiment_analyzer else '❌ Not loaded'}")
    print("\n📊 ANALYZER STATUS:")
    print(f"   SynthID:        {'✅ READY' if synthid else '❌ ERROR'}")
    print(f"   Sentiment:      {'✅ READY' if sentiment_analyzer else '❌ ERROR'}")
    print(f"   Image Compare:  ⏳ Waiting for teammate")
    print(f"   Duplicate:      ⏳ Waiting for teammate")
    print(f"   Shop:           ⏳ Waiting for teammate")
    print("\n📬 Endpoints:")
    print(f"   POST http://localhost:{port}/analyze")
    print(f"   GET  http://localhost:{port}/status")
    print(f"   GET  http://localhost:{port}/health")
    print("\n🎯 Test with curl:")
    print(f'   curl -X POST http://localhost:{port}/analyze -H "Content-Type: application/json" -d "{{\\"url\\":\\"test\\",\\"data\\":{{\\"images\\":[\\"https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400\\"]}}}}"')
    print("="*70 + "\n")
    
    # app.run(host='0.0.0.0', port=port, debug=True)
    app.run(host="0.0.0.0", port=port, debug=True, use_reloader=False)
