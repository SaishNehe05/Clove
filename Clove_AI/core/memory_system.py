import json
import os
import threading
from supabase import create_client, Client

class MemorySystem:
    def __init__(self, memory_file='memory.json', config_file='config.json'):
        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        self.memory_file = os.path.join(base_dir, memory_file) if not os.path.isabs(memory_file) else memory_file
        self.config_file = os.path.join(base_dir, config_file) if not os.path.isabs(config_file) else config_file
        self.memory = self._load_json(self.memory_file)
        self.config = self._load_json(self.config_file)
        self._migrate_sessions()
        
        # Initialize Supabase
        self.supabase = None
        self.current_user_id = None
        
        if 'supabase_url' in self.config and 'supabase_key' in self.config:
            try:
                self.supabase = create_client(self.config['supabase_url'], self.config['supabase_key'])
                print("[MEMORY] Supabase Cloud Sync: CONNECTED")
            except Exception as e:
                print(f"[MEMORY] Supabase Connection Failed: {e}")

    def sign_up(self, name, email, password):
        if not self.supabase: return {"error": "Cloud connection unavailable"}
        try:
            res = self.supabase.auth.sign_up({"email": email, "password": password})
            if res.user:
                # Create profile entry (robustly)
                try:
                    self.supabase.table("profiles").upsert({
                        "id": res.user.id,
                        "full_name": name,
                        "email": email
                    }).execute()
                except Exception as db_err:
                    print(f"[MEMORY] Profile creation failed during signup (ignoring): {db_err}")
                return {"id": res.user.id, "name": name, "email": email}
            return {"error": "Signup failed"}
        except Exception as e:
            return {"error": str(e)}

    def sign_in(self, email, password):
        if not self.supabase: return {"error": "Cloud connection unavailable"}
        try:
            res = self.supabase.auth.sign_in_with_password({"email": email, "password": password})
            if res.user:
                # Fetch profile name (more robustly)
                name = email.split('@')[0].capitalize()
                try:
                    profile = self.supabase.table("profiles").select("full_name").eq("id", res.user.id).execute()
                    if profile.data and len(profile.data) > 0:
                        name = profile.data[0]['full_name']
                    else:
                        # Self-heal: Create profile if missing
                        self.supabase.table("profiles").insert({
                            "id": res.user.id,
                            "full_name": name,
                            "email": email
                        }).execute()
                except Exception as db_err:
                    print(f"[MEMORY] Profile fetch/insert failed (falling back to email prefix): {db_err}")
                
                return {"id": res.user.id, "name": name, "email": email}
            return {"error": "Invalid credentials"}
        except Exception as e:
            return {"error": str(e)}

    def set_user(self, user_id):
        self.current_user_id = user_id
        print(f"[MEMORY] User Context Set: {user_id}")

    def _load_json(self, file_path):
        if os.path.exists(file_path):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except:
                return {}
        return {}

    def save_memory(self):
        try:
            with open(self.memory_file, 'w', encoding='utf-8') as f:
                json.dump(self.memory, f, indent=4, ensure_ascii=False)
        except Exception as e:
            print(f"[MEMORY] Warning: Could not write memory file (read-only filesystem?): {e}")

    def save_config(self, new_config):
        self.config.update(new_config)
        try:
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(self.config, f, indent=4, ensure_ascii=False)
        except Exception as e:
            print(f"[MEMORY] Warning: Could not write config file (read-only filesystem?): {e}")

    def get_config(self, key, default=None):
        return self.config.get(key, default)

    def update_user_pref(self, key, value):
        if 'user_preferences' not in self.memory:
            self.memory['user_preferences'] = {}
        self.memory['user_preferences'][key] = value
        self.save_memory()
        
        # Cloud Sync (Background)
        if self.supabase:
            def sync_pref():
                try:
                    self.supabase.table("preferences").upsert({
                        "user_id": self.current_user_id,
                        "settings": self.memory['user_preferences']
                    }).execute()
                except Exception as e:
                    print(f"[MEMORY] Cloud Pref Sync Failed: {e}")
            
            threading.Thread(target=sync_pref, daemon=True).start()

    def add_to_history(self, role, content):
        # Backward compatibility fallback
        self.add_to_session_history(role, content)

    def _migrate_sessions(self):
        """Ensure conversations dictionary exists in memory."""
        dirty = False
        if 'conversations' not in self.memory:
            # Transfer existing history to a default session
            old_history = self.memory.get('conversation_history', [])
            self.memory['conversations'] = {
                "default": {
                    "id": "default",
                    "title": "Default Chat",
                    "history": old_history
                }
            }
            self.memory['current_session_id'] = "default"
            dirty = True
        
        # Clean up old field if present
        if 'conversation_history' in self.memory:
            del self.memory['conversation_history']
            dirty = True
            
        if dirty:
            self.save_memory()

    def get_current_session_id(self):
        self._migrate_sessions()
        return self.memory.get('current_session_id', 'default')

    def get_current_session(self):
        self._migrate_sessions()
        sid = self.get_current_session_id()
        if sid not in self.memory['conversations']:
            # Fallback if session disappeared
            sids = list(self.memory['conversations'].keys())
            if sids:
                self.memory['current_session_id'] = sids[0]
                sid = sids[0]
            else:
                self.create_new_session()
                sid = self.get_current_session_id()
        return self.memory['conversations'][sid]

    def set_current_session(self, session_id):
        self._migrate_sessions()
        if session_id in self.memory['conversations']:
            self.memory['current_session_id'] = session_id
            self.save_memory()
            return True
        return False

    def create_new_session(self):
        self._migrate_sessions()
        import uuid
        new_id = str(uuid.uuid4())
        self.memory['conversations'][new_id] = {
            "id": new_id,
            "title": "New Chat",
            "history": []
        }
        self.memory['current_session_id'] = new_id
        self.save_memory()
        return new_id

    def delete_session(self, session_id):
        self._migrate_sessions()
        if session_id in self.memory['conversations']:
            del self.memory['conversations'][session_id]
            # If we deleted the active session, choose another or create new
            if self.memory.get('current_session_id') == session_id:
                sids = list(self.memory['conversations'].keys())
                if sids:
                    self.memory['current_session_id'] = sids[0]
                else:
                    self.create_new_session()
            self.save_memory()
            return True
        return False

    def update_session_title(self, session_id, title):
        self._migrate_sessions()
        if session_id in self.memory['conversations']:
            self.memory['conversations'][session_id]['title'] = title
            self.save_memory()
            return True
        return False

    def get_conversations_list(self):
        self._migrate_sessions()
        return [
            {"id": cid, "title": conv["title"]}
            for cid, conv in self.memory['conversations'].items()
        ]

    def add_to_session_history(self, role, content, session_id=None):
        self._migrate_sessions()
        if not session_id:
            session_id = self.get_current_session_id()
        
        if session_id in self.memory['conversations']:
            self.memory['conversations'][session_id]['history'].append({
                'role': role,
                'content': content
            })
            # Keep history to last 50 messages
            self.memory['conversations'][session_id]['history'] = self.memory['conversations'][session_id]['history'][-50:]
            self.save_memory()
            
            # Cloud Sync (Background)
            if self.supabase:
                def sync_chat():
                    try:
                        self.supabase.table("chat_history").insert({
                            "user_id": self.current_user_id,
                            "role": role,
                            "content": content
                        }).execute()
                    except Exception as e:
                        print(f"[MEMORY] Cloud Chat Sync Failed: {e}")
                
                threading.Thread(target=sync_chat, daemon=True).start()
