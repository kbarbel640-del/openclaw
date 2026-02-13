# Health Monitor - Automated System Monitoring

## Quick Health Check (Every 30 minutes)

Execute as seguintes verificações em ordem:

### 1. Security Check (Priority: CRITICAL)

```
- Run security_stats
- Check for critical/high alerts in last 30min
- If critical alerts > 0: ESCALATE IMMEDIATELY
- If high alerts > 3: DELEGATE to security-engineer
```

### 2. Gateway Health (Priority: CRITICAL)

```
- Check gateway status (quick check, no deep probe)
- Verify response time < 2000ms
- If gateway down: ESCALATE IMMEDIATELY
- If response time > 5000ms: ESCALATE to sre
```

### 3. Recent Changes Impact (Priority: HIGH)

```
- Get commits from last 30 minutes (git log)
- Scan for critical keywords: TODO, FIXME, HACK, XXX
- Check if any new files added without tests
- If critical TODOs found: LOG to workspace
```

### 4. Quick Quality Check (Priority: MEDIUM)

```
- Run quick lint check (oxlint, no full build)
- Count errors in output
- If > 50 errors: DELEGATE to quality-engineer
- If > 10 errors: LOG to workspace
```

### 5. Process Health (Priority: MEDIUM)

```
- Check for zombie processes
- Verify no memory leaks
- If issues: LOG to workspace
```

---

## Decision Logic

```
IF any check returns CRITICAL:
  1. Start collaboration debate immediately
  2. Include: CISO, CTO, relevant specialist
  3. Set timeout: 4 hours
  4. Return status message (not HEARTBEAT_OK)

ELSE IF any check returns HIGH:
  1. Delegate to specialist via sessions_spawn
  2. Set timeout: 24 hours
  3. Log to team_workspace
  4. Return status message (not HEARTBEAT_OK)

ELSE IF any check returns MEDIUM:
  1. Log to team_workspace
  2. Schedule review for next deep scan
  3. Continue to next check

ELSE (all checks pass):
  HEARTBEAT_OK
```

---

## Response Templates

### All Clear

```
HEARTBEAT_OK
```

### Critical Issue Detected

```
🚨 CRITICAL ALERT: [Issue Category]

Issue: [Description]
Detected: [Timestamp]
Impact: [Analysis]

Action Taken:
- Collaboration debate started
- Session: [sessionKey]
- Participants: @ciso, @cto, @[specialist]

Timeout: 4 hours
```

### High Priority Issue

```
⚠️ HIGH PRIORITY: [Issue Category]

Issue: [Description]
Detected: [Timestamp]

Action Taken:
- Delegated to @[specialist]
- Task ID: [taskId]
- Timeout: 24 hours

Tracking: Logged to workspace
```

### Medium/Low Issues

```
📝 [Count] medium/low issues logged

Categories:
- [Category 1]: [Count]
- [Category 2]: [Count]

Details: team_workspace/health-report-[timestamp].md

Next review: Next deep scan (in [time])
```

---

## Escalation Triggers

### Security

- **CRITICAL:** Any critical severity alert
- **HIGH:** > 3 high severity alerts in 30min
- **MEDIUM:** > 10 medium severity alerts in 30min

### Gateway

- **CRITICAL:** Gateway down or unresponsive
- **HIGH:** Response time > 5000ms
- **MEDIUM:** Response time > 2000ms

### Quality

- **CRITICAL:** > 100 lint errors
- **HIGH:** > 50 lint errors
- **MEDIUM:** > 10 lint errors

### Testing

- **CRITICAL:** Coverage < 50%
- **HIGH:** Coverage < 60%
- **MEDIUM:** Coverage < 70%

### Dependencies

- **CRITICAL:** Critical vulnerability in production dep
- **HIGH:** High vulnerability in any dep
- **MEDIUM:** > 20 outdated dependencies

---

## Configuration

### Scan Frequency

- Quick scans: Every 30 minutes (via heartbeat)
- Normal scans: Every 2 hours (via cron)
- Deep scans: Every 6 hours (via cron)

### Timeout Settings

- Heartbeat execution: 5 minutes max
- Critical escalation: 4 hours
- High delegation: 24 hours
- Medium review: 1 week

### Noise Reduction

- Suppress duplicate alerts within 1 hour
- Batch medium/low issues (report max once per hour)
- Filter known false positives (configurable whitelist)

---

## Example Scenarios

### Scenario 1: All Healthy

```
[Heartbeat Trigger]
→ Security check: ✅ 0 alerts
→ Gateway check: ✅ 250ms response
→ Recent changes: ✅ No critical TODOs
→ Quality check: ✅ 2 minor warnings
→ Process check: ✅ All healthy

Result: HEARTBEAT_OK
```

### Scenario 2: Critical Security Alert

```
[Heartbeat Trigger]
→ Security check: ❌ 1 critical alert (CVE-2024-XXXX)
→ Immediate escalation triggered

Actions:
1. collaboration.session.init({
   topic: "Critical: CVE-2024-XXXX in jsonwebtoken",
   agents: ["ciso", "security-engineer", "backend-architect"],
   moderator: "cto"
})

2. collaboration.proposal.publish({
   proposal: "Upgrade jsonwebtoken immediately",
   reasoning: "Critical auth bypass vulnerability"
})

Result: 🚨 CRITICAL ALERT message
```

### Scenario 3: High Quality Degradation

```
[Heartbeat Trigger]
→ Security check: ✅ 0 alerts
→ Gateway check: ✅ 320ms response
→ Recent changes: ✅ No issues
→ Quality check: ⚠️ 75 lint errors
→ Process check: ✅ All healthy

Actions:
1. sessions_spawn({
   task: "Fix 75 lint errors detected in quick scan",
   agentId: "quality-engineer",
   label: "Lint cleanup"
})

2. team_workspace.write_artifact({
   name: "health-issue-[timestamp].md",
   content: [detailed report]
})

Result: ⚠️ HIGH PRIORITY message
```

### Scenario 4: Multiple Medium Issues

```
[Heartbeat Trigger]
→ Security check: ✅ 0 critical/high
   ⚠️ 5 medium alerts
→ Gateway check: ✅ 450ms response
→ Recent changes: ⚠️ 3 TODO comments
→ Quality check: ⚠️ 8 lint warnings
→ Process check: ✅ All healthy

Actions:
1. team_workspace.write_artifact({
   name: "health-report-[timestamp].md",
   content: [consolidated report of all medium issues]
})

2. Schedule review for next deep scan

Result: 📝 3 medium issues logged (HEARTBEAT_OK)
```

---

## Monitoring the Monitor

### Self-Health Checks

- Verify heartbeat executes on schedule
- Track execution time (should be < 2 minutes for quick scans)
- Monitor false positive rate
- Ensure escalations are being handled

### Performance Metrics

- Heartbeat execution time: Target < 1 minute
- API call latency: security_stats < 500ms
- Memory footprint: < 100MB
- CPU usage: < 5% average

### Quality Metrics

- False positive rate: Target < 10%
- Detection accuracy: Target > 95%
- Response time: Critical < 5min, High < 1h

---

## Troubleshooting

### Heartbeat Not Firing

1. Check cron job is registered: `pnpm openclaw cron list`
2. Verify HEARTBEAT.md exists and is readable
3. Check session logs for errors
4. Restart gateway if needed

### Too Many Alerts

1. Review thresholds in config
2. Add known issues to whitelist
3. Adjust scan frequency
4. Enable batching for medium/low

### Missing Alerts

1. Verify all check categories are enabled
2. Review threshold settings (may be too lenient)
3. Check tool integrations are working
4. Validate security APIs are accessible

---

## Notes

- This heartbeat runs in **quick mode** to minimize overhead
- Deep scans run separately via cron (less frequent)
- Always prioritize security and infrastructure checks
- Batch low-priority issues to reduce noise
- Log everything to workspace for historical analysis

---

Last Updated: 2026-02-12
Config Version: 1.0
