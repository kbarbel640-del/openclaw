# JC-001 — Sidecar Proof of Life (OpenClaw → Ted Engine)

## Outcome
From OpenClaw chat, operator runs a Ted command that returns sidecar /doctor output.

## Why this first
Proves architecture + boundaries before building features.

## Proof
- Start sidecar (loopback-only)
- In OpenClaw chat run: /ted doctor
- Output shows version + uptime
- Non-allowlisted endpoint is blocked (fail closed)
