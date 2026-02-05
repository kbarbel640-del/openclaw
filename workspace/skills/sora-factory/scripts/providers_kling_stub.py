"""Kling provider (stub).

We intentionally land a stub first so the rest of the factory can be refactored
without blocking on exact API details.

Next step: fill in endpoints once we have Kling official docs + API key.
"""

from __future__ import annotations

import os
from typing import Any

from providers_base import CreateResult, GetResult, VideoProvider


class KlingProvider(VideoProvider):
    name = "kling"

    def __init__(self, api_key: str | None = None, base_url: str | None = None):
        self.api_key = api_key or os.environ.get("KLING_API_KEY")
        self.base_url = base_url or os.environ.get("KLING_BASE_URL")

    def create(self, prompt: str, **opts: Any) -> CreateResult:
        raise RuntimeError(
            "KlingProvider not implemented yet: need Kling official API docs (endpoints/payload/auth)."
        )

    def get(self, job_id: str) -> GetResult:
        raise RuntimeError("KlingProvider not implemented yet")

    def download(self, url: str, dest_path: str) -> str:
        # We can reuse download_manager.py once URLs are available.
        raise RuntimeError("KlingProvider not implemented yet")
