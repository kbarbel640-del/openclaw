# CI Failure Report - 2026-01-29

**Generated:** GitHub Actions notifications  
**Repositories:** noise.sh, Farm-to-Stars, clawdbot-liam  
**Date Range:** 2026-01-29 evening

---

## 🔴 noise.sh - Security Scans Failed

**Commit:** c06bb45  
**Duration:** 3m 38s  
**Run URL:** https://github.com/Pastorsimon1798/noise.sh/actions/runs/21507055605

### Failed Jobs

| Job | Issue | Annotations |
|-----|-------|-------------|
| Dependency Vulnerability Scan | Failed | 12 |
| License Compliance | Failed | 12 |
| Static Application Security Testing | Failed | 12 |

### Summary
Security scanning pipeline is failing across all three dimensions. This suggests either:
1. New vulnerabilities introduced in dependencies
2. License compatibility issues detected
3. SAST tool configuration or findings

---

## 🔴 Farm-to-Stars - Web CI Failed

**Commit:** f770be5  
**Duration:** 54s  
**Run URL:** https://github.com/Pastorsimon1798/Farm-to-Stars/actions/runs/21506880064

### Failed Jobs

| Job | Issue | Annotations |
|-----|-------|-------------|
| test | Failed | 22 |

### Summary
Test suite is failing with 22 annotations. Fast failure (54s) suggests early test or build error.

---

## ⚪ clawdbot-liam - CI Cancelled

**Commit:** d5fa912  
**Duration:** 1 day 2s  
**Run URL:** https://github.com/Pastorsimon1798/clawdbot-liam/actions/runs/21464972065

### Cancelled Jobs (15 total)

| Platform | Job | Status |
|----------|-----|--------|
| android | test | cancelled |
| android | build | cancelled |
| checks-windows | protocol | cancelled |
| checks-windows | lint | cancelled |
| checks-windows | build | cancelled |
| checks-windows | test | cancelled |
| checks | bun test | cancelled |
| checks | bun build | cancelled |
| checks | protocol | cancelled |
| checks | lint | cancelled |
| checks | format | cancelled |
| checks | build | cancelled |
| checks | test | cancelled |
| checks | install-check | cancelled |
| secrets | - | cancelled |

### Skipped Jobs (3)
- macos-app
- checks-macos
- ios

### Summary
Entire CI matrix was cancelled after running for over 24 hours. This typically indicates:
1. Manual cancellation by user
2. Resource constraints
3. Dependency on a failed job (if configured)
4. Timeout

---

## Recommended Actions

### Immediate
- [ ] Review noise.sh security scan details (12 annotations each)
- [ ] Check Farm-to-Stars test output for root cause
- [ ] Investigate why clawdbot-liam CI was cancelled after 1 day

### noise.sh
- [ ] Run `npm audit` or equivalent locally
- [ ] Review dependency update PRs
- [ ] Check license compatibility matrix

### Farm-to-Stars
- [ ] Run tests locally to reproduce
- [ ] Review 22 test annotations for patterns
- [ ] Check for environment-specific failures

### clawdbot-liam
- [ ] Determine if cancellation was intentional
- [ ] Re-run CI if needed
- [ ] Check for hung jobs that caused timeout

---

*Filed: 2026-01-30*  
*Folder: PARA/Projects/Clawdbot-Development/*
