import json
import os
from supabase import create_client

def test():
    # Load config
    config_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'config.json')
    with open(config_path, 'r') as f:
        config = json.load(f)
        
    url = config.get('supabase_url')
    key = config.get('supabase_key')
    
    print(f"Supabase URL: {url}")
    print(f"Supabase Key: {key[:20]}...")
    
    try:
        supabase = create_client(url, key)
        print("Client created successfully!")
        
        # Test connecting/querying some public table or trying an invalid sign-in
        print("Testing invalid sign-in to see auth response...")
        try:
            res = supabase.auth.sign_in_with_password({"email": "nonexistent_clove_user@example.com", "password": "password123"})
            print(f"Sign-in response: {res}")
        except Exception as e:
            print(f"Sign-in error: {e}")
            
    except Exception as e:
        print(f"Failed to create client or run test: {e}")

if __name__ == '__main__':
    test()
