"""
app.py - Simple API with just SynthID detector
Other analyzers can be added later when ready
"""

import os
import logging
import traceback
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from datetime import datetime

# Load SynthID detector
from analyzers.synthid_detector import SynthIDDetector

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Allow extension to call you

# Initialize ONLY the detectors that are ready
try:
    synthid = SynthIDDetector()
    logger.info("SynthID detector initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize SynthID detector: {e}")
    synthid = None

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
            logger.error("No JSON data received")
            return jsonify({'success': False, 'error': 'No data received'}), 400
            
        logger.info(f"Analyzing: {data.get('url', 'unknown')}")
        
        # Get images from scraper - handle different possible structures
        images = []
        if 'data' in data and isinstance(data['data'], dict):
            images = data['data'].get('images', [])
        elif 'images' in data:
            images = data.get('images', [])
            
        logger.info(f"Images received: {len(images)}")
        
        # Log the first few image URLs for debugging
        for i, img in enumerate(images[:3]):
            if img and isinstance(img, str):
                logger.info(f"Image {i+1}: {img[:100]}...")
        
        # Run SynthID detection
        synthid_results = {
            'status': 'working',
            'results': [],
            'any_ai': False,
            'message': 'No images analyzed'
        }
        
        if images and synthid and len(images) > 0:
            # Analyze first image (or all if you want)
            first_image = images[0]
            
            if first_image and isinstance(first_image, str):
                # Safely log the image URL
                img_preview = first_image[:50] if len(first_image) > 50 else first_image
                logger.info(f"Analyzing image: {img_preview}...")
                
                try:
                    result = synthid.analyze_image(first_image)
                    
                    if result:
                        logger.info(f"Analysis complete - AI detected: {result.get('is_ai_generated', False)}")
                        logger.info(f"Confidence: {result.get('confidence', 0)}%")
                        
                        synthid_results['results'] = [result]
                        synthid_results['any_ai'] = result.get('is_ai_generated', False)
                        synthid_results['message'] = 'Analysis complete'
                    else:
                        logger.error("No result returned from analyzer")
                        synthid_results['message'] = 'Analyzer returned no result'
                        
                except Exception as e:
                    logger.error(f"Error during image analysis: {e}")
                    logger.error(traceback.format_exc())
                    synthid_results['message'] = f'Error during analysis: {str(e)}'
            else:
                logger.warning("First image URL is invalid")
                synthid_results['message'] = 'Invalid image URL'
        else:
            if not images:
                logger.warning("No images to analyze")
                synthid_results['message'] = 'No images provided'
            elif not synthid:
                logger.warning("SynthID detector not initialized")
                synthid_results['message'] = 'Detector not ready'
        
        # Calculate risk based on SynthID results
        if synthid_results.get('any_ai'):
            risk = {
                'score': 75,
                'level': 'HIGH',
                'message': 'AI-generated images detected'
            }
        else:
            risk = {
                'score': 25,
                'level': 'LOW',
                'message': 'No AI images detected'
            }
        
        logger.info(f"Risk level: {risk['level']}")
        
        # Response for extension
        response = {
            'success': True,
            'url': data.get('url', 'unknown'),
            'timestamp': datetime.now().isoformat(),
            'analyzers_status': {
                'synthid': 'READY' if synthid else 'ERROR',
                'image_comparator': 'IN PROGRESS',
                'duplicate_detector': 'IN PROGRESS',
                'shop_analyzer': 'IN PROGRESS'
            },
            'results': {
                'synthid': synthid_results,
            },
            'risk': risk
        }
        
        logger.info(f"Response sent successfully")
        return jsonify(response)
        
    except Exception as e:
        logger.error(f"Error in analyze endpoint: {e}")
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

def calculate_risk(synthid_results):
    """Simple risk based only on SynthID for now"""
    if synthid_results.get('any_ai'):
        return {
            'score': 75,
            'level': 'HIGH',
            'message': 'AI-generated images detected'
        }
    else:
        return {
            'score': 25,
            'level': 'LOW',
            'message': 'No AI images detected'
        }

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    
    print("\n" + "="*60)
    print("🚀 SYnthID DETECTOR API RUNNING")
    print("="*60)
    print(f"📡 Port: {port}")
    print(f"🔑 API Key: {'✅ Loaded' if synthid and hasattr(synthid, 'api_key') and synthid.api_key else '❌ Missing'}")
    print(f"🤖 SynthID: {'✅ Ready' if synthid else '❌ Not loaded'}")
    print("\n📊 ANALYZER STATUS:")
    print(f"   SynthID:        {'✅ READY' if synthid else '❌ ERROR'}")
    print(f"   Image Compare:  ⏳ Waiting")
    print(f"   Duplicate:      ⏳ Waiting")
    print(f"   Shop:           ⏳ Waiting")
    print("\n📬 Endpoints:")
    print(f"   POST http://localhost:{port}/analyze")
    print(f"   GET  http://localhost:{port}/status")
    print(f"   GET  http://localhost:{port}/health")
    print("\n🎯 Test with curl:")
    print(f'   curl -X POST http://localhost:{port}/analyze -H "Content-Type: application/json" -d "{{\\"url\\":\\"test\\",\\"data\\":{{\\"images\\":[\\"https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400\\"]}}}}"')
    print("="*60 + "\n")
    
    app.run(host='0.0.0.0', port=port, debug=True)