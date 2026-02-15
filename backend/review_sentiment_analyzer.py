"""
review_sentiment_analyzer.py
Analyzes sentiment of Etsy reviews and compares with star ratings
"""

import logging
from typing import Dict, List
from textblob import TextBlob

logger = logging.getLogger(__name__)


class ReviewSentimentAnalyzer:
    """
    Analyzes review sentiment and detects suspicious patterns
    """
    
    def __init__(self):
        """Initialize the sentiment analyzer"""
        logger.info("✅ ReviewSentimentAnalyzer initialized")
    
    def analyze_reviews(self, reviews: List[Dict]) -> Dict:
        """
        Analyze sentiment of all reviews
        
        Args:
            reviews: List of review dicts with 'text' and 'rating' fields
            
        Returns:
            Dict with sentiment analysis results
        """
        if not reviews:
            return {
                'total_reviews': 0,
                'sentiment_counts': {'positive': 0, 'negative': 0, 'neutral': 0},
                'suspicious_reviews': [],
                'sentiment_rating_mismatch': 0,
                'average_sentiment': 0,
                'message': 'No reviews to analyze'
            }
        
        logger.info(f"🔍 Analyzing {len(reviews)} reviews...")
        
        positive_count = 0
        negative_count = 0
        neutral_count = 0
        
        suspicious_reviews = []
        total_sentiment = 0
        analyzed_count = 0
        
        for i, review in enumerate(reviews):
            text = review.get('text', '')
            rating = review.get('rating')
            
            if not text:
                continue
            
            # Analyze sentiment using TextBlob
            sentiment_score = self._analyze_sentiment(text)
            total_sentiment += sentiment_score
            analyzed_count += 1
            
            # Categorize sentiment
            if sentiment_score > 0.1:
                sentiment_category = 'positive'
                positive_count += 1
            elif sentiment_score < -0.1:
                sentiment_category = 'negative'
                negative_count += 1
            else:
                sentiment_category = 'neutral'
                neutral_count += 1
            
            # Check for mismatch between sentiment and rating
            is_suspicious = self._is_suspicious_mismatch(sentiment_score, rating)
            
            if is_suspicious:
                suspicious_reviews.append({
                    'index': i,
                    'text': text[:100] + ('...' if len(text) > 100 else ''),
                    'rating': rating,
                    'sentiment_score': round(sentiment_score, 3),
                    'sentiment_category': sentiment_category,
                    'reason': self._get_mismatch_reason(sentiment_score, rating)
                })
        
        avg_sentiment = total_sentiment / analyzed_count if analyzed_count > 0 else 0
        
        result = {
            'total_reviews': len(reviews),
            'analyzed_reviews': analyzed_count,
            'sentiment_counts': {
                'positive': positive_count,
                'negative': negative_count,
                'neutral': neutral_count
            },
            'sentiment_percentages': {
                'positive': round(positive_count / analyzed_count * 100, 1) if analyzed_count > 0 else 0,
                'negative': round(negative_count / analyzed_count * 100, 1) if analyzed_count > 0 else 0,
                'neutral': round(neutral_count / analyzed_count * 100, 1) if analyzed_count > 0 else 0
            },
            'average_sentiment': round(avg_sentiment, 3),
            'suspicious_reviews': suspicious_reviews,
            'sentiment_rating_mismatch_count': len(suspicious_reviews),
            'message': f'Analyzed {analyzed_count} reviews'
        }
        
        logger.info(f"✅ Analysis complete:")
        logger.info(f"   Positive: {positive_count} ({result['sentiment_percentages']['positive']}%)")
        logger.info(f"   Negative: {negative_count} ({result['sentiment_percentages']['negative']}%)")
        logger.info(f"   Neutral: {neutral_count} ({result['sentiment_percentages']['neutral']}%)")
        logger.info(f"   Suspicious: {len(suspicious_reviews)}")
        
        return result
    
    def _analyze_sentiment(self, text: str) -> float:
        """
        Analyze sentiment of text using TextBlob
        
        Returns:
            Float between -1 (very negative) and 1 (very positive)
        """
        try:
            blob = TextBlob(text)
            # TextBlob returns polarity between -1 and 1
            return blob.sentiment.polarity
        except Exception as e:
            logger.warning(f"Error analyzing sentiment: {e}")
            return 0.0
    
    def _is_suspicious_mismatch(self, sentiment_score: float, rating) -> bool:
        """
        Check if sentiment and rating don't match (potential fake review)
        
        Args:
            sentiment_score: -1 to 1 (negative to positive)
            rating: 1-5 stars (can be int or string)
            
        Returns:
            True if suspicious mismatch detected
        """
        if rating is None or rating == '':
            return False
        
        # Convert rating to int if it's a string
        try:
            rating = int(rating)
        except (ValueError, TypeError):
            return False
        
        # Map rating to expected sentiment range
        # 5 stars = very positive (0.3 to 1.0)
        # 4 stars = positive (0.1 to 0.5)
        # 3 stars = neutral (-0.2 to 0.2)
        # 2 stars = negative (-0.5 to -0.1)
        # 1 star = very negative (-1.0 to -0.3)
        
        if rating == 5 and sentiment_score < 0:
            return True  # 5 stars but negative text
        elif rating == 4 and sentiment_score < -0.2:
            return True  # 4 stars but very negative text
        elif rating == 1 and sentiment_score > 0.2:
            return True  # 1 star but positive text
        elif rating == 2 and sentiment_score > 0.3:
            return True  # 2 stars but very positive text
        
        return False
    
    def _get_mismatch_reason(self, sentiment_score: float, rating) -> str:
        """Get human-readable reason for mismatch"""
        # Convert rating to int if it's a string
        try:
            rating = int(rating)
        except (ValueError, TypeError):
            return f"Invalid rating: {rating}"
            
        if rating >= 4 and sentiment_score < 0:
            return f"{rating}-star rating but negative sentiment ({sentiment_score:.2f})"
        elif rating <= 2 and sentiment_score > 0.2:
            return f"{rating}-star rating but positive sentiment ({sentiment_score:.2f})"
        else:
            return f"Rating-sentiment mismatch: {rating} stars, {sentiment_score:.2f} sentiment"


# Test function
def main():
    """Test the sentiment analyzer"""
    print("\n" + "="*70)
    print("🔍 REVIEW SENTIMENT ANALYZER TEST")
    print("="*70)
    
    # Sample reviews
    test_reviews = [
        {"text": "Absolutely love this! Amazing quality and fast shipping.", "rating": 5},
        {"text": "Pretty good, came as expected. Would buy again.", "rating": 4},
        {"text": "It's okay, nothing special.", "rating": 3},
        {"text": "Not what I expected. Quality is poor.", "rating": 2},
        {"text": "Terrible! Complete waste of money. Do not buy!", "rating": 1},
        # Suspicious examples
        {"text": "Great product, love it so much!", "rating": 1},  # Suspicious: positive text, 1 star
        {"text": "Awful quality, broke immediately.", "rating": 5},  # Suspicious: negative text, 5 stars
    ]
    
    analyzer = ReviewSentimentAnalyzer()
    results = analyzer.analyze_reviews(test_reviews)
    
    print(f"\n📊 RESULTS:")
    print(f"Total reviews: {results['total_reviews']}")
    print(f"Analyzed: {results['analyzed_reviews']}")
    print(f"\n📈 Sentiment Breakdown:")
    print(f"   Positive: {results['sentiment_counts']['positive']} ({results['sentiment_percentages']['positive']}%)")
    print(f"   Negative: {results['sentiment_counts']['negative']} ({results['sentiment_percentages']['negative']}%)")
    print(f"   Neutral: {results['sentiment_counts']['neutral']} ({results['sentiment_percentages']['neutral']}%)")
    print(f"\n⚠️  Suspicious reviews: {results['sentiment_rating_mismatch_count']}")
    
    if results['suspicious_reviews']:
        print(f"\n🚩 SUSPICIOUS REVIEWS:")
        for sr in results['suspicious_reviews']:
            print(f"\n   Review #{sr['index'] + 1}:")
            print(f"   Rating: {sr['rating']} stars")
            print(f"   Sentiment: {sr['sentiment_category']} ({sr['sentiment_score']})")
            print(f"   Text: {sr['text']}")
            print(f"   Reason: {sr['reason']}")
    
    print("\n" + "="*70)


if __name__ == "__main__":
    main()
