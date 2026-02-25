#!/usr/bin/env python3
"""
Validate Sparkle appcast metadata against published macOS release artifacts.

Checks each <item> in appcast.xml:
- sparkle:version matches CFBundleVersion inside OpenClaw.app/Contents/Info.plist
- sparkle:shortVersionString matches CFBundleShortVersionString
"""

from __future__ import annotations

import argparse
import io
import plistlib
import re
import sys
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
import zipfile

SPARKLE_NS = "http://www.andymatuschak.org/xml-namespaces/sparkle"
SPARKLE_VERSION_TAG = f"{{{SPARKLE_NS}}}version"
SPARKLE_SHORT_TAG = f"{{{SPARKLE_NS}}}shortVersionString"
PLIST_PATH = "OpenClaw.app/Contents/Info.plist"


def get_text(item: ET.Element, tag: str) -> str:
    value = item.findtext(tag)
    return value.strip() if value else ""


def fetch_url_bytes(url: str) -> bytes:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "openclaw-appcast-validator/1.0",
            "Accept": "application/octet-stream,application/xml,text/xml,*/*",
        },
    )
    with urllib.request.urlopen(req, timeout=120) as response:  # nosec B310
        return response.read()


def read_plist_from_zip(zip_bytes: bytes) -> dict:
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        with zf.open(PLIST_PATH) as plist_file:
            return plistlib.load(plist_file)


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate Sparkle appcast metadata.")
    parser.add_argument(
        "appcast",
        nargs="?",
        default="appcast.xml",
        help="Path to appcast XML (default: appcast.xml)",
    )
    args = parser.parse_args()

    tree = ET.parse(args.appcast)
    root = tree.getroot()
    items = root.findall("./channel/item")
    errors: list[str] = []

    if not items:
        print("No <item> entries found in appcast.", file=sys.stderr)
        return 1

    for index, item in enumerate(items, start=1):
        title = get_text(item, "title") or f"item #{index}"
        sparkle_version = get_text(item, SPARKLE_VERSION_TAG)
        sparkle_short = get_text(item, SPARKLE_SHORT_TAG)
        enclosure = item.find("enclosure")
        url = enclosure.get("url", "").strip() if enclosure is not None else ""

        if not sparkle_version:
            errors.append(f"{title}: missing sparkle:version")
            continue
        if not re.fullmatch(r"\d+", sparkle_version):
            errors.append(f"{title}: sparkle:version must be numeric, got '{sparkle_version}'")
            continue
        if not sparkle_short:
            errors.append(f"{title}: missing sparkle:shortVersionString")
            continue
        if not url:
            errors.append(f"{title}: missing enclosure url")
            continue

        try:
            zip_bytes = fetch_url_bytes(url)
        except urllib.error.URLError as exc:
            errors.append(f"{title}: failed to download enclosure ({url}): {exc}")
            continue

        try:
            plist = read_plist_from_zip(zip_bytes)
        except (zipfile.BadZipFile, KeyError, plistlib.InvalidFileException) as exc:
            errors.append(f"{title}: failed to read {PLIST_PATH} from enclosure ({url}): {exc}")
            continue

        bundle_short = str(plist.get("CFBundleShortVersionString", "")).strip()
        bundle_version = str(plist.get("CFBundleVersion", "")).strip()

        if bundle_short != sparkle_short:
            errors.append(
                f"{title}: short version mismatch appcast='{sparkle_short}' zip='{bundle_short}' ({url})"
            )
        if bundle_version != sparkle_version:
            errors.append(
                f"{title}: build version mismatch appcast='{sparkle_version}' zip='{bundle_version}' ({url})"
            )

    if errors:
        print("Appcast validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print(f"Appcast validation passed for {len(items)} item(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
