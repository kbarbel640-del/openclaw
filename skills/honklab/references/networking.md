# Advanced Networking Reference

## Comcast / Xfinity Gateway (Upstream Modem/Router)

### Access Admin Tool

- From LAN, open: `http://10.0.0.1`
- Login: `admin` + the **router password** from 1Password (`Xfinity Router` item).
- The Admin Tool is now **disabled by default** on many gateways; enable it in the
  Xfinity app:
  - `Xfinity app > WiFi > View WiFi equipment > Advanced settings > Admin Tool online access > Allow`
- After toggling on, the Admin Tool works only from the home network.

### Port Forwarding / DMZ (Xfinity)

- Port Forwarding and DMZ are now managed in the **Xfinity app** (the Admin Tool
  UI may show an app-only message).
- Forward **TCP 80 + 443** from the gateway's WAN to the UDM WAN IP (`10.0.0.218`).
- If you must avoid double NAT, consider enabling **Bridge Mode** on the gateway.

### Hidden Admin Tool Pages (Local Only)

When the UI shows the app-only message, the underlying endpoints still exist:

- Add port forward UI: `http://10.0.0.1/port_forwarding_add.jst`
  - Includes the device list (UDM shows as `10.0.0.218`).
  - CSRF token is embedded as `var token = "<token>"`.
  - Add rule via POST:
    - `actionHandler/ajax_port_forwarding.jst`
    - Params: `add=true&name=<name>&type=<TCP|UDP|TCP/UDP>&ip=<ipv4>&ipv6addr=x&startport=<p>&endport=<p>&csrfp_token=<token>`
- DMZ UI: `http://10.0.0.1/dmz.jst`
  - Uses POST `actionHandler/ajaxSet_DMZ_configuration.jst` with `dmzInfo` JSON + `csrfp_token`.
  - DMZ is high-risk (exposes all ports) - prefer explicit forwards.

### Observations

- If adding port 80/443 returns a conflict, those ports are already forwarded
  to another device. Remove/replace via the Xfinity app or reset rules.
- Once 443 is forwarded to the UDM, Caddy can complete TLS-ALPN-01 and obtain a
  public certificate for `lnbits.klabo.world`.
- 2026-02-04: Xfinity Admin Tool POSTs for ports 80/443 returned conflict; the
  service name `lnbits-https` already existed in Port Forwarding.
- 2026-02-05: Xfinity app shows port 80 forwarded to UDM WAN (`10.0.0.218`)
  under "Ubiquiti UniFi Network".
- 2026-02-05: Xfinity Admin Tool POST succeeded for TCP 443 → `10.0.0.218`
  (`lnbits-https2`).
- 2026-02-05: Xfinity Admin Tool POST succeeded for TCP 9735 → `10.0.0.218`
  (`lnd-p2p`).
- 2026-02-05: UDM port forward added for LND P2P (TCP 9735 → `192.168.1.165`).

### Bridge Mode Caveat

- If the gateway is in bridge mode, the app can hide Admin Tool settings.
- In that case, temporarily disable bridge mode (via support/app), enable Admin Tool access, then re-enable bridge mode.

### Upstream NAT Note

- UDM WAN shows a private IP (`10.0.0.218`), so upstream port forwarding or bridge mode is required for public access.

### Docs

- https://help.ui.com/hc/en-us/articles/204909374-Connecting-to-UniFi-with-Debug-Tools-SSH
- https://help.ui.com/hc/en-us/articles/235247068-Adding-SSH-Keys-to-UniFi-Devices
- https://help.ui.com/hc/en-us/articles/235723207-UniFi-Gateway-Port-Forwarding
- https://www.xfinity.com/support/articles/admin-tool-access
- https://www.xfinity.com/support/articles/port-forwarding-xfinity-wireless-gateway
- https://www.xfinity.com/support/articles/wireless-gateway-enable-disable-bridge-mode
- https://forums.xfinity.com/conversations/your-home-network/set-up-port-forwarding-using-the-xfinity-app/628e2a5e12a55455e0b1e1d1
- https://forums.xfinity.com/conversations/your-home-network/how-to-enable-admin-tool-online-access/628e1249edce08681e590ab6
- https://help.ui.com/hc/en-us/articles/30202160464023-Hairpin-NAT-in-UniFi
- https://help.ui.com/hc/en-us/articles/12648697125783-UniFi-Gateway-UPnP
- https://letsencrypt.org/docs/challenge-types/
- https://developers.cloudflare.com/http3/

## UniFi REST API Access

**Authentication:**

1. Get password: `op item get wqh2jay6op5szqo52ugerto5b4 --vault Agents --fields password --reveal`
2. Get MFA code from gog gmail (UI account email: `account-noreply@ui.com`)
3. Login:

```bash
PASS=$(op item get wqh2jay6op5szqo52ugerto5b4 --vault Agents --fields password --reveal)
curl -sk -c /tmp/unifi_jar -X POST 'https://192.168.1.1/api/auth/login' \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"joelklabo\",\"password\":\"$PASS\",\"token\":\"<MFA_CODE>\",\"rememberMe\":false}"
```

4. Extract CSRF token from the TOKEN cookie JWT payload (`csrfToken` field), or decode:

```bash
cat /tmp/unifi_jar | grep TOKEN | awk '{print $NF}' | cut -d. -f2 | base64 -d 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin)['csrfToken'])"
```

**API Base URL:** `https://192.168.1.1/proxy/network/api/s/default`

**Headers (all requests):**

```bash
-b /tmp/unifi_jar -H "x-csrf-token: <CSRF_TOKEN>"
```

**Key Endpoints:**

| Endpoint                 | Method | Purpose                                    |
| ------------------------ | ------ | ------------------------------------------ |
| `/rest/wlanconf`         | GET    | List all WLAN (SSID) configs               |
| `/rest/wlanconf/{id}`    | PUT    | Update SSID settings                       |
| `/stat/device`           | GET    | List all devices with live stats           |
| `/rest/device/{id}`      | PUT    | Update device settings (radios, overrides) |
| `/rest/setting`          | GET    | List all system settings                   |
| `/rest/setting/usg/{id}` | PUT    | Update gateway settings                    |
| `/stat/sta`              | GET    | List connected clients                     |
| `/rest/wlangroup`        | GET    | List WLAN groups (Default + Off)           |

**Device IDs:**

| Device      | ID                         | Model          |
| ----------- | -------------------------- | -------------- |
| UDM         | `6597781387d6712ea3800f65` | UDM            |
| Beacon HD   | `615f47b9fe62990337042cb3` | UDMB           |
| U6 IW       | `6935e8091236390605d9fa83` | U6IW           |
| U7-Pro-Wall | `693505d855c6c7202da278cd` | U7PIW          |
| UAP-AC-Lite | `6935e78a1236390605d9fa6d` | U7LT (offline) |

**WLAN IDs:**

| SSID          | ID                         |
| ------------- | -------------------------- |
| Klabo         | `60f0b0d737353c05148e1b42` |
| waldo         | `60f1930659189d050997c3b4` |
| Klabo 2.4 GHz | `69781d4ee698ef1bebeb5fa1` |

**Example: Read WiFi settings**

```bash
curl -sk -b /tmp/unifi_jar -H "x-csrf-token: $CSRF" \
  'https://192.168.1.1/proxy/network/api/s/default/rest/wlanconf' | python3 -m json.tool
```

**Example: Update SSID setting**

```bash
curl -sk -b /tmp/unifi_jar -H "x-csrf-token: $CSRF" \
  -H "Content-Type: application/json" -X PUT \
  -d '{"group_rekey": 3600}' \
  'https://192.168.1.1/proxy/network/api/s/default/rest/wlanconf/69781d4ee698ef1bebeb5fa1'
```

**Example: Update device radio settings**

```bash
curl -sk -b /tmp/unifi_jar -H "x-csrf-token: $CSRF" \
  -H "Content-Type: application/json" -X PUT \
  -d '{"radio_table": [{"name": "ra0", "radio": "ng", "channel": "auto", "ht": 20, "tx_power_mode": "medium", "min_rssi_enabled": true, "min_rssi": -78, "antenna_gain": 3, "nss": 2}]}' \
  'https://192.168.1.1/proxy/network/api/s/default/rest/device/6597781387d6712ea3800f65'
```

**Gotchas:**

- `minrate_ng_data_rate_kbps` changes require `minrate_setting_preference: "manual"` to take effect (API returns OK but silently ignores otherwise).
- Radio names differ by device: UDM/Beacon use `ra0`/`rai0`, newer APs use `wifi0`/`wifi1`/`wifi2`.
- Beacon HD (UDMB) is a mesh extender — `wlangroup_id_ng` and `wlan_overrides` are silently ignored.
- WLAN group "Off" ID: `5dcadb0937353c05148e1b38` (can disable all SSIDs on a radio).
- Session tokens expire ~2 hours after login. Re-authenticate if you get 401s.
- Always use `-sk` (silent + insecure) since the UDM uses a self-signed cert.

## WiFi Optimization Settings (2026-02-05)

- All 5/6 GHz radios: min_rssi=-78, 2.4 GHz: -80
- UDM 2.4 GHz: tx_power_mode=medium (was high)
- UDM 5 GHz: channel 149 (UNII-3, no DFS)
- U6 IW 5 GHz: channel 36 (UNII-1, no DFS)
- U7-Pro-Wall + Beacon HD: channel 108 (DFS, mesh pair)
- All SSIDs: minrate_ng=6000 kbps, group_rekey=3600
- Klabo: wpa3_fast_roaming=true
- NAT-PMP: disabled
