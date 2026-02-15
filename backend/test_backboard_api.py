#!/usr/bin/env python3
"""
Test script for Backboard.io cache integration
Run this to verify your setup before using the extension
"""

import json
import time
import os
from dotenv import load_dotenv
from backboard_cache import BackboardCache
from datetime import datetime

# Load environment variables
load_dotenv()

def print_header(text):
    print("\n" + "="*70)
    print(f"  {text}")
    print("="*70)

def print_success(text):
    print(f"✓ {text}")

def print_error(text):
    print(f"✗ {text}")

def print_info(text):
    print(f"ℹ {text}")

def test_backboard_cache():
    """
    Test the Backboard.io cache integration
    """
    
    print_header("BACKBOARD.IO CACHE TEST")
    
    # Get API key from environment
    api_key = os.getenv('BACKBOARD_API_KEY')
    
    if not api_key:
        print_error("BACKBOARD_API_KEY environment variable not set!")
        print_info("Please add it to your .env file:")
        print_info("  BACKBOARD_API_KEY=espr_your_key_here")
        print_info("\nGet your API key from: https://app.backboard.io/dashboard/api-keys")
        return False
    
    # Initialize cache
    print_info("Initializing Backboard.io cache...")
    try:
        cache = BackboardCache(
            api_key=api_key,
            base_url=os.getenv('BACKBOARD_BASE_URL', 'https://app.backboard.io/api')
        )
        print_success("Cache initialized")
    except Exception as e:
        print_error(f"Failed to initialize cache: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    # Test URL
    test_url = "https://www.etsy.com/listing/999999/test-product"
    
    # Test data
    test_data = {
        'listing_info': {
            'title': 'Test Product',
            'seller_name': 'Test Shop',
            'sales_count': 100
        },
        'reviews': {
            'total': 50,
            'sample': ['Great!', 'Amazing!', 'Love it!']
        },
        'processed_at': datetime.now().isoformat()
    }
    
    print_header("TEST 1: SET (Store Data)")
    print_info(f"Storing data for: {test_url}")
    try:
        success = cache.set(test_url, test_data, ttl=3600)
        if success:
            print_success("Data stored successfully in Blackboard.io")
        else:
            print_error("Failed to store data")
            return False
    except Exception as e:
        print_error(f"Error storing data: {e}")
        return False
    
    print_header("TEST 2: GET (Retrieve Data)")
    print_info(f"Retrieving data for: {test_url}")
    try:
        retrieved_data = cache.get(test_url)
        if retrieved_data:
            print_success("Data retrieved successfully!")
            print_info("Retrieved data:")
            print(json.dumps(retrieved_data, indent=2))
            
            # Verify data matches
            if retrieved_data == test_data:
                print_success("Data matches what was stored!")
            else:
                print_error("Retrieved data doesn't match stored data")
                print_info("Expected:")
                print(json.dumps(test_data, indent=2))
        else:
            print_error("No data retrieved (returned None)")
            return False
    except Exception as e:
        print_error(f"Error retrieving data: {e}")
        return False
    
    print_header("TEST 3: GET (Cache Hit)")
    print_info("Retrieving same data again (should be instant)...")
    start_time = time.time()
    try:
        retrieved_data = cache.get(test_url)
        elapsed = time.time() - start_time
        if retrieved_data:
            print_success(f"Cache hit! Retrieved in {elapsed:.3f} seconds")
        else:
            print_error("Cache miss (should have been a hit)")
            return False
    except Exception as e:
        print_error(f"Error on cache hit: {e}")
        return False
    
    print_header("TEST 4: STATS")
    print_info("Getting cache statistics...")
    try:
        stats = cache.get_stats()
        print_success("Stats retrieved:")
        print(json.dumps(stats, indent=2))
    except Exception as e:
        print_error(f"Error getting stats: {e}")
    
    print_header("TEST 5: DELETE")
    print_info(f"Deleting cached data for: {test_url}")
    try:
        success = cache.delete(test_url)
        if success:
            print_success("Data deleted successfully")
        else:
            print_error("Failed to delete data")
    except Exception as e:
        print_error(f"Error deleting data: {e}")
    
    print_header("TEST 6: GET After Delete")
    print_info("Trying to retrieve deleted data...")
    try:
        retrieved_data = cache.get(test_url)
        if retrieved_data is None:
            print_success("Correctly returns None (data was deleted)")
        else:
            print_error("Data still exists after deletion!")
            return False
    except Exception as e:
        print_error(f"Error: {e}")
        return False
    
    print_header("ALL TESTS PASSED! ✅")
    print_success("Backboard.io cache is working correctly!")
    print_info("\nNext steps:")
    print("1. Update your .env file with real credentials")
    print("2. Start the Flask backend: python app.py")
    print("3. Load the Chrome extension")
    print("4. Visit an Etsy listing and see caching in action!")
    print("5. Visit the same listing again to see cache HIT!")
    
    return True


if __name__ == '__main__':
    try:
        test_backboard_cache()
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
    except Exception as e:
        print_error(f"Unexpected error: {e}")
        import traceback
        traceback.print_exc()
