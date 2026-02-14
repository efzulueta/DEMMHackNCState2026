# backend/analyzers/synthid_detector.py
"""
SynthID Detector - Works with images from scraper
"""

import os
import google.generativeai as genai
from PIL import Image
import requests
from io import BytesIO
import logging
import json
import re
from typing import Dict, List, Optional

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SynthIDDetector:
    """Detects AI-generated images using Gemini"""
    
    def __init__(self):
        self.api_key = os.getenv('GEMINI_API_KEY')
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY not found in .env")
        
        genai.configure(api_key=self.api_key)
        self.model = genai.GenerativeModel('gemini-1.5-flash')
        logger.info("SynthID Detector ready")
    
    def analyze_image(self, image_url: str) -> Dict:
        """Analyze a single image from their scraper"""
        logger.info(f"Analyzing: {image_url[:50]}...")
        
        try:
            # Download image
            response = requests.get(image_url, timeout=10)
            img = Image.open(BytesIO(response.content))
            
            # Create prompt
            prompt = self._create_prompt()
            
            # Get Gemini's analysis
            response = self.model.generate_content([prompt, img])
            result = self._parse_response(response.text)
            
            return result
            
        except Exception as e:
            logger.error(f"Error: {e}")
            return {
                'has_synthid': False,
                'confidence': 0,
                'is_ai_generated': False,
                'explanation': f"Error: {str(e)}",
                'indicators': []
            }
    
    def analyze_product_images(self, images: List[str]) -> Dict:
        """
        Analyze all product images from their scraper
        Returns combined results
        """
        if not images:
            return {
                'any_ai_generated': False,
                'image_count': 0,
                'results': []
            }
        
        results = []
        ai_count = 0
        
        for i, img_url in enumerate(images[:5]):  # Limit to first 5
            logger.info(f"Image {i+1}/{min(len(images),5)}")
            result = self.analyze_image(img_url)
            result['image_url'] = img_url
            results.append(result)
            
            if result['is_ai_generated']:
                ai_count += 1
        
        return {
            'any_ai_generated': ai_count > 0,
            'ai_image_count': ai_count,
            'total_analyzed': len(results),
            'results': results,
            'summary': self._generate_summary(ai_count, len(results))
        }
    
    def _create_prompt(self) -> str:
        return """Analyze this image for signs of AI generation and SynthID watermarks.

Check for:
1. SynthID watermarks (Google's invisible AI watermark)
2. AI artifacts (weird hands, unnatural textures)
3. Signs of AI generation

Return JSON:
{
    "has_synthid": true/false,
    "confidence": 0-100,
    "is_ai_generated": true/false,
    "indicators": ["list", "of", "signs"],
    "explanation": "brief summary"
}"""
    
    def _parse_response(self, text: str) -> Dict:
        try:
            json_match = re.search(r'\{.*\}', text, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
                return {
                    'has_synthid': result.get('has_synthid', False),
                    'confidence': result.get('confidence', 50),
                    'is_ai_generated': result.get('is_ai_generated', False),
                    'indicators': result.get('indicators', []),
                    'explanation': result.get('explanation', 'No explanation'),
                    'method': 'gemini_synthid'
                }
        except:
            pass
        
        return {
            'has_synthid': False,
            'confidence': 0,
            'is_ai_generated': 'ai' in text.lower(),
            'indicators': [],
            'explanation': text[:200],
            'method': 'fallback'
        }
    
    def _generate_summary(self, ai_count: int, total: int) -> str:
        if ai_count == 0:
            return "No AI-generated images detected"
        elif ai_count == total:
            return "ALL images appear AI-generated!"
        else:
            return f"{ai_count}/{total} images appear AI-generated"