import sys
import traceback
try:
    import zoneinfo
    tz = zoneinfo.ZoneInfo("Asia/Kolkata")
    print("ZoneInfo loaded successfully:", tz)
except Exception as e:
    print("ZoneInfo Error:")
    traceback.print_exc()
