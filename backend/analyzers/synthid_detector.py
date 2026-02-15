"""
synthid_detector.py - Complete AI Image Detector
Detects both:
1. SynthID watermarks (Google's invisible watermark)
2. General AI generation signs (weird hands, artifacts, etc.)
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
    Complete AI Image Detector - checks for both SynthID and general AI signs
    """
    
    def __init__(self, api_key: str = None):
        """Initialize with Gemini API key"""
        self.api_key = api_key or os.getenv('GEMINI_API_KEY')
        
        if not self.api_key:
            raise ValueError("❌ GEMINI_API_KEY not found in .env file!")
        
        # Configure Gemini
        genai.configure(api_key=self.api_key)
        
        # Try different model names (Gemini 3 first)
        model_names = [
            'gemini-3-flash-preview',      # Gemini 3 fast
            'gemini-3-pro-preview',         # Gemini 3 powerful
            'gemini-1.5-flash',              # Fallback
            'gemini-1.5-pro',                 # Fallback
            'gemini-pro-vision',               # Older fallback
        ]
        
        self.model = None
        self.model_name = None
        
        for model_name in model_names:
            try:
                logger.info(f"Attempting to load model: {model_name}")
                self.model = genai.GenerativeModel(model_name)
                # Test the model
                test = self.model.generate_content("test")
                logger.info(f"✅ SUCCESS! Using model: {model_name}")
                self.model_name = model_name
                break
            except Exception as e:
                logger.warning(f"❌ Failed to load {model_name}: {e}")
        
        if not self.model:
            raise ValueError("No compatible Gemini vision model found")
    
    def analyze_image(self, image_url: str) -> Dict:
        """
        Complete image analysis - SynthID + General AI detection
        """
        logger.info(f"🔍 Analyzing image: {image_url[:50]}...")
        
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
            
            # Create comprehensive prompt
            prompt = self._create_full_prompt()
            
            # Send to Gemini
            response = self.model.generate_content([prompt, img])
            
            # Parse the response
            result = self._parse_response(response.text)
            
            # Add model info
            result['model_used'] = self.model_name
            
            if result['is_ai_generated']:
                logger.info(f"✅ AI DETECTED! Confidence: {result['confidence']}%")
                if result['has_synthid']:
                    logger.info(f"   🔖 SynthID watermark present")
            else:
                logger.info(f"❌ No AI detected")
            
            return result
            
        except Exception as e:
            logger.error(f"Error in analyze_image: {e}")
            return self._error_result(str(e))
    
    def _create_full_prompt(self) -> str:
        """
        Complete prompt that checks for both SynthID and general AI signs
        """
        return """You are an AI image forensic expert. Analyze this image and provide a complete assessment.

PART 1: SYNTHID WATERMARK DETECTION
SynthID is Google's invisible watermarking system for AI-generated images.
- Does this image contain a SynthID watermark?
- If yes, where is it located?

PART 2: GENERAL AI GENERATION SIGNS
Check for these common AI artifacts:
1. HANDS AND FINGERS:
   - Extra or missing fingers
   - Hands that look twisted or unnatural
   - Fingers merging together

2. FACES AND EYES:
   - Eyes that look glassy or dead
   - Asymmetrical facial features
   - Teeth that look weird
   - Skin that looks too smooth/waxy

3. TEXT AND DETAILS:
   - Text that looks garbled or makes no sense
   - Logos or writing that's almost readable but not
   - Repeated patterns that shouldn't repeat
   - Objects that blend into each other

4. LIGHTING AND SHADOWS:
   - Shadows that don't match the light source
   - Lighting that looks unnatural
   - Reflections that don't make sense

5. OVERALL LOOK:
   - Too smooth/perfect (uncanny valley)
   - Dream-like quality
   - Oversaturated or weird colors

Return your analysis in this EXACT JSON format:
{
    "has_synthid": true or false,
    "synthid_confidence": 0-100,
    "synthid_location": "corners/distributed/none",
    "is_ai_generated": true or false,
    "confidence": 0-100,
    "indicators": ["list", "of", "specific", "issues", "found"],
    "explanation": "detailed explanation of your findings"
}

Be thorough but honest. Only mark as AI if you see clear indicators."""
    
    def _parse_response(self, response_text: str) -> Dict:
        """Parse Gemini's response into a clean dictionary"""
        try:
            # Try to find JSON in the response
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            
            if json_match:
                result = json.loads(json_match.group())
                
                return {
                    'has_synthid': result.get('has_synthid', False),
                    'synthid_confidence': result.get('synthid_confidence', 0),
                    'synthid_location': result.get('synthid_location', 'unknown'),
                    'is_ai_generated': result.get('is_ai_generated', False),
                    'confidence': result.get('confidence', 0),
                    'indicators': result.get('indicators', []),
                    'explanation': result.get('explanation', 'No explanation provided'),
                    'method': 'full_analysis'
                }
            else:
                return {
                    'has_synthid': False,
                    'synthid_confidence': 0,
                    'synthid_location': 'unknown',
                    'is_ai_generated': 'ai' in response_text.lower(),
                    'confidence': 50,
                    'indicators': [],
                    'explanation': response_text[:200],
                    'method': 'fallback'
                }
                
        except Exception as e:
            logger.error(f"Parse error: {e}")
            return self._error_result(f"Failed to parse response")
    
    def _error_result(self, error_msg: str) -> Dict:
        """Return a clean error result"""
        return {
            'has_synthid': False,
            'synthid_confidence': 0,
            'synthid_location': 'unknown',
            'is_ai_generated': False,
            'confidence': 0,
            'indicators': [],
            'explanation': f"Error: {error_msg}",
            'method': 'error',
            'error': True
        }


# Simple function for command-line testing
def main():
    """Test the detector from command line"""
    print("\n" + "="*60)
    print("🔍 COMPLETE AI IMAGE DETECTOR")
    print("="*60)
    print("Checks for: SynthID watermarks + General AI signs\n")
    
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
            
            print("\n🔍 Analyzing image...")
            result = detector.analyze_image(url)
            
            print("\n" + "📊 RESULTS")
            print("="*60)
            
            # SynthID results
            print("🔖 SYNTHID WATERMARK:")
            print(f"   Present: {'✅ YES' if result['has_synthid'] else '❌ NO'}")
            if result['has_synthid']:
                print(f"   Confidence: {result['synthid_confidence']}%")
                print(f"   Location: {result['synthid_location']}")
            
            print()
            
            # General AI results
            print("🤖 AI GENERATION:")
            print(f"   AI Generated: {'✅ YES' if result['is_ai_generated'] else '❌ NO'}")
            print(f"   Confidence: {result['confidence']}%")
            
            if result.get('indicators'):
                print(f"\n🚩 Indicators found:")
                for i, indicator in enumerate(result['indicators'], 1):
                    print(f"   {i}. {indicator}")
            
            print(f"\n📝 Explanation:")
            print(f"   {result['explanation']}")
            
            print(f"\n⚙️ Method: {result['method']}")
            print(f"🤖 Model: {result.get('model_used', 'unknown')}")
            print("="*60)
            
    except Exception as e:
        print(f"\n❌ Error: {e}")


if __name__ == "__main__":
    main()