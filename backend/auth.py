"""
auth.py  —  Simple API key authentication.
Set API_KEY env var to enable. Leave blank for dev/demo (open access).
"""
from __future__ import annotations
import os
from fastapi import Header, HTTPException, status

API_KEY = os.getenv("API_KEY", "")


def verify_api_key(x_api_key: str = Header(default="")) -> str:
    """FastAPI dependency — Depends(verify_api_key)."""
    if not API_KEY:          # dev mode: no key configured → allow all
        return "dev"
    if x_api_key != API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing X-API-Key header.",
        )
    return x_api_key
