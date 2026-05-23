import json
import os
from supabase import create_client
import uuid

def test():
    # Load config
    config_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'config.json')
    with open(config_path, 'r') as f:
        config = json.load(f)
        
    url = config.get('supabase_url')
    key = config.get('supabase_key')
    
    supabase = create_client(url, key)
    
    email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    password = "password12345"
    name = "Test User RLS"
    
    print(f"Signing up new user with email: {email}")
    try:
        res = supabase.auth.sign_up({"email": email, "password": password})
        print(f"Auth Signup success. User ID: {res.user.id}")
        
        print("Now trying to insert/upsert profile...")
        try:
            profile_res = supabase.table("profiles").upsert({
                "id": res.user.id,
                "full_name": name,
                "email": email
            }).execute()
            print(f"Profile upsert success: {profile_res.data}")
        except Exception as profile_err:
            print(f"Profile upsert failed: {profile_err}")
            
    except Exception as e:
        print(f"Auth Signup failed: {e}")

if __name__ == '__main__':
    test()
