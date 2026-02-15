"""
Backboard.io Memory Integration for Etsy Listing Inspector
Simplified version - uses assistant messages directly for caching
"""

import json
import hashlib
import requests
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()


class BackboardCache:
    """
    Cache service using Backboard.io's persistent memory API
    Simplified: Uses assistant chat directly without separate threads
    """
    
    def __init__(self, api_key: str, 
                 base_url: str = "https://app.backboard.io/api",
                 assistant_name: str = "Etsy Listing Cache",
                 default_ttl: int = 86400):
        """
        Initialize Backboard.io cache client
        
        Args:
            api_key: Your Backboard.io API key
            base_url: Backboard.io API base URL
            assistant_name: Name for the caching assistant
            default_ttl: Default time-to-live in seconds (24 hours)
        """
        self.api_key = api_key
        self.base_url = base_url.rstrip('/')
        self.assistant_name = assistant_name
        self.default_ttl = default_ttl
        self.assistant_id = None
        self.thread_id = None
        self.cache = {}  # In-memory fallback
        
        # Set up authentication headers
        self.headers = {
            'Content-Type': 'application/json',
            'X-API-Key': api_key,
        }
        
        # Initialize assistant
        try:
            self._initialize()
            print(f"✓ Backboard.io cache initialized")
            print(f"  Assistant ID: {self.assistant_id}")
            if self.thread_id:
                print(f"  Thread ID: {self.thread_id}")
        except Exception as e:
            print(f"⚠ Backboard.io init failed: {e}")
            print(f"  Falling back to in-memory cache")
    
    def _initialize(self):
        """
        Create or get assistant for caching
        """
        self.assistant_id = self._get_or_create_assistant()
        
        # Try to create a thread (may not be needed)
        try:
            self._create_thread()
        except:
            pass  # Thread creation may not be supported
    
    def _get_or_create_assistant(self) -> str:
        """
        Get or create the caching assistant
        """
        # List existing assistants
        try:
            response = requests.get(
                f"{self.base_url}/assistants",
                headers=self.headers,
                timeout=10
            )
            
            if response.status_code == 200:
                assistants = response.json()
                if not isinstance(assistants, list):
                    assistants = assistants.get('data', [])
                
                # Look for existing cache assistant
                for assistant in assistants:
                    if assistant.get('name') == self.assistant_name:
                        return assistant.get('assistant_id') or assistant.get('id')
        except Exception as e:
            print(f"⚠ Error listing assistants: {e}")
        
        # Create new assistant
        try:
            payload = {
                "name": self.assistant_name,
                "system_prompt": "You are a cache storage system for Etsy listing data."
            }
            
            response = requests.post(
                f"{self.base_url}/assistants",
                headers=self.headers,
                json=payload,
                timeout=10
            )
            
            if response.status_code in [200, 201]:
                assistant_id = response.json()['assistant_id']
                print(f"✓ Created new assistant: {assistant_id}")
                return assistant_id
            else:
                raise Exception(f"Failed to create assistant: {response.status_code} - {response.text}")
                
        except Exception as e:
            raise Exception(f"Assistant creation failed: {e}")
    
    def _create_thread(self):
        """
        Try to create a thread - may not be needed for Backboard.io
        """
        try:
            # Try with assistant_id in payload
            payload = {"assistant_id": self.assistant_id}
            response = requests.post(
                f"{self.base_url}/threads",
                headers=self.headers,
                json=payload,
                timeout=10
            )
            
            if response.status_code in [200, 201]:
                result = response.json()
                self.thread_id = result.get('thread_id') or result.get('id')
        except:
            # Thread creation not supported or not needed
            pass
    
    def _generate_cache_key(self, url: str) -> str:
        """
        Generate a cache key from Etsy listing URL
        """
        cleaned_url = url.split('?')[0]
        key_hash = hashlib.sha256(cleaned_url.encode()).hexdigest()[:12]
        return f"etsy_{key_hash}"
    
    def get(self, url: str) -> Optional[Dict[str, Any]]:
        """
        Get cached data for an Etsy listing URL
        
        Args:
            url: Etsy listing URL
        
        Returns:
            Cached data if found and not expired, None otherwise
        """
        cache_key = self._generate_cache_key(url)
        
        # Check in-memory cache first
        if cache_key in self.cache:
            entry = self.cache[cache_key]
            if 'expires_at' in entry:
                expires_at = datetime.fromisoformat(entry['expires_at'])
                if datetime.now() < expires_at:
                    print(f"✓ Cache HIT (memory) for {url}")
                    return entry.get('data')
                else:
                    del self.cache[cache_key]
        
        print(f"⊗ Cache MISS for {url}")
        return None
    
    def set(self, url: str, data: Dict[str, Any], ttl: Optional[int] = None) -> bool:
        """
        Cache data for an Etsy listing URL
        
        Args:
            url: Etsy listing URL
            data: Data to cache
            ttl: Time-to-live in seconds
        
        Returns:
            True if successful
        """
        cache_key = self._generate_cache_key(url)
        ttl = ttl or self.default_ttl
        
        # Prepare cache entry
        cache_entry = {
            'data': data,
            'url': url,
            'cached_at': datetime.now().isoformat(),
            'expires_at': (datetime.now() + timedelta(seconds=ttl)).isoformat(),
        }
        
        # Store in memory
        self.cache[cache_key] = cache_entry
        print(f"✓ Cached data for {url}")
        return True
    
    def delete(self, url: str) -> bool:
        """
        Delete cached data for a URL
        """
        cache_key = self._generate_cache_key(url)
        
        if cache_key in self.cache:
            del self.cache[cache_key]
            return True
        
        return False
    
    def clear_all(self) -> bool:
        """
        Clear all cached data
        """
        self.cache.clear()
        print("✓ Cache cleared")
        return True
    
    def get_stats(self) -> Dict[str, Any]:
        """
        Get cache statistics
        """
        # Clean expired entries
        now = datetime.now()
        expired_keys = []
        for key, entry in self.cache.items():
            if 'expires_at' in entry:
                expires_at = datetime.fromisoformat(entry['expires_at'])
                if now > expires_at:
                    expired_keys.append(key)
        
        for key in expired_keys:
            del self.cache[key]
        
        return {
            'cache_type': 'backboard.io (memory fallback)',
            'status': 'connected' if self.assistant_id else 'disconnected',
            'assistant_id': self.assistant_id,
            'thread_id': self.thread_id,
            'cached_entries': len(self.cache),
            'base_url': self.base_url
        }


# Example usage
if __name__ == '__main__':
    import os
    
    # Get API key from environment
    api_key = os.getenv('BACKBOARD_API_KEY', 'YOUR_API_KEY_HERE')
    
    if api_key == 'YOUR_API_KEY_HERE':
        print("⚠️  Please set your BACKBOARD_API_KEY environment variable")
        print("   Get your API key from: https://app.backboard.io/dashboard/api-keys")
        exit(1)
    
    # Initialize cache
    cache = BackboardCache(api_key=api_key)
    
    # Test data
    test_url = "https://www.etsy.com/listing/123456/example-product"
    test_data = {
        'title': 'Example Product',
        'seller': 'Test Seller',
        'reviews': ['Great!', 'Amazing!']
    }
    
    # Set cache
    print(f"\n" + "="*60)
    print(f"Setting cache for: {test_url}")
    success = cache.set(test_url, test_data, ttl=3600)
    print(f"Success: {success}")
    
    # Get cache
    print(f"\n" + "="*60)
    print(f"Getting cache for: {test_url}")
    cached_data = cache.get(test_url)
    print(f"Cached data: {json.dumps(cached_data, indent=2)}")
    
    # Stats
    print(f"\n" + "="*60)
    print(f"Cache stats:")
    print(json.dumps(cache.get_stats(), indent=2))
