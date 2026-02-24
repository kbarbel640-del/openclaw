import argparse
import json
import os
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Literal, NamedTuple, Optional

ROOT = Path(__file__).resolve().parent.parent
PACKAGE_JSON = ROOT / "package.json"
DOCKERFILE = ROOT / "Dockerfile"

PLATFORM = os.getenv("BUILD_PLATFORM", "linux/amd64")
REGISTRY = os.getenv("DOCKER_REGISTRY", "ghcr.io")
ORG_NAME = os.getenv("DOCKER_ORG", "realtyka")
IMAGE_BASE = os.getenv("DOCKER_IMAGE", "openclaw")

PUSH_RETRIES = int(os.getenv("PUSH_RETRIES", "3"))
PUSH_RETRY_DELAY = int(os.getenv("PUSH_RETRY_DELAY", "5"))

Environment = Literal["prod", "stage", "play", "team1", "team2", "team3", "team4", "team5"]


class Version(NamedTuple):
    major: int
    minor: int
    patch: int
    prerelease: str = ""

    def __str__(self) -> str:
        base = f"{self.major}.{self.minor}.{self.patch}"
        return f"{base}-{self.prerelease}" if self.prerelease else base

    @classmethod
    def parse(cls, version_str: str) -> "Version":
        parts = version_str.split("-", 1)
        base = parts[0].split(".")
        prerelease = parts[1] if len(parts) > 1 else ""
        return cls(int(base[0]), int(base[1]), int(base[2]), prerelease)


class BuildResult(NamedTuple):
    success: bool
    duration: float
    error: Optional[str] = None


def run_command(
    cmd: List[str],
    check: bool = True,
    retries: int = 1,
    stream_output: bool = False,
    cwd: Optional[Path] = None,
) -> subprocess.CompletedProcess:
    """Run a command with optional retries."""
    for attempt in range(retries):
        try:
            print(f"  $ {' '.join(cmd)}")

            if stream_output:
                process = subprocess.Popen(
                    cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, cwd=cwd
                )
                output_lines: list[str] = []
                for line in iter(process.stdout.readline, ""):  # type: ignore[union-attr]
                    if line:
                        print(f"    {line.rstrip()}")
                        output_lines.append(line)
                process.wait()
                stdout = "".join(output_lines)
                if check and process.returncode != 0:
                    raise subprocess.CalledProcessError(process.returncode, cmd, stdout, "")
                return subprocess.CompletedProcess(cmd, process.returncode, stdout, "")
            else:
                return subprocess.run(cmd, check=check, capture_output=True, text=True, cwd=cwd)

        except subprocess.CalledProcessError as e:
            if attempt < retries - 1:
                print(f"  [WARN] Attempt {attempt + 1}/{retries} failed: {e}")
                time.sleep(PUSH_RETRY_DELAY)
            else:
                print(f"  [ERROR] Failed after {retries} attempts: {e}")
                if not stream_output:
                    print(f"  stdout: {e.stdout}")
                    print(f"  stderr: {e.stderr}")
                raise

    return subprocess.CompletedProcess([], 1)


# --- Version management ---


def get_current_version() -> Version:
    data = json.loads(PACKAGE_JSON.read_text())
    return Version.parse(data["version"])


def get_next_version(current: Version, environment: Environment) -> Version:
    if environment == "prod":
        return Version(current.major, current.minor, current.patch + 1)
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%S")
    return Version(current.major, current.minor, current.patch, f"build.{timestamp}")


def update_package_json_version(version: Version) -> None:
    data = json.loads(PACKAGE_JSON.read_text())
    data["version"] = str(version)
    PACKAGE_JSON.write_text(json.dumps(data, indent=2) + "\n")


# --- Docker ---


def check_buildx_builder() -> bool:
    """Check if a buildx builder with cache support is available."""
    try:
        result = run_command(["docker", "buildx", "ls"], check=False)
        for line in result.stdout.split("\n"):
            if "*" in line and "docker-container" in line:
                return True
        return False
    except Exception:
        return False


def docker_login() -> bool:
    try:
        print(f"\n>> Logging into {REGISTRY}")
        run_command(["docker", "login", REGISTRY])
        return True
    except subprocess.CalledProcessError:
        print("[ERROR] Docker login failed")
        return False


def build_and_push(
    version: Version,
    dry_run: bool = False,
    use_cache: bool = True,
    build_args: Optional[dict[str, str]] = None,
) -> BuildResult:
    """Build and push the OpenClaw Docker image."""
    start = time.time()
    image = f"{REGISTRY}/{ORG_NAME}/{IMAGE_BASE}:{version}"

    try:
        print(f"\n{'=' * 60}")
        print(f"  Image:    {image}")
        print(f"  Platform: {PLATFORM}")
        print(f"  Cache:    {'on' if use_cache else 'off'}")
        print(f"{'=' * 60}\n")

        cmd = [
            "docker", "buildx", "build",
            f"--platform={PLATFORM}",
            "-t", image,
            "-f", str(DOCKERFILE),
        ]

        # Build args (e.g. OPENCLAW_INSTALL_BROWSER=1)
        for key, value in (build_args or {}).items():
            cmd.extend(["--build-arg", f"{key}={value}"])

        # Registry layer caching
        if use_cache:
            cache_ref = f"{REGISTRY}/{ORG_NAME}/{IMAGE_BASE}:cache"
            cmd.extend([
                "--cache-from", f"type=registry,ref={cache_ref}",
                "--cache-to", f"type=registry,ref={cache_ref},mode=max",
            ])

        if dry_run:
            print(f"[DRY RUN] Would build: {' '.join(cmd + ['.'])}")
        else:
            cmd.extend(["--push", "."])
            run_command(cmd, retries=PUSH_RETRIES, stream_output=True, cwd=ROOT)

            # Verify push
            run_command(["docker", "manifest", "inspect", image])
            print(f"\n  [OK] Verified {image} in registry")

        duration = time.time() - start
        print(f"  [OK] Completed in {duration:.1f}s\n")
        return BuildResult(True, duration)

    except subprocess.CalledProcessError as e:
        duration = time.time() - start
        msg = f"Build/push failed: {e}"
        print(f"\n  [FAILED] {msg} ({duration:.1f}s)\n")
        return BuildResult(False, duration, msg)


def cleanup_local_image(version: Version) -> None:
    image = f"{REGISTRY}/{ORG_NAME}/{IMAGE_BASE}:{version}"
    try:
        run_command(["docker", "rmi", image], check=False)
    except Exception:
        pass


# --- Main ---


def main() -> None:
    parser = argparse.ArgumentParser(description="Build and push OpenClaw Docker image")
    parser.add_argument(
        "-e", "--environment",
        choices=["prod", "stage", "play", "team1", "team2", "team3", "team4", "team5"],
        default="play",
        help="Target environment (default: play)",
    )
    parser.add_argument("--dry-run", action="store_true", help="Print commands without executing")
    parser.add_argument("--no-cache", action="store_true", help="Disable Docker layer caching")
    parser.add_argument("--cleanup", action="store_true", help="Remove local image after push")
    parser.add_argument("--install-browser", action="store_true", help="Include Chromium in image")
    parser.add_argument("--install-docker", action="store_true", help="Include Docker daemon for sandbox isolation")
    args = parser.parse_args()

    current = get_current_version()
    next_ver = get_next_version(current, args.environment)

    print(f"\n{'=' * 60}")
    print(f"  OpenClaw Docker Build")
    print(f"{'=' * 60}")
    print(f"  Environment: {args.environment}")
    print(f"  Version:     {current} -> {next_ver}")
    print(f"  Registry:    {REGISTRY}/{ORG_NAME}/{IMAGE_BASE}")
    print(f"  Platform:    {PLATFORM}")
    print(f"{'=' * 60}\n")

    if args.dry_run:
        print("[DRY RUN MODE]\n")

    # Buildx cache check
    has_cache = check_buildx_builder()
    use_cache = has_cache and not args.no_cache
    if not has_cache and not args.no_cache:
        print("[WARN] No buildx builder with cache support. Run: docker buildx create --use\n")

    # Login
    if not args.dry_run and not docker_login():
        sys.exit(1)

    # Build args
    build_args = {}
    if args.install_browser:
        build_args["OPENCLAW_INSTALL_BROWSER"] = "1"
    if args.install_docker:
        build_args["OPENCLAW_INSTALL_DOCKER"] = "1"

    # Build & push
    result = build_and_push(next_ver, dry_run=args.dry_run, use_cache=use_cache, build_args=build_args)

    if not result.success:
        sys.exit(1)

    # Cleanup
    if args.cleanup and not args.dry_run:
        print(">> Cleaning up local image...")
        cleanup_local_image(next_ver)

    # Production: bump version, commit, tag, push
    if args.environment == "prod" and not args.dry_run:
        print("\n>> Updating version and creating git tag...")
        update_package_json_version(next_ver)

        try:
            run_command(["git", "add", "package.json"], cwd=ROOT)
            run_command(["git", "commit", "-m", f"Bump version to {next_ver}"], cwd=ROOT)
            run_command(["git", "tag", "-a", f"v{next_ver}", "-m", f"Release {next_ver}"], cwd=ROOT)
            run_command(["git", "push", "origin", "HEAD", "--tags"], cwd=ROOT)
            print(f"  [OK] Git tag v{next_ver} created and pushed")
        except subprocess.CalledProcessError as e:
            print(f"  [ERROR] Git operations failed: {e}")
            sys.exit(1)

    # Report
    try:
        sha = run_command(["git", "rev-parse", "HEAD"], cwd=ROOT).stdout.strip()
        username = run_command(["git", "config", "user.name"], check=False, cwd=ROOT).stdout.strip()
        print(f"\n  version={next_ver}  sha={sha[:8]}  user={username}")
        print(f"##teamcity[setParameter name='env.DEPLOY_VERSION' value='{next_ver}']")
        print(f"##teamcity[setParameter name='env.DEPLOY_COMMIT_SHA' value='{sha}']")
    except Exception:
        pass

    print(f"\n{'=' * 60}")
    print(f"  BUILD COMPLETE ({result.duration:.1f}s)")
    print(f"{'=' * 60}\n")


if __name__ == "__main__":
    main()
