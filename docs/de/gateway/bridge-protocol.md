---
summary: „Bridge-Protokoll (Legacy-Nodes): TCP JSONL, Pairing, Scoped RPC“
read_when:
  - Beim Erstellen oder Debuggen von Node-Clients (iOS/Android/macOS Node-Modus)
  - Beim Untersuchen von Pairing- oder Bridge-Auth-Fehlern
  - Beim Auditieren der vom Gateway exponierten Node-Oberfläche
title: „Bridge-Protokoll“
x-i18n:
  source_path: gateway/bridge-protocol.md
  source_hash: 789bcf3cbc6841fc
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:21Z
---

# Bridge-Protokoll (Legacy-Node-Transport)

Das Bridge-Protokoll ist ein **Legacy**-Node-Transport (TCP JSONL). Neue Node-Clients
sollten stattdessen das einheitliche Gateway-WebSocket-Protokoll verwenden.

Wenn Sie einen Operator oder Node-Client erstellen, verwenden Sie das
[Gateway-Protokoll](/gateway/protocol).

**Hinweis:** Aktuelle OpenClaw-Builds liefern den TCP-Bridge-Listener nicht mehr aus; dieses Dokument wird zu historischen Referenzzwecken beibehalten.
Legacy-`bridge.*`-Konfigurationsschlüssel sind nicht mehr Teil des Konfigurationsschemas.

## Warum es beides gibt

- **Sicherheitsgrenze**: Die Bridge stellt eine kleine Allowlist statt der
  vollständigen Gateway-API-Oberfläche bereit.
- **Pairing + Node-Identität**: Die Node-Zulassung liegt beim Gateway und ist an
  ein Node-spezifisches Token gebunden.
- **Discovery-UX**: Nodes können Gateways im LAN über Bonjour erkennen oder sich
  direkt über ein Tailnet verbinden.
- **Loopback-WS**: Die vollständige WS-Steuerungsebene bleibt lokal, sofern sie
  nicht per SSH getunnelt wird.

## Transport

- TCP, ein JSON-Objekt pro Zeile (JSONL).
- Optionales TLS (wenn `bridge.tls.enabled` true ist).
- Der frühere Legacy-Standard-Listener-Port war `18790` (aktuelle Builds starten keine TCP-Bridge).

Wenn TLS aktiviert ist, enthalten Discovery-TXT-Records `bridgeTls=1` plus
`bridgeTlsSha256`, damit Nodes das Zertifikat pinnen können.

## Handshake + Pairing

1. Der Client sendet `hello` mit Node-Metadaten + Token (falls bereits gepairt).
2. Falls nicht gepairt, antwortet das Gateway mit `error` (`NOT_PAIRED`/`UNAUTHORIZED`).
3. Der Client sendet `pair-request`.
4. Das Gateway wartet auf die Freigabe und sendet dann `pair-ok` und `hello-ok`.

`hello-ok` gibt `serverName` zurück und kann `canvasHostUrl` enthalten.

## Frames

Client → Gateway:

- `req` / `res`: Scoped Gateway-RPC (Chat, Sitzungen, Konfiguration, Health, Voicewake, skills.bins)
- `event`: Node-Signale (Sprachtranskript, Agent-Anfrage, Chat-Abonnement, Exec-Lifecycle)

Gateway → Client:

- `invoke` / `invoke-res`: Node-Befehle (`canvas.*`, `camera.*`, `screen.record`,
  `location.get`, `sms.send`)
- `event`: Chat-Updates für abonnierte Sitzungen
- `ping` / `pong`: Keepalive

Die Legacy-Allowlist-Durchsetzung befand sich in `src/gateway/server-bridge.ts` (entfernt).

## Exec-Lifecycle-Events

Nodes können `exec.finished`- oder `exec.denied`-Events ausgeben, um system.run-Aktivitäten sichtbar zu machen.
Diese werden im Gateway auf System-Events abgebildet. (Legacy-Nodes können weiterhin `exec.started` ausgeben.)

Payload-Felder (alle optional, sofern nicht angegeben):

- `sessionKey` (erforderlich): Agent-Sitzung, die das System-Event empfangen soll.
- `runId`: eindeutige Exec-ID zur Gruppierung.
- `command`: roher oder formatierter Befehlsstring.
- `exitCode`, `timedOut`, `success`, `output`: Abschlussdetails (nur bei „finished“).
- `reason`: Ablehnungsgrund (nur bei „denied“).

## Tailnet-Nutzung

- Binden Sie die Bridge an eine Tailnet-IP: `bridge.bind: "tailnet"` in
  `~/.openclaw/openclaw.json`.
- Clients verbinden sich über den MagicDNS-Namen oder die Tailnet-IP.
- Bonjour überschreitet **keine** Netzwerke; verwenden Sie bei Bedarf manuelle Host/Port-Angaben oder Wide-Area-DNS‑SD.

## Versionierung

Die Bridge ist derzeit **implizit v1** (keine Min/Max-Aushandlung). Abwärtskompatibilität wird erwartet; fügen Sie vor jeglichen Breaking Changes ein Bridge-Protokollversionsfeld hinzu.
