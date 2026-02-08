---
summary: „Wie OpenClaw Auth-Profile rotiert und zwischen Modellen zurueckfaellt“
read_when:
  - Diagnose der Rotation von Auth-Profilen, Cooldowns oder des Model-Fallback-Verhaltens
  - Aktualisierung von Failover-Regeln fuer Auth-Profile oder Modelle
title: „Model-Failover“
x-i18n:
  source_path: concepts/model-failover.md
  source_hash: eab7c0633824d941
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:06Z
---

# Model-Failover

OpenClaw behandelt Ausfaelle in zwei Stufen:

1. **Rotation von Auth-Profilen** innerhalb des aktuellen Anbieters.
2. **Model-Fallback** zum naechsten Modell in `agents.defaults.model.fallbacks`.

Dieses Dokument erklaert die Laufzeitregeln und die zugrunde liegenden Daten.

## Auth-Speicher (Keys + OAuth)

OpenClaw verwendet **Auth-Profile** sowohl fuer API-Keys als auch fuer OAuth-Tokens.

- Geheimnisse liegen in `~/.openclaw/agents/<agentId>/agent/auth-profiles.json` (Legacy: `~/.openclaw/agent/auth-profiles.json`).
- Konfigurationen `auth.profiles` / `auth.order` enthalten **nur Metadaten + Routing** (keine Geheimnisse).
- Legacy-OAuth-Datei nur fuer den Import: `~/.openclaw/credentials/oauth.json` (wird bei der ersten Nutzung in `auth-profiles.json` importiert).

Weitere Details: [/concepts/oauth](/concepts/oauth)

Anmeldetypen:

- `type: "api_key"` → `{ provider, key }`
- `type: "oauth"` → `{ provider, access, refresh, expires, email? }` (+ `projectId`/`enterpriseUrl` fuer einige Anbieter)

## Profil-IDs

OAuth-Logins erzeugen unterschiedliche Profile, sodass mehrere Konten koexistieren koennen.

- Standard: `provider:default`, wenn keine E-Mail verfuegbar ist.
- OAuth mit E-Mail: `provider:<email>` (zum Beispiel `google-antigravity:user@gmail.com`).

Profile befinden sich in `~/.openclaw/agents/<agentId>/agent/auth-profiles.json` unter `profiles`.

## Rotationsreihenfolge

Wenn ein Anbieter mehrere Profile hat, waehlt OpenClaw die Reihenfolge wie folgt:

1. **Explizite Konfiguration**: `auth.order[provider]` (falls gesetzt).
2. **Konfigurierte Profile**: `auth.profiles`, gefiltert nach Anbieter.
3. **Gespeicherte Profile**: Eintraege in `auth-profiles.json` fuer den Anbieter.

Wenn keine explizite Reihenfolge konfiguriert ist, verwendet OpenClaw eine Round-Robin-Reihenfolge:

- **Primaerschluessel:** Profiltyp (**OAuth vor API-Keys**).
- **Sekundaerschluessel:** `usageStats.lastUsed` (aelteste zuerst, innerhalb jedes Typs).
- **Profile in Cooldown/deaktivierte Profile** werden ans Ende verschoben, sortiert nach dem naechsten Ablaufzeitpunkt.

### Sitzungs-Stickiness (cache-freundlich)

OpenClaw **fixiert das gewaehlte Auth-Profil pro Sitzung**, um Provider-Caches warm zu halten.
Es rotiert **nicht** bei jeder Anfrage. Das fixierte Profil wird wiederverwendet, bis:

- die Sitzung zurueckgesetzt wird (`/new` / `/reset`)
- eine Kompaktierung abgeschlossen ist (der Kompaktierungszaehler erhoeht sich)
- das Profil in Cooldown ist oder deaktiviert wird

Eine manuelle Auswahl ueber `/model …@<profileId>` setzt eine **Benutzerueberschreibung** fuer diese Sitzung
und wird nicht automatisch rotiert, bis eine neue Sitzung startet.

Automatisch fixierte Profile (vom Sitzungsrouter ausgewaehlt) gelten als **Praeferenz**:
Sie werden zuerst ausprobiert, aber OpenClaw kann bei Rate-Limits/Timeouts zu einem anderen Profil rotieren.
Vom Benutzer fixierte Profile bleiben auf dieses Profil gesperrt; schlaegt es fehl und sind Model-Fallbacks
konfiguriert, wechselt OpenClaw zum naechsten Modell, anstatt die Profile zu wechseln.

### Warum OAuth „verloren wirken“ kann

Wenn Sie sowohl ein OAuth-Profil als auch ein API-Key-Profil fuer denselben Anbieter haben, kann Round-Robin zwischen ihnen ueber Nachrichten hinweg wechseln, sofern sie nicht fixiert sind. Um ein einzelnes Profil zu erzwingen:

- Fixieren Sie es mit `auth.order[provider] = ["provider:profileId"]`, oder
- verwenden Sie eine sitzungsbezogene Ueberschreibung ueber `/model …` mit einer Profilueberschreibung (sofern von Ihrer UI/Chat-Oberflaeche unterstuetzt).

## Cooldowns

Wenn ein Profil aufgrund von Auth-/Rate-Limit-Fehlern (oder eines Timeouts, das wie Rate-Limiting aussieht) fehlschlaegt, markiert OpenClaw es mit einem Cooldown und wechselt zum naechsten Profil.
Format-/Ungueltige-Anfrage-Fehler (zum Beispiel Validierungsfehler der Tool-Call-ID von Cloud Code Assist) gelten als failover-wuerdig und verwenden dieselben Cooldowns.

Cooldowns verwenden exponentielles Backoff:

- 1 Minute
- 5 Minuten
- 25 Minuten
- 1 Stunde (Obergrenze)

Der Zustand wird in `auth-profiles.json` unter `usageStats` gespeichert:

```json
{
  "usageStats": {
    "provider:profile": {
      "lastUsed": 1736160000000,
      "cooldownUntil": 1736160600000,
      "errorCount": 2
    }
  }
}
```

## Abrechnungs-Deaktivierungen

Abrechnungs-/Kreditfehler (zum Beispiel „unzureichende Credits“ / „Kreditguthaben zu niedrig“) gelten als failover-wuerdig, sind jedoch in der Regel nicht transient. Statt eines kurzen Cooldowns markiert OpenClaw das Profil als **deaktiviert** (mit laengerem Backoff) und rotiert zum naechsten Profil/Anbieter.

Der Zustand wird in `auth-profiles.json` gespeichert:

```json
{
  "usageStats": {
    "provider:profile": {
      "disabledUntil": 1736178000000,
      "disabledReason": "billing"
    }
  }
}
```

Standardwerte:

- Das Abrechnungs-Backoff beginnt bei **5 Stunden**, verdoppelt sich pro Abrechnungsfehler und ist bei **24 Stunden** gedeckelt.
- Backoff-Zaehler werden zurueckgesetzt, wenn das Profil **24 Stunden** lang nicht fehlgeschlagen ist (konfigurierbar).

## Model-Fallback

Wenn alle Profile eines Anbieters fehlschlagen, wechselt OpenClaw zum naechsten Modell in
`agents.defaults.model.fallbacks`. Dies gilt fuer Auth-Fehler, Rate-Limits und
Timeouts, die die Profilrotation ausgeschoepft haben (andere Fehler fuehren nicht zu einem Fallback).

Wenn ein Lauf mit einer Modellueberschreibung startet (Hooks oder CLI), enden Fallbacks dennoch bei
`agents.defaults.model.primary`, nachdem alle konfigurierten Fallbacks ausprobiert wurden.

## Verwandte Konfiguration

Siehe [Gateway-Konfiguration](/gateway/configuration) fuer:

- `auth.profiles` / `auth.order`
- `auth.cooldowns.billingBackoffHours` / `auth.cooldowns.billingBackoffHoursByProvider`
- `auth.cooldowns.billingMaxHours` / `auth.cooldowns.failureWindowHours`
- `agents.defaults.model.primary` / `agents.defaults.model.fallbacks`
- `agents.defaults.imageModel` Routing

Siehe [Modelle](/concepts/models) fuer den uebergreifenden Ueberblick zur Modellauswahl und zu Fallbacks.
