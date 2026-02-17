# Changelog

## 2026.2.25

### Changes

- Version alignment with core OpenClaw release numbers.
- NIP-63 migration completed for the Nostr plugin: protocol now uses NIP-44 encryption and
  NIP-63 prompt/response events, with implicit `sender:{pubkey}` sessions plus explicit `s`-tag support.

## 2026.2.24

### Changes

- Version alignment with core OpenClaw release numbers.

## 2026.2.22

### Changes

- Version alignment with core OpenClaw release numbers.

## 2026.1.19-1

Initial release.

### Features

- Legacy v1: NIP-04 encrypted DM support (kind:4 events)
- Key validation (hex and nsec formats)
- Multi-relay support with sequential fallback
- Event signature verification
- TTL-based deduplication (24h)
- Access control via dmPolicy (pairing, allowlist, open, disabled)
- Pubkey normalization (hex/npub)

### Protocol Support

- NIP-01: Basic event structure
- Legacy v1: NIP-04 encrypted direct messages

### Planned for v2

- NIP-17: Gift-wrapped DMs
- NIP-44: Versioned encryption
- Media attachments
