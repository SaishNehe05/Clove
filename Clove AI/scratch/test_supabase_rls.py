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
    print("Testing inserting a profile without auth (just anon key)...")
    fake_id = str(uuid.uuid4())
    try:
        res = supabase.table("profiles").insert({
            "id": fake_id,
            "full_name": "Test Guest",
            "email": "guest@example.com"
        }).execute()
        print(f"Insert success: {res.data}")
        # Clean up
        supabase.table("profiles").delete().eq("id", fake_id).execute()
        print("Clean up success")
    except Exception as e:
        print(f"Insert failed: {e}")

if __name__ == '__main__':
    test()
