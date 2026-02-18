# Test & Release Gates (Proof-Based)

**Generated:** 2026-02-17

---

## Philosophy

A build is shippable only when:
- deterministic tests pass,
- security audit gates are GREEN,
- installer artifacts exist for arm64 + intel,
- operator-facing doctor/setup checks are non-blocking.

---

## Required CI Gates (Minimum)

### Code quality
- lint (TS/JS + Python as applicable)
- unit tests
- integration tests for key flows

### Security gates
- deep security audit (Ted Profile) must be GREEN
- secret scan (fail on new secret-like values)
- dependency audit (npm + pip)

### Packaging gates
- build macOS artifacts:
  - arm64 DMG
  - intel DMG
- run basic artifact validation script (contents, versions)

---

## Manual “2-Minute Operator Validation” (pre-ship)

1. Install DMG (correct arch).
2. Launch app(s).
3. Confirm:
   - OpenClaw UI loads
   - Ted Engine reachable (status)
   - Setup Wizard runs
4. Run Doctor:
   - no blockers
5. Run one end-to-end workflow:
   - generate 1 email draft (it appears in Outlook Drafts)
6. Restart Mac:
   - auto-start works

---

## Proof Artifacts

Every release should attach:
- CI run URL
- artifact checksums
- security audit report summary
- doctor summary (redacted)

