"""
synthid_detector.py - Pure SynthID Watermark Detector
Only checks if images contain Google's SynthID watermark
No general AI detection, just SynthID!
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
    ONLY detects SynthID watermarks in images using Gemini
    Does NOT do general AI detection - just looks for SynthID!
    """
    
    def __init__(self, api_key: str = None):
        """Initialize with Gemini API key"""
        self.api_key = api_key or os.getenv('GEMINI_API_KEY')
        
        if not self.api_key:
            raise ValueError("❌ GEMINI_API_KEY not found in .env file!")
        
        # Configure Gemini
        genai.configure(api_key=self.api_key)
        
        # Try different model names
        model_names = [
            'gemini-1.5-flash',
            'gemini-1.5-pro',
            'gemini-pro-vision',
            'gemini-1.0-pro-vision',
        ]
        
        self.model = None
        for model_name in model_names:
            try:
                logger.info(f"Attempting to load model: {model_name}")
                self.model = genai.GenerativeModel(model_name)
                logger.info(f"✅ Successfully loaded model: {model_name}")
                break
            except Exception as e:
                logger.warning(f"❌ Failed to load {model_name}: {e}")
        
        if not self.model:
            logger.error("❌ Could not load any vision model")
            raise ValueError("No compatible Gemini vision model found")
    
    def analyze_image(self, image_url: str) -> Dict:
        """
        ONLY check for SynthID watermark - nothing else!
        
        Args:
            image_url: URL of the image to analyze
            
        Returns:
            dict: {
                'has_synthid': bool,        # True if SynthID watermark found
                'confidence': int,           # 0-100 confidence score
                'explanation': str,          # What Gemini found
                'watermark_location': str,   # Where in image (if found)
                'method': str                 # Always 'synthid_only'
            }
        """
        logger.info(f"🔍 Checking for SynthID watermark: {image_url[:50]}...")
        
        try:
            # Download the image with proper headers
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            response = requests.get(image_url, timeout=10, headers=headers)
            
            if response.status_code != 200:
                return self._error_result(f"HTTP {response.status_code}")
            
            # Check content type
            content_type = response.headers.get('content-type', '')
            if 'image' not in content_type:
                return self._error_result(f"Not an image: {content_type}")
            
            # Open image
            try:
                img = Image.open(BytesIO(response.content))
                logger.info(f"Image loaded: {img.size} {img.format}")
            except Exception as e:
                return self._error_result(f"Cannot open image: {str(e)}")
            
            # Create SynthID-only prompt
            prompt = self._create_synthid_prompt()
            
            # Send to Gemini
            response = self.model.generate_content([prompt, img])
            
            # Parse the response
            result = self._parse_response(response.text)
            
            if result['has_synthid']:
                logger.info(f"✅ SynthID watermark DETECTED! Confidence: {result['confidence']}%")
            else:
                logger.info(f"❌ No SynthID watermark found")
            
            return result
            
        except Exception as e:
            logger.error(f"Error in analyze_image: {e}")
            return self._error_result(str(e))
    
    def _create_synthid_prompt(self) -> str:
        """
        Pure SynthID prompt - ONLY asks about SynthID watermark
        """
        return """You are an expert in Google DeepMind's SynthID technology.

SynthID is Google's invisible watermarking system that embeds imperceptible watermarks into AI-generated images.

Look at this image and answer ONLY these questions:

1. Does this image contain a SynthID watermark? (Google's invisible AI watermark)
2. If yes, where in the image is it located?
3. How confident are you?

Do NOT analyze if the image is AI-generated or not.
Do NOT look for other AI artifacts.
Do NOT comment on image quality or content.
ONLY check for SynthID watermarks.

Return your analysis in this EXACT JSON format:
{
    "has_synthid": true or false,
    "confidence": 0-100,
    "watermark_location": "corners" or "distributed" or "none detected" or "unknown",
    "explanation": "brief explanation of what you found"
}

Be conservative - only say true if you're reasonably sure you detect a SynthID watermark."""
    
    def _parse_response(self, response_text: str) -> Dict:
        """Parse Gemini's response into a clean dictionary"""
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
                # If no JSON found, create basic response from text
                has_synthid = 'synthid' in response_text.lower() and 'detected' in response_text.lower()
                return {
                    'has_synthid': has_synthid,
                    'confidence': 50 if has_synthid else 0,
                    'watermark_location': 'unknown',
                    'explanation': response_text[:200],
                    'method': 'synthid_only_fallback'
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
    print("🔍 SYNTHID WATERMARK DETECTOR")
    print("="*60)
    print("Only checks for Google's SynthID watermark")
    print("No general AI detection\n")
    
    try:
        detector = SynthIDDetector()
        print("✅ Detector initialized\n")
        
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
            print("-" * 40)
            
    except Exception as e:
        print(f"\n❌ Error: {e}")


if __name__ == "__main__":
    main()