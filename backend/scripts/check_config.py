
import sys
import os

# Add parent directory to path so we can import app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import settings

print(f"CORS_ORIGINS type: {type(settings.cors_origins)}")
print(f"CORS_ORIGINS value: {settings.cors_origins}")

if isinstance(settings.cors_origins, list):
    for i, origin in enumerate(settings.cors_origins):
        print(f"  Item {i}: {repr(origin)} (type: {type(origin)})")
