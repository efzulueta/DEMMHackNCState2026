"""
synthid_detector.py - Pure SynthID Watermark Detector
Using Gemini 3 API
"""

import os
import google.generativeai as genai
from PIL import Image
import requests
from io import BytesIO
import logging
import json
import re
from typing import Dict

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class SynthIDDetector:
    """
    ONLY detects SynthID watermarks in images using Gemini 3
    """
    
    def __init__(self, api_key: str = None):
        """Initialize with Gemini API key"""
        self.api_key = api_key or os.getenv('GEMINI_API_KEY')
        
        if not self.api_key:
            raise ValueError("❌ GEMINI_API_KEY not found in .env file!")
        
        # Configure Gemini
        genai.configure(api_key=self.api_key)
        
        # Gemini 3 model names [citation:4][citation:8]
        model_names = [
            'gemini-3-flash-preview',      # Fast version - RECOMMENDED for images
            'gemini-3-pro-preview',         # Powerful version - fallback
            'gemini-1.5-flash',              # Legacy fallback
            'gemini-1.5-pro',                 # Legacy fallback
            'gemini-pro-vision',               # Older fallback
        ]
        
        self.model = None
        self.model_name = None
        
        for model_name in model_names:
            try:
                logger.info(f"Attempting to load model: {model_name}")
                self.model = genai.GenerativeModel(model_name)
                # Test the model with a simple prompt
                test = self.model.generate_content("test")
                logger.info(f"✅ SUCCESS! Using model: {model_name}")
                self.model_name = model_name
                break
            except Exception as e:
                logger.warning(f"❌ Failed to load {model_name}: {e}")
        
        if not self.model:
            # List available models for debugging
            logger.error("❌ Could not load any vision model. Available models:")
            try:
                for m in genai.list_models():
                    logger.info(f"  - {m.name}")
            except:
                pass
            raise ValueError("No compatible Gemini vision model found")
    
    def analyze_image(self, image_url: str) -> Dict:
        """
        ONLY check for SynthID watermark using Gemini 3
        """
        logger.info(f"🔍 Checking for SynthID watermark: {image_url[:50]}...")
        
        try:
            # Download the image
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            response = requests.get(image_url, timeout=10, headers=headers)
            
            if response.status_code != 200:
                return self._error_result(f"HTTP {response.status_code}")
            
            # Open image
            try:
                img = Image.open(BytesIO(response.content))
                logger.info(f"Image loaded: {img.size} {img.format}")
            except Exception as e:
                return self._error_result(f"Cannot open image: {str(e)}")
            
            # Create SynthID-only prompt
            prompt = self._create_synthid_prompt()
            
            # Send to Gemini 3
            response = self.model.generate_content([prompt, img])
            
            # Parse the response
            result = self._parse_response(response.text)
            
            # Add model info
            result['model_used'] = self.model_name
            
            if result['has_synthid']:
                logger.info(f"✅ SynthID DETECTED! Confidence: {result['confidence']}%")
            else:
                logger.info(f"❌ No SynthID found")
            
            return result
            
        except Exception as e:
            logger.error(f"Error in analyze_image: {e}")
            return self._error_result(str(e))
    
    def _create_synthid_prompt(self) -> str:
        """
        Pure SynthID prompt for Gemini 3
        """
        return """You are an expert in Google DeepMind's SynthID technology.

SynthID is Google's invisible watermarking system that embeds imperceptible watermarks into AI-generated images. It was developed by Google DeepMind.

Look at this image and answer ONLY these questions:

1. Does this image contain a SynthID watermark? (Google's invisible AI watermark)
2. If yes, where in the image is it located?
3. How confident are you on a scale of 0-100?

Return your analysis in this EXACT JSON format:
{
    "has_synthid": true or false,
    "confidence": 0-100,
    "watermark_location": "corners" or "distributed" or "none detected" or "unknown",
    "explanation": "brief explanation of what you found"
}

Be very conservative. Only say true if you're absolutely certain you detect a SynthID watermark. If you're not sure, return false."""
    
    def _parse_response(self, response_text: str) -> Dict:
        """Parse Gemini's response"""
        try:
            # Try to find JSON in the response
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            
            if json_match:
                result = json.loads(json_match.group())
                return {
                    'has_synthid': result.get('has_synthid', False),
                    'confidence': result.get('confidence', 0),
                    'watermark_location': result.get('watermark_location', 'unknown'),
                    'explanation': result.get('explanation', 'No explanation provided'),
                    'method': 'synthid_only'
                }
            else:
                return {
                    'has_synthid': False,
                    'confidence': 0,
                    'watermark_location': 'unknown',
                    'explanation': f"Could not parse response: {response_text[:100]}",
                    'method': 'parse_error'
                }
                
        except Exception as e:
            logger.error(f"Parse error: {e}")
            return self._error_result(f"Failed to parse response")
    
    def _error_result(self, error_msg: str) -> Dict:
        """Return a clean error result"""
        return {
            'has_synthid': False,
            'confidence': 0,
            'watermark_location': 'unknown',
            'explanation': f"Error: {error_msg}",
            'method': 'error',
            'error': True
        }


# Simple function for command-line testing
def main():
    """Test the detector from command line"""
    print("\n" + "="*60)
    print("🔍 SYNTHID WATERMARK DETECTOR - GEMINI 3")
    print("="*60)
    print("Only checks for Google's SynthID watermark\n")
    
    try:
        detector = SynthIDDetector()
        print(f"✅ Detector initialized with model: {detector.model_name}\n")
        
        while True:
            print("\n📸 Enter image URL (or 'quit' to exit):")
            url = input("> ").strip()
            
            if url.lower() in ['quit', 'exit', 'q']:
                break
            
            if not url:
                continue
            
            print("\n🔍 Checking for SynthID watermark...")
            result = detector.analyze_image(url)
            
            print("\n" + "📊 RESULTS")
            print("-" * 40)
            print(f"🔖 SynthID Watermark: {'✅ DETECTED' if result['has_synthid'] else '❌ NOT DETECTED'}")
            print(f"📊 Confidence: {result['confidence']}%")
            print(f"📍 Location: {result['watermark_location']}")
            print(f"\n📝 Explanation: {result['explanation']}")
            print(f"\n⚙️ Method: {result['method']}")
            print(f"🤖 Model: {result.get('model_used', 'unknown')}")
            print("-" * 40)
            
    except Exception as e:
        print(f"\n❌ Error: {e}")


if __name__ == "__main__":
    main()