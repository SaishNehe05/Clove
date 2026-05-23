try:
    import pyautogui
except ImportError:
    pyautogui = None

try:
    import pytesseract
except ImportError:
    pytesseract = None

from PIL import Image
import os

class OCREngine:
    def __init__(self, tesseract_path):
        self.tesseract_path = tesseract_path
        if pytesseract:
            try:
                pytesseract.pytesseract.tesseract_cmd = tesseract_path
            except:
                pass

    def capture_and_read(self):
        if not pyautogui or not pytesseract:
            return "Screen OCR features are not available in a cloud environment."
            
        screenshot_path = "temp_ocr.png"
        try:
            screenshot = pyautogui.screenshot()
            screenshot.save(screenshot_path)
            
            text = pytesseract.image_to_string(Image.open(screenshot_path))
            if os.path.exists(screenshot_path):
                os.remove(screenshot_path)
            return text
        except Exception as e:
            return f"Failed to perform OCR in this environment: {str(e)}"
