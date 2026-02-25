"""pytest configuration for governed-agents tests."""
import os
import pytest

# Skip integration tests that require live Command Center
CC_URL = os.environ.get("CC_URL", "http://localhost:3010")
CC_REACHABLE = False

# Check if CC is reachable (lightweight check)
if os.environ.get("CI"):
    CC_REACHABLE = False  # Always skip in CI
else:
    import subprocess
    try:
        r = subprocess.run(
            ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", f"{CC_URL}/api/health"],
            capture_output=True, text=True, timeout=5
        )
        CC_REACHABLE = r.stdout.strip() == "200"
    except Exception:
        CC_REACHABLE = False

requires_cc = pytest.mark.skipif(
    not CC_REACHABLE,
    reason=f"Command Center not reachable at {CC_URL} (set CC_URL env to override)"
)
