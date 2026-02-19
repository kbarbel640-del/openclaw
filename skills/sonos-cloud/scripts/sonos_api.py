#!/usr/bin/env python3
"""Sonos Cloud Control API wrapper."""

import json
import sys
import urllib.request
import urllib.error
import os

# Add parent scripts dir to path for token_manager import
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from token_manager import get_access_token

BASE_URL = "https://api.ws.sonos.com/control/api/v1"


def api_request(method, path, household_name="default", body=None):
    """Make an authenticated request to the Sonos Control API."""
    token = get_access_token(household_name)
    url = f"{BASE_URL}{path}"

    data = json.dumps(body).encode() if body else None
    if method == "GET":
        data = None

    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", "application/json")
    if method in ("POST", "PUT") and data is None:
        req.add_header("Content-Length", "0")

    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read().decode()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        body_text = e.read().decode()
        print(f"API Error {e.code}: {body_text}", file=sys.stderr)
        raise


# ─── Discovery ─────────────────────────────────────────────

def get_households(household_name="default"):
    """Get all households for the authorized user."""
    return api_request("GET", "/households", household_name)


def get_groups(household_id, household_name="default"):
    """Get all groups and players in a household."""
    return api_request("GET", f"/households/{household_id}/groups", household_name)


def get_favorites(household_id, household_name="default"):
    """Get favorites for a household."""
    return api_request("GET", f"/households/{household_id}/favorites", household_name)


def get_playlists(household_id, household_name="default"):
    """Get playlists for a household."""
    return api_request("GET", f"/households/{household_id}/playlists", household_name)


# ─── Playback Control ──────────────────────────────────────

def play(group_id, household_name="default"):
    """Start playback."""
    return api_request("POST", f"/groups/{group_id}/playback/play", household_name)


def pause(group_id, household_name="default"):
    """Pause playback."""
    return api_request("POST", f"/groups/{group_id}/playback/pause", household_name)


def toggle_play_pause(group_id, household_name="default"):
    """Toggle play/pause."""
    return api_request("POST", f"/groups/{group_id}/playback/togglePlayPause", household_name)


def skip_to_next(group_id, household_name="default"):
    """Skip to next track."""
    return api_request("POST", f"/groups/{group_id}/playback/skipToNextTrack", household_name)


def skip_to_previous(group_id, household_name="default"):
    """Skip to previous track."""
    return api_request("POST", f"/groups/{group_id}/playback/skipToPreviousTrack", household_name)


def get_playback(group_id, household_name="default"):
    """Get current playback state."""
    return api_request("GET", f"/groups/{group_id}/playback", household_name)


def get_metadata(group_id, household_name="default"):
    """Get current track metadata."""
    return api_request("GET", f"/groups/{group_id}/playbackMetadata", household_name)


# ─── Volume ─────────────────────────────────────────────────

def get_volume(group_id, household_name="default"):
    """Get group volume."""
    return api_request("GET", f"/groups/{group_id}/groupVolume", household_name)


def set_volume(group_id, volume, household_name="default"):
    """Set group volume (0-100)."""
    return api_request("POST", f"/groups/{group_id}/groupVolume",
                       household_name, {"volume": int(volume)})


def set_mute(group_id, muted, household_name="default"):
    """Mute or unmute group."""
    return api_request("POST", f"/groups/{group_id}/groupVolume/mute",
                       household_name, {"muted": bool(muted)})


def set_relative_volume(group_id, delta, household_name="default"):
    """Adjust volume by delta (-100 to 100)."""
    return api_request("POST", f"/groups/{group_id}/groupVolume/relative",
                       household_name, {"volumeDelta": int(delta)})


# ─── Player Volume ──────────────────────────────────────────

def get_player_volume(player_id, household_name="default"):
    """Get individual player volume."""
    return api_request("GET", f"/players/{player_id}/playerVolume", household_name)


def set_player_volume(player_id, volume, household_name="default"):
    """Set individual player volume (0-100)."""
    return api_request("POST", f"/players/{player_id}/playerVolume",
                       household_name, {"volume": int(volume)})


# ─── Favorites ──────────────────────────────────────────────

def load_favorite(group_id, favorite_id, household_name="default",
                  play_on_completion=True, play_modes=None):
    """Load a favorite into a group."""
    body = {
        "favoriteId": favorite_id,
        "playOnCompletion": play_on_completion,
    }
    if play_modes:
        body["playModes"] = play_modes
    return api_request("POST", f"/groups/{group_id}/favorites",
                       household_name, body)


# ─── Groups ─────────────────────────────────────────────────

def create_group(household_id, player_ids, household_name="default"):
    """Create a new group with the given players."""
    return api_request("POST", f"/households/{household_id}/groups/createGroup",
                       household_name, {"playerIds": player_ids})


def modify_group(group_id, player_ids_to_add=None, player_ids_to_remove=None,
                 household_name="default"):
    """Add or remove players from a group."""
    body = {}
    if player_ids_to_add:
        body["playerIdsToAdd"] = player_ids_to_add
    if player_ids_to_remove:
        body["playerIdsToRemove"] = player_ids_to_remove
    return api_request("POST", f"/groups/{group_id}/groups/modifyGroupMembers",
                       household_name, body)


# ─── Audio Clip ─────────────────────────────────────────────

def play_audio_clip(player_id, app_id, name, clip_uri=None, volume=None,
                    household_name="default"):
    """Play an audio clip on a player (overlays on current playback)."""
    body = {"appId": app_id, "name": name}
    if clip_uri:
        body["streamUrl"] = clip_uri
    if volume is not None:
        body["volume"] = int(volume)
    return api_request("POST", f"/players/{player_id}/audioClip",
                       household_name, body)


# ─── Convenience ────────────────────────────────────────────

def discover(household_name="default"):
    """Full discovery: households, groups, players, favorites."""
    result = {}

    households = get_households(household_name)
    result["households"] = households.get("households", [])

    for hh in result["households"]:
        hh_id = hh["id"]
        groups_data = get_groups(hh_id, household_name)
        hh["groups"] = groups_data.get("groups", [])
        hh["players"] = groups_data.get("players", [])

        try:
            favs = get_favorites(hh_id, household_name)
            hh["favorites"] = favs.get("items", [])
        except Exception:
            hh["favorites"] = []

    return result


def status(household_name="default"):
    """Get current status of all groups: what's playing, volume, etc."""
    data = discover(household_name)
    result = []

    for hh in data["households"]:
        for group in hh.get("groups", []):
            group_id = group["id"]
            group_info = {
                "name": group.get("name", "Unknown"),
                "id": group_id,
                "playerIds": group.get("playerIds", []),
            }

            try:
                pb = get_playback(group_id, household_name)
                group_info["playbackState"] = pb.get("playbackState", "unknown")
            except Exception:
                group_info["playbackState"] = "error"

            try:
                meta = get_metadata(group_id, household_name)
                container = meta.get("container", {})
                current = meta.get("currentItem", {})
                track = current.get("track", {})
                group_info["nowPlaying"] = {
                    "track": track.get("name"),
                    "artist": track.get("artist", {}).get("name"),
                    "album": track.get("album", {}).get("name"),
                    "service": container.get("service", {}).get("name"),
                }
            except Exception:
                group_info["nowPlaying"] = None

            try:
                vol = get_volume(group_id, household_name)
                group_info["volume"] = vol.get("volume")
                group_info["muted"] = vol.get("muted")
            except Exception:
                pass

            result.append(group_info)

    return {"groups": result, "players": data["households"][0].get("players", []) if data["households"] else []}


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: sonos_api.py <command> [args...]")
        print()
        print("Discovery:")
        print("  discover [household]     — Full discovery (households, groups, players, favorites)")
        print("  status [household]       — Current status of all groups")
        print("  households [household]   — List households")
        print("  groups <hh_id> [household]")
        print("  favorites <hh_id> [household]")
        print()
        print("Playback:")
        print("  play <group_id> [household]")
        print("  pause <group_id> [household]")
        print("  toggle <group_id> [household]")
        print("  next <group_id> [household]")
        print("  prev <group_id> [household]")
        print("  now-playing <group_id> [household]")
        print()
        print("Volume:")
        print("  volume <group_id> [household]")
        print("  set-volume <group_id> <0-100> [household]")
        print("  mute <group_id> [household]")
        print("  unmute <group_id> [household]")
        print()
        print("Favorites:")
        print("  play-favorite <group_id> <fav_id> [household]")
        sys.exit(1)

    cmd = sys.argv[1]
    hh_name = "default"

    try:
        if cmd == "discover":
            hh_name = sys.argv[2] if len(sys.argv) > 2 else "default"
            print(json.dumps(discover(hh_name), indent=2))

        elif cmd == "status":
            hh_name = sys.argv[2] if len(sys.argv) > 2 else "default"
            s = status(hh_name)
            for g in s["groups"]:
                state = g["playbackState"]
                vol = g.get("volume", "?")
                muted = " [MUTED]" if g.get("muted") else ""
                print(f"\n🔊 {g['name']} — {state} | Volume: {vol}{muted}")
                if g.get("nowPlaying") and g["nowPlaying"].get("track"):
                    np = g["nowPlaying"]
                    print(f"   🎵 {np['track']} — {np.get('artist', '?')}")
                    if np.get("album"):
                        print(f"   💿 {np['album']}")
                    if np.get("service"):
                        print(f"   📡 {np['service']}")

            if s.get("players"):
                print(f"\n📍 Players:")
                for p in s["players"]:
                    print(f"   {p.get('name', '?')} ({p.get('id', '?')[:20]}...)")

        elif cmd == "households":
            hh_name = sys.argv[2] if len(sys.argv) > 2 else "default"
            print(json.dumps(get_households(hh_name), indent=2))

        elif cmd == "groups":
            print(json.dumps(get_groups(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else "default"), indent=2))

        elif cmd == "favorites":
            print(json.dumps(get_favorites(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else "default"), indent=2))

        elif cmd == "play":
            play(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else "default")
            print("▶️  Playing")

        elif cmd == "pause":
            pause(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else "default")
            print("⏸  Paused")

        elif cmd == "toggle":
            toggle_play_pause(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else "default")
            print("⏯  Toggled")

        elif cmd == "next":
            skip_to_next(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else "default")
            print("⏭  Next track")

        elif cmd == "prev":
            skip_to_previous(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else "default")
            print("⏮  Previous track")

        elif cmd == "now-playing":
            meta = get_metadata(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else "default")
            print(json.dumps(meta, indent=2))

        elif cmd == "volume":
            vol = get_volume(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else "default")
            print(f"Volume: {vol.get('volume')} | Muted: {vol.get('muted')}")

        elif cmd == "set-volume":
            set_volume(sys.argv[2], sys.argv[3], sys.argv[4] if len(sys.argv) > 4 else "default")
            print(f"🔊 Volume set to {sys.argv[3]}")

        elif cmd == "mute":
            set_mute(sys.argv[2], True, sys.argv[3] if len(sys.argv) > 3 else "default")
            print("🔇 Muted")

        elif cmd == "unmute":
            set_mute(sys.argv[2], False, sys.argv[3] if len(sys.argv) > 3 else "default")
            print("🔊 Unmuted")

        elif cmd == "play-favorite":
            load_favorite(sys.argv[2], sys.argv[3], sys.argv[4] if len(sys.argv) > 4 else "default")
            print(f"▶️  Playing favorite {sys.argv[3]}")

        else:
            print(f"Unknown command: {cmd}")
            sys.exit(1)

    except IndexError:
        print(f"Missing arguments for '{cmd}'. Run without args for usage.", file=sys.stderr)
        sys.exit(1)
