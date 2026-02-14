"""
app.py - Simple API with just SynthID detector
Other analyzers can be added later when ready
"""

import os
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# Load SynthID detector
from analyzers.synthid_detector import SynthIDDetector

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Allow extension to call you

# Initialize ONLY the detectors that are ready
synthid = SynthIDDetector()

# Placeholders for future analyzers
image_comparator = None
duplicate_detector = None
shop_analyzer = None

@app.route('/analyze', methods=['POST'])
def analyze():
    """
    Main endpoint - currently only SynthID works
    Others will be added when teammates finish
    """
    try:
        data = request.json
        logger.info(f" Analyzing: {data.get('url', 'unknown')}")
        
        # Get images from scraper
        images = data.get('data', {}).get('images', [])
        
        # Run SynthID detection
        synthid_results = {
            'status': 'working',
            'results': []
        }
        
        if images and synthid:
            # Analyze first image (or all if you want)
            result = synthid.analyze_image(images[0])
            synthid_results['results'] = [result]
            synthid_results['any_ai'] = result.get('is_ai_generated', False)
        
        # Placeholder results for other analyzers
        response = {
            'success': True,
            'url': data.get('url'),
            'timestamp': datetime.now().isoformat(),
            'analyzers_status': {
                'synthid': 'READY',
                'image_comparator': 'IN PROGRESS',
                'duplicate_detector': 'IN PROGRESS',
                'shop_analyzer': 'IN PROGRESS'
            },
            'results': {
                'synthid': synthid_results,
                'image_comparator': {'status': 'coming_soon'},
                'duplicate_detector': {'status': 'coming_soon'},
                'shop_analyzer': {'status': 'coming_soon'}
            },
            'risk_assessment': calculate_risk(synthid_results)
        }
        
        return jsonify(response)
        
    except Exception as e:
        logger.error(f"Error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

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

@app.route('/status', methods=['GET'])
def status():
    """Show which analyzers are ready"""
    return jsonify({
        'synthid': synthid is not None,
        'image_comparator': False,
        'duplicate_detector': False,
        'shop_analyzer': False,
        'message': 'SynthID is ready! Others coming soon.'
    })

if __name__ == '__main__':
    from datetime import datetime
    port = int(os.getenv('PORT', 5000))
    
    print("\n" + "="*50)
    print("SynthID DETECTOR API RUNNING")
    print("="*50)
    print(f"Port: {port}")
    print(f"API Key: {'' if synthid.api_key else '❌'}")
    print("\nANALYZER STATUS:")
    print(f"   SynthID:         READY")
    print(f"   Image Compare:   Waiting for teammate")
    print(f"   Duplicate:       Waiting for teammate")
    print(f"   Shop:            Waiting for teammate")
    print("\n Endpoints:")
    print(f"   POST /analyze")
    print(f"   GET  /status")
    print("="*50 + "\n")
    
    app.run(host='0.0.0.0', port=port, debug=True)