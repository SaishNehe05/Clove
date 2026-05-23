import os
import glob

class FileManager:
    def __init__(self):
        self.base_dirs = [
            os.path.expanduser("~/Documents"),
            os.path.expanduser("~/Downloads"),
            os.path.expanduser("~/Desktop")
        ]

    def search_files(self, query):
        results = []
        for base in self.base_dirs:
            # Simple recursive search
            pattern = os.path.join(base, f"*{query}*")
            results.extend(glob.glob(pattern))
        
        return [os.path.basename(r) for r in results[:10]]

    def open_file(self, filename):
        for base in self.base_dirs:
            pattern = os.path.join(base, f"**/{filename}")
            matches = glob.glob(pattern, recursive=True)
            if matches:
                os.startfile(matches[0])
                return f"Opening {filename}."
        return f"Could not find {filename}."
