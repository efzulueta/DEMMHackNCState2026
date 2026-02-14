# backend/models.py
from typing import List, Optional, Dict, Any

class ProductData:
    """Matches the data structure from content.js scraper"""
    
    def __init__(self, data: Dict[str, Any]):
        # Core data from scraper
        self.url = data.get('url', '')
        self.title = data.get('title', '')
        self.images = data.get('images', [])
        self.seller_name = data.get('sellerName', '')
        self.sales_count = data.get('salesCount')
        self.since_year = data.get('sinceYear')
        self.review_texts = data.get('reviewTexts', [])
        
        # Risk report (already computed)
        self.risk_report = data.get('report', {})
        self.signals = data.get('signals', [])
    
    @property
    def main_image(self) -> Optional[str]:
        """Get the first/main product image"""
        return self.images[0] if self.images else None
    
    def to_dict(self) -> Dict:
        return {
            'url': self.url,
            'title': self.title,
            'images': self.images,
            'seller_name': self.seller_name,
            'sales_count': self.sales_count,
            'since_year': self.since_year,
            'review_texts': self.review_texts[:5]  # Limit to 5
        }