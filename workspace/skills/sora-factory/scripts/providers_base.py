"""Provider abstraction for ai-video-factory.

Goal: keep the stable back-half (manifest/QC/assemble) while swapping generation engines.

We start with a minimal interface to avoid heavy refactors.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional


@dataclass
class CreateResult:
    job_id: str
    meta: Dict[str, Any] | None = None


@dataclass
class GetResult:
    status: str  # queued|running|succeeded|failed
    result_url: Optional[str] = None
    meta: Dict[str, Any] | None = None


class VideoProvider:
    """Abstract provider."""

    name: str = "base"

    def create(self, prompt: str, **opts) -> CreateResult:  # pragma: no cover
        raise NotImplementedError

    def get(self, job_id: str) -> GetResult:  # pragma: no cover
        raise NotImplementedError

    def download(self, url: str, dest_path: str) -> str:  # pragma: no cover
        """Download to dest_path; return dest_path."""
        raise NotImplementedError
