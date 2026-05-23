try:
    import psutil
except ImportError:
    psutil = None
import time

class SystemMonitor:
    def __init__(self):
        pass

    def get_stats(self):
        if not psutil:
            return {
                "cpu": 15.4, # Mock value for cloud telemetry
                "ram": 42.1,
                "battery": {"percent": 100, "plugged": True},
                "disk": 28.5,
                "net_io": {"sent": 10240, "recv": 20480}
            }
            
        return {
            "cpu": psutil.cpu_percent(interval=None),
            "ram": psutil.virtual_memory().percent,
            "battery": self._get_battery(),
            "disk": psutil.disk_usage('/').percent,
            "net_io": self._get_net_io()
        }

    def _get_battery(self):
        if not psutil:
            return {"percent": 100, "plugged": True}
        try:
            battery = psutil.sensors_battery()
            if battery:
                return {
                    "percent": battery.percent,
                    "plugged": battery.power_plugged
                }
        except:
            pass
        return {"percent": 0, "plugged": True}

    def _get_net_io(self):
        if not psutil:
            return {"sent": 0, "recv": 0}
        try:
            io = psutil.net_io_counters()
            return {
                "sent": io.bytes_sent,
                "recv": io.bytes_recv
            }
        except:
            return {"sent": 0, "recv": 0}

    def get_running_apps(self):
        if not psutil:
            return ["cloud-serverless-api"]
            
        apps = []
        for proc in psutil.process_iter(['name']):
            try:
                apps.append(proc.info['name'])
            except:
                pass
        return list(set(apps))[:10] # Top 10 for simplicity
