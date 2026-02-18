#!/usr/bin/env python3
"""Query Find My device locations via pyicloud on Cole's Mac Mini."""
import json
import subprocess
import sys
import tempfile
import os

REMOTE_SCRIPT = r'''
import json
from pyicloud import PyiCloudService
api = PyiCloudService('coletebou@gmail.com')
devices = api.devices
r = devices.response
content = r.get('content', [])
results = []
for d in content:
    loc = d.get('location')
    results.append({
        'name': d.get('name', 'Unknown'),
        'model': d.get('deviceDisplayName', ''),
        'class': d.get('deviceClass', ''),
        'battery': d.get('batteryLevel', None),
        'batteryStatus': d.get('batteryStatus', ''),
        'latitude': loc.get('latitude') if loc else None,
        'longitude': loc.get('longitude') if loc else None,
        'locationTimestamp': loc.get('timeStamp') if loc else None,
    })
print(json.dumps(results, indent=2))
'''

SSH_OPTS = ['-o', 'ConnectTimeout=10', '-o', 'IdentitiesOnly=yes', '-i', '/root/.ssh/id_ed25519']
SSH_HOST = 'coletebou@100.120.154.29'
PYTHON = '/Library/Developer/CommandLineTools/usr/bin/python3'

def get_devices():
    # Write script to remote, then execute it
    # Step 1: write script to temp file on Mac
    result = subprocess.run(
        ['ssh'] + SSH_OPTS + [SSH_HOST, f'cat > /tmp/_findmy.py << \'PYEOF\'\n{REMOTE_SCRIPT}\nPYEOF'],
        capture_output=True, text=True, timeout=15
    )
    # Step 2: run it
    result = subprocess.run(
        ['ssh'] + SSH_OPTS + [SSH_HOST, f'{PYTHON} /tmp/_findmy.py'],
        capture_output=True, text=True, timeout=30
    )
    if result.returncode != 0:
        print(f"Error: {result.stderr}", file=sys.stderr)
        sys.exit(1)
    return json.loads(result.stdout)

if __name__ == '__main__':
    devices = get_devices()
    if '--json' in sys.argv:
        print(json.dumps(devices, indent=2))
    else:
        for d in devices:
            loc_str = f"{d['latitude']}, {d['longitude']}" if d['latitude'] else "No location"
            battery = f" | Battery: {int(d['battery']*100)}%" if d['battery'] is not None else ""
            print(f"  {d['name']} ({d['model']}): {loc_str}{battery}")
