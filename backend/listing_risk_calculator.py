"""
listing_risk_calculator.py
Comprehensive risk scoring system for Etsy listings
Considers: reviews, images, seller stats, sentiment, AI detection
"""

import logging
from typing import Dict, List
from datetime import datetime
from collections import Counter

logger = logging.getLogger(__name__)


class ListingRiskCalculator:
    """
    Calculate overall risk score for Etsy listing authenticity
    Score: 0-100 (0 = trustworthy, 100 = likely fake)
    """
    
    def __init__(self):
        logger.info("✅ ListingRiskCalculator initialized")
    
    def calculate_risk(self, data: Dict) -> Dict:
        """
        Calculate comprehensive risk score
        
        Args:
            data: Full listing data including reviews, seller info, images, sentiment, AI analysis
            
        Returns:
            Dict with risk score, level, breakdown, and warnings
        """
        score = 0
        warnings = []
        breakdown = {}
        
        # Extract data
        listing_data = data.get('data', {})
        reviews = listing_data.get('reviews', [])
        sentiment = data.get('results', {}).get('sentiment', {})
        synthid = data.get('results', {}).get('synthid', {})
        
        # 1. REVIEW ANALYSIS (0-30 points)
        review_risk, review_warnings = self._analyze_reviews(reviews)
        score += review_risk
        warnings.extend(review_warnings)
        breakdown['reviews'] = review_risk
        
        # 2. SELLER CREDIBILITY (0-25 points)
        seller_risk, seller_warnings = self._analyze_seller(listing_data)
        score += seller_risk
        warnings.extend(seller_warnings)
        breakdown['seller'] = seller_risk
        
        # 3. REVIEW PHOTOS (0-20 points - PROTECTIVE FACTOR)
        photo_risk, photo_warnings = self._analyze_review_photos(reviews)
        score += photo_risk
        warnings.extend(photo_warnings)
        breakdown['review_photos'] = photo_risk
        
        # 4. SENTIMENT ANALYSIS (0-15 points)
        sentiment_risk, sentiment_warnings = self._analyze_sentiment(sentiment, reviews)
        score += sentiment_risk
        warnings.extend(sentiment_warnings)
        breakdown['sentiment'] = sentiment_risk
        
        # 5. AI DETECTION (0-10 points with context)
        ai_risk, ai_warnings = self._analyze_ai_images(synthid, reviews, listing_data)
        score += ai_risk
        warnings.extend(ai_warnings)
        breakdown['ai_images'] = ai_risk
        
        # Calculate raw score
        raw_score = score
        
        # Cap at 0-100 for display
        display_score = min(100, max(0, score))
        
        # Determine risk level based on display score
        if display_score < 20:
            level = "VERY LOW"
            color = "#22c55e"
        elif display_score < 40:
            level = "LOW"
            color = "#84cc16"
        elif display_score < 60:
            level = "MEDIUM"
            color = "#f59e0b"
        elif display_score < 80:
            level = "HIGH"
            color = "#ef4444"
        else:
            level = "VERY HIGH"
            color = "#dc2626"
        
        return {
            'score': round(display_score, 1),
            'raw_score': round(raw_score, 1),  # Include raw score for debugging
            'level': level,
            'color': color,
            'warnings': warnings,
            'breakdown': breakdown,
            'recommendation': self._get_recommendation(display_score, warnings)
        }
    
    def _analyze_reviews(self, reviews: List[Dict]) -> tuple:
        """Analyze review patterns (0-30 points)"""
        risk = 0
        warnings = []
        
        if not reviews:
            risk += 15
            warnings.append("⚠️ No reviews found - cannot verify product quality")
            return risk, warnings
        
        review_count = len(reviews)
        
        # Very few reviews
        if review_count < 5:
            risk += 10
            warnings.append(f"⚠️ Only {review_count} reviews - limited feedback")
        elif review_count < 10:
            risk += 5
            warnings.append(f"⚠️ Only {review_count} reviews - consider more established listings")
        
        # Check review dates clustering
        dates = [r.get('date') for r in reviews if r.get('date')]
        if dates:
            date_risk, date_warning = self._check_date_clustering(dates)
            risk += date_risk
            if date_warning:
                warnings.append(date_warning)
        
        return risk, warnings
    
    def _check_date_clustering(self, dates: List[str]) -> tuple:
        """Check if reviews are suspiciously clustered in time"""
        # TODO: Parse dates and check if they're all within a short time period
        # For now, return 0
        return 0, None
    
    def _analyze_seller(self, listing_data: Dict) -> tuple:
        """Analyze seller credibility (0-25 points)"""
        risk = 0
        warnings = []
        
        seller_age_months = listing_data.get('sellerAgeMonths')
        sales_count = listing_data.get('salesCount')
        listing_age_days = listing_data.get('listingAgeDays')
        
        # Seller age
        if seller_age_months is not None:
            if seller_age_months < 6:
                risk += 12
                warnings.append(f"🚩 Very new seller (< 6 months old)")
            elif seller_age_months < 12:
                risk += 8
                warnings.append(f"⚠️ New seller ({seller_age_months} months old)")
            elif seller_age_months < 24:
                risk += 4
                warnings.append(f"ℹ️ Relatively new seller ({seller_age_months} months)")
        
        # Sales count
        if sales_count is not None:
            if sales_count < 10:
                risk += 10
                warnings.append(f"🚩 Very few sales ({sales_count})")
            elif sales_count < 50:
                risk += 5
                warnings.append(f"⚠️ Limited sales history ({sales_count})")
        
        # Listing age (very new listings can be suspicious)
        if listing_age_days is not None:
            if listing_age_days < 3:
                risk += 3
                warnings.append(f"ℹ️ Very new listing ({listing_age_days} days old)")
        
        return risk, warnings
    
    def _analyze_review_photos(self, reviews: List[Dict]) -> tuple:
        """
        Analyze review photos - PROTECTIVE FACTOR
        Photos REDUCE risk (negative points)
        """
        risk = 0
        warnings = []
        
        if not reviews:
            return 0, []
        
        reviews_with_photos = sum(1 for r in reviews if r.get('images') and len(r.get('images', [])) > 0)
        total_reviews = len(reviews)
        photo_percentage = (reviews_with_photos / total_reviews * 100) if total_reviews > 0 else 0
        
        # Photos are PROTECTIVE - they reduce risk
        if reviews_with_photos >= 5:
            risk -= 15  # Strong protection
            warnings.append(f"✅ {reviews_with_photos} reviews have photos - strong authenticity indicator")
        elif reviews_with_photos >= 3:
            risk -= 10  # Good protection
            warnings.append(f"✅ {reviews_with_photos} reviews have photos - good verification")
        elif reviews_with_photos >= 1:
            risk -= 5  # Some protection
            warnings.append(f"ℹ️ {reviews_with_photos} review(s) have photos")
        else:
            risk += 15  # No photos = increased risk
            warnings.append(f"⚠️ No review photos - cannot verify actual product appearance")
        
        return risk, warnings
    
    def _analyze_sentiment(self, sentiment: Dict, reviews: List[Dict]) -> tuple:
        """Analyze sentiment patterns (0-15 points)"""
        risk = 0
        warnings = []
        
        if not sentiment or not reviews:
            return 0, []
        
        suspicious_count = sentiment.get('sentiment_rating_mismatch_count', 0)
        avg_sentiment = sentiment.get('average_sentiment', 0)
        positive_pct = sentiment.get('sentiment_percentages', {}).get('positive', 0)
        
        # Suspicious reviews (rating doesn't match sentiment)
        if suspicious_count > 0:
            risk += min(suspicious_count * 5, 15)  # Up to 15 points
            warnings.append(f"🚩 {suspicious_count} suspicious review(s) - rating doesn't match text sentiment")
        
        # Unnaturally high positivity (possible fake reviews)
        if positive_pct > 95 and len(reviews) > 10:
            risk += 5
            warnings.append(f"⚠️ Unusually high positive sentiment ({positive_pct}%) - may indicate fake reviews")
        
        # Very high average sentiment can be suspicious
        if avg_sentiment > 0.7 and len(reviews) > 15:
            risk += 3
            warnings.append(f"ℹ️ Very enthusiastic reviews (avg sentiment: {avg_sentiment}) - verify authenticity")
        
        return risk, warnings
    
    def _analyze_ai_images(self, synthid: Dict, reviews: List[Dict], listing_data: Dict) -> tuple:
        """
        Analyze AI-generated images with context (0-10 points)
        Context matters: AI images are MORE suspicious with fewer reviews
        """
        risk = 0
        warnings = []
        
        if not synthid:
            return 0, []
        
        ai_detected = synthid.get('any_ai', False)
        
        # Safely get confidence from results
        results = synthid.get('results', [])
        confidence = results[0].get('confidence', 0) if results and len(results) > 0 else 0
        
        if not ai_detected:
            return 0, []
        
        # AI detected - check context
        reviews_with_photos = sum(1 for r in reviews if r.get('images') and len(r.get('images', [])) > 0)
        seller_age_months = listing_data.get('sellerAgeMonths', 0)
        sales_count = listing_data.get('salesCount', 0)
        
        # Established seller with review photos - likely just edited product photo
        if reviews_with_photos >= 3 and seller_age_months >= 12 and sales_count >= 100:
            risk += 2
            warnings.append(f"ℹ️ AI-detected in listing image ({confidence}% confidence) - likely edited product photo given established seller")
        
        # New seller with no review photos - VERY suspicious
        elif reviews_with_photos == 0 and seller_age_months < 6:
            risk += 10
            warnings.append(f"🚩 AI-generated listing image ({confidence}% confidence) + no review photos + new seller - HIGH RISK")
        
        # Middle ground
        else:
            risk += 5
            warnings.append(f"⚠️ AI-detected in listing image ({confidence}% confidence) - verify with review photos")
        
        return risk, warnings
    
    def _get_recommendation(self, score: float, warnings: List[str]) -> str:
        """Get purchase recommendation based on score"""
        if score < 20:
            return "✅ Appears trustworthy - safe to purchase"
        elif score < 40:
            return "✅ Likely legitimate - proceed with normal caution"
        elif score < 60:
            return "⚠️ Exercise caution - verify seller credibility and reviews carefully"
        elif score < 80:
            return "⚠️ High risk - look for review photos and established seller history before purchasing"
        else:
            return "🚫 Very high risk - consider alternative listings with more reviews and established sellers"


# Test
def main():
    """Test the risk calculator"""
    print("\n" + "="*70)
    print("🎯 LISTING RISK CALCULATOR TEST")
    print("="*70)
    
    # Test case 1: Trustworthy listing
    trustworthy_listing = {
        'data': {
            'sellerAgeMonths': 48,
            'salesCount': 5000,
            'listingAgeDays': 90,
            'reviews': [
                {'text': 'Great!', 'rating': '5', 'images': ['img1.jpg']},
                {'text': 'Love it!', 'rating': '5', 'images': ['img2.jpg']},
                {'text': 'Perfect', 'rating': '5', 'images': []},
                {'text': 'Good quality', 'rating': '4', 'images': ['img3.jpg']},
                {'text': 'Nice', 'rating': '5', 'images': []},
            ]
        },
        'results': {
            'sentiment': {
                'sentiment_rating_mismatch_count': 0,
                'average_sentiment': 0.45,
                'sentiment_percentages': {'positive': 80}
            },
            'synthid': {'any_ai': False}
        }
    }
    
    calculator = ListingRiskCalculator()
    result = calculator.calculate_risk(trustworthy_listing)
    
    print(f"\n📊 RISK SCORE: {result['score']}/100")
    print(f"🎯 RISK LEVEL: {result['level']}")
    print(f"💡 RECOMMENDATION: {result['recommendation']}")
    print(f"\n⚠️  WARNINGS:")
    for warning in result['warnings']:
        print(f"   {warning}")
    print(f"\n📈 BREAKDOWN:")
    for category, score in result['breakdown'].items():
        print(f"   {category}: {score} points")
    
    print("\n" + "="*70)


if __name__ == "__main__":
    main()
