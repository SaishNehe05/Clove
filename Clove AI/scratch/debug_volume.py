from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume
from comtypes import CLSCTX_ALL, CoInitialize
from ctypes import cast, POINTER

try:
    CoInitialize()
    devices = AudioUtilities.GetSpeakers()
    print(f"Devices type: {type(devices)}")
    print(f"Devices dir: {dir(devices)}")
    interface = devices.Activate(IAudioEndpointVolume._iid_, CLSCTX_ALL, None)
    volume = cast(interface, POINTER(IAudioEndpointVolume))
    print("Success activating volume interface")
except Exception as e:
    print(f"Error: {e}")
