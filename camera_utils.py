"""
Z-TRACS Camera Identifier Normalization & Aliasing Utility
-----------------------------------------------------------
Provides bidirectional normalization between shorthand camera IDs (e.g., 'CAM-001')
and Gujarat Police Sentinel surveillance codes (e.g., 'CAM-GJ-AHM-SNTL-000001').
"""
import re
from typing import List

def normalize_camera_code(camera_code: str) -> str:
    """Normalize any camera code to standard shorthand format (e.g., 'CAM-001')."""
    if not camera_code:
        return "CAM-001"
    code = str(camera_code).strip()
    num_match = re.search(r'\d+', code)
    if num_match:
        num = int(num_match.group(0))
        return f"CAM-{num:03d}"
    return code.upper()

def get_sentinel_code(camera_code: str) -> str:
    """Convert shorthand camera code to full Sentinel format (e.g., 'CAM-GJ-AHM-SNTL-000001')."""
    code = str(camera_code).strip()
    num_match = re.search(r'\d+', code)
    if num_match:
        num = int(num_match.group(0))
        return f"CAM-GJ-AHM-SNTL-{num:06d}"
    return code

def get_code_aliases(camera_code: str) -> List[str]:
    """
    Generate all recognized aliases for a given camera code.
    Ensures zero lookup misses across frontend, backend, and edge nodes.
    """
    if not camera_code:
        return []
    code = str(camera_code).strip()
    aliases = [code, code.upper(), code.lower()]
    num_match = re.search(r'\d+', code)
    if num_match:
        num = int(num_match.group(0))
        aliases.extend([
            f"CAM-{num:03d}",
            f"CAM-{num}",
            f"CAM{num:03d}",
            f"CAM{num}",
            f"cam{num:02d}",
            f"cam{num}",
            f"CAM-GJ-AHM-SNTL-{num:06d}",
            f"CAM-GJ-AHM-SNTL-{num:05d}",
            f"CAM-GJ-AHM-SNTL-{num:04d}",
            str(num)
        ])
    seen = set()
    result = []
    for a in aliases:
        if a not in seen:
            seen.add(a)
            result.append(a)
    return result
