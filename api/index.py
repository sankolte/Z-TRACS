import sys
import os

current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.dirname(current_dir)
backend_dir = os.path.join(root_dir, "backend")

for p in [root_dir, backend_dir, os.path.join(backend_dir, "app")]:
    if p not in sys.path:
        sys.path.insert(0, p)

from backend.app.main import app
