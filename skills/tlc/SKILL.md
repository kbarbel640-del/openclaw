---
name: tlc
description: TLC/TLA+ Model Checker support with comprehensive security validations for formal verification tasks. Use when working with TLA+ specifications, PlusCal algorithms, or model checking distributed systems.
---

# TLC/TLA+ Language Support

## Overview

This skill provides secure integration with the TLC (Temporal Logic Checker) model checker for TLA+ specifications. TLA+ is a formal specification language used for modeling concurrent and distributed systems.

**Security Features:**

- Path traversal attack prevention via strict input validation
- Supply chain verification for downloaded JAR files (SHA256 checksums)
- Non-root container execution
- Input sanitization with whitelist approach

## When to Use This Skill

Use this skill when:

- Model checking TLA+ specifications
- Parsing and validating TLA+ syntax
- Running TLC on PlusCal algorithms
- Verifying distributed system properties
- Checking invariants and temporal properties

## Supported Tasks

### 1. Parse/Compile TLA+

Parse a TLA+ specification to check for syntax and semantic errors.

```bash
python3 tasks.py --language tla --target spec.tla --task parse --output-dir ./out
```

### 2. Model Check (TLC)

Run the TLC model checker on a specification with a configuration file.

```bash
python3 tasks.py --language tlc --target spec.tla --task check --timeout 600
```

**Required files:**

- `spec.tla` - The TLA+ specification
- `spec.cfg` - TLC configuration file

## Security Validations

### Path Traversal Protection

The implementation includes comprehensive protection against path traversal attacks:

- **Character Whitelist**: Only alphanumeric, hyphen, underscore, dot, and forward slash allowed
- **Forbidden Sequences**: Blocks `..`, `~`, environment variables, and shell metacharacters
- **Path Resolution**: All paths are resolved and verified to stay within the working directory
- **Length Limits**: Maximum path length enforced (4096 characters)

### Supply Chain Security

The TLC JAR file is verified using SHA256 checksums before execution:

```dockerfile
ENV TLC_JAR_SHA256="a3b3c3d3..."
RUN computed_sha256=$(sha256sum ${TLC_JAR_PATH} | cut -d' ' -f1) && \
    if [ "${computed_sha256}" != "${TLC_JAR_SHA256}" ]; then exit 1; fi
```

This prevents:

- Man-in-the-middle attacks during download
- Compromised JAR files from malicious mirrors
- Supply chain poisoning attacks

## Container Usage

### Building the Secure Container

```bash
docker build -f Dockerfile.tlc -t openclaw-tlc:latest .
```

### Running with Security Constraints

```bash
docker run --rm \
  --read-only \
  --security-opt=no-new-privileges:true \
  --cap-drop=ALL \
  --user 1000:1000 \
  -v $(pwd):/workspace:ro \
  openclaw-tlc:latest \
  python3 /opt/tlc/tasks.py --language tlc --target /workspace/spec.tla --task check
```

## Example TLA+ Specification

```tla
---- MODULE SimpleClock ----
EXTENDS Naturals

VARIABLE hour

Init == hour \in 1..12

Next == hour' = IF hour = 12 THEN 1 ELSE hour + 1

====
```

With corresponding `SimpleClock.cfg`:

```
INIT Init
NEXT Next
```

## Resources

### scripts/

- `tasks.py` - Secure task runner with path traversal protection

### References

- [TLA+ Home Page](https://lamport.azurewebsites.net/tla/tla.html)
- [TLC Model Checker](https://github.com/tlaplus/tlaplus)
- [Learning TLA+](https://learntla.com/)
