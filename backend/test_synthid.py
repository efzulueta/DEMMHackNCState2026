"""
test_synthid.py - Quick test for SynthID detector
Run this in a NEW terminal while app.py is running
"""

import requests
import json

# Test with a real AI image
test_data = {
    "url": "https://www.etsy.com/listing/123/test",
    "data": {
        "images": [
            "https://www.hollywoodreporter.com/wp-content/uploads/2022/08/ai-art-fake-news-public-square-H-M-2022.jpg"
        ]
    }
}

# Send to your running backend
response = requests.post('http://localhost:5000/analyze', 
                        json=test_data,
                        headers={'Content-Type': 'application/json'})

# Print results
if response.status_code == 200:
    result = response.json()
    print("\n" + "="*50)
    print(" ANALYSIS RESULTS")
    print("="*50)
    print(json.dumps(result, indent=2))
else:
    print(f" Error: {response.status_code}")