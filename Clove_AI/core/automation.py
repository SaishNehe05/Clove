import os
import subprocess
import webbrowser

# Safe imports for desktop-specific libraries
try:
    import pyautogui
except ImportError:
    pyautogui = None

try:
    from pycaw.pycaw import AudioUtilities
    from comtypes import CoInitialize, CoUninitialize
except ImportError:
    AudioUtilities = None
    CoInitialize = None
    CoUninitialize = None

class AutomationEngine:
    def __init__(self):
        self.apps = {
            "chrome": "chrome",
            "vs code": "code",
            "spotify": "spotify",
            "notepad": "notepad",
            "calculator": "calc",
            "task manager": "taskmgr",
            "explorer": "explorer"
        }

    def open_app(self, app_name):
        # Prevent running GUI apps in cloud/headless environment
        if os.environ.get("VERCEL") or not os.name == 'nt':
            return f"Opening applications like '{app_name}' is a local desktop feature and cannot be done from the cloud."
            
        app_name = app_name.lower()
        if app_name in self.apps:
            subprocess.Popen([self.apps[app_name]], shell=True)
            return f"Opening {app_name}."
        else:
            # Fallback to search in PATH or direct execution
            try:
                subprocess.Popen([app_name], shell=True)
                return f"Attempting to open {app_name}."
            except:
                return f"Sorry, I couldn't find {app_name}."

    def set_volume(self, level):
        if not AudioUtilities:
            return "Volume control is a local desktop feature and is not supported in cloud deployment."
            
        try:
            # Initialize COM for the current thread
            CoInitialize()
            
            # Get the default speaker device using pycaw's simplified interface
            devices = AudioUtilities.GetSpeakers()
            
            # The AudioDevice object in recent pycaw versions has a direct EndpointVolume property
            volume = devices.EndpointVolume
            
            # Set volume (0.0 to 1.0)
            volume.SetMasterVolumeLevelScalar(level / 100, None)
            
            # Clean up
            CoUninitialize()
            return f"Volume set to {level}%."
        except Exception as e:
            # Always try to uninitialize if it was initialized
            try: CoUninitialize()
            except: pass
            return f"Failed to control volume: {str(e)}"

    def search_web(self, query):
        if os.environ.get("VERCEL") or not os.name == 'nt':
            return f"Searching the web directly on a server is not supported, but you can search manually at: https://google.com/search?q={query}"
            
        url = f"https://www.google.com/search?q={query}"
        webbrowser.open(url)
        return f"Searching for {query} on the web."

    def take_screenshot(self, path="static/assets/screenshot.png"):
        if not pyautogui:
            raise NotImplementedError("Desktop screenshot features are not available in a cloud environment.")
            
        screenshot = pyautogui.screenshot()
        # Ensure folder exists
        os.makedirs(os.path.dirname(path), exist_ok=True)
        screenshot.save(path)
        return path

    def execute_routine(self, routine_list):
        responses = []
        for cmd in routine_list:
            if cmd.startswith("open "):
                responses.append(self.open_app(cmd[5:]))
            elif cmd.startswith("search "):
                responses.append(self.search_web(cmd[7:]))
        return " | ".join(responses)
