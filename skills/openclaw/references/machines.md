# Machines: HonkBox / honk / maxblack

This file captures known machine context from AGENTS.md and highlights unknowns.

## HonkBox (this machine)

- Hostname: HonkBox
- IP: 192.168.1.165
- OS: Arch Linux (Kernel 6.17.9)
- Hardware: i9-9900K, 64GB RAM
- Role: Docker services, Node backends, LLM inference server
- Local LLM:
  - Ollama API: http://192.168.1.165:11434
  - Models: qwen2.5-coder:14b, qwen2.5-coder:32b (CPU-only)

## honk's MacBook Pro

- Hostname: honk's MacBook Pro
- IP: 192.168.1.44
- OS: macOS 26.1 (Tahoe)
- Hardware: M1 Pro, 16GB RAM
- SSH: ssh honk@192.168.1.44
- Local LLM:
  - Ollama API: http://192.168.1.44:11434
  - Model: qwen2.5-coder:7b

## maxblack (unknown)

- Not present in AGENTS.md.
- Ask user for:
  - OS + version
  - IP / hostname confirmation
  - SSH access string
  - Role (worker vs gateway vs dev)
