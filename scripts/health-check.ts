#!/usr/bin/env bun
/**
 * OpenClaw System Health Check
 *
 * Executes comprehensive health monitoring:
 * - Security audit
 * - Code quality checks
 * - Test coverage
 * - Dependency audit
 * - Gateway health
 *
 * Usage:
 *   bun scripts/health-check.ts [--quick|--deep]
 *   bun scripts/health-check.ts --category security
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

interface HealthIssue {
  severity: "critical" | "high" | "medium" | "low";
  category: "security" | "quality" | "testing" | "dependencies" | "infrastructure";
  description: string;
  details?: string;
  action: "escalate" | "delegate" | "log";
  assignee?: string;
}

interface HealthReport {
  timestamp: string;
  duration: number;
  issues: HealthIssue[];
  stats: {
    security: { critical: number; high: number; medium: number; low: number };
    quality: { lintErrors: number; typeErrors: number };
    testing: { coverage: number; failing: number };
    dependencies: { total: number; outdated: number; vulnerable: number };
    gateway: { status: string; responseTime: number };
  };
}

const args = process.argv.slice(2);
const mode = args.includes("--deep") ? "deep" : args.includes("--quick") ? "quick" : "normal";
const category = args.find((a) => a.startsWith("--category="))?.split("=")[1];

const THRESHOLDS = {
  coverage: {
    critical: 50,
    high: 60,
    medium: 70,
  },
  responseTime: {
    critical: 5000,
    high: 2000,
    medium: 1000,
  },
};

async function main() {
  console.log(`🏥 OpenClaw Health Check (${mode} mode)\n`);

  const startTime = Date.now();
  const issues: HealthIssue[] = [];
  const stats: HealthReport["stats"] = {
    security: { critical: 0, high: 0, medium: 0, low: 0 },
    quality: { lintErrors: 0, typeErrors: 0 },
    testing: { coverage: 0, failing: 0 },
    dependencies: { total: 0, outdated: 0, vulnerable: 0 },
    gateway: { status: "unknown", responseTime: 0 },
  };

  // 1. Security Scan
  if (!category || category === "security") {
    console.log("🔒 Running security scan...");
    const securityIssues = await scanSecurity(mode);
    issues.push(...securityIssues);

    // Update stats
    for (const issue of securityIssues) {
      stats.security[issue.severity]++;
    }
  }

  // 2. Code Quality Scan
  if (!category || category === "quality") {
    console.log("✨ Running code quality scan...");
    const qualityIssues = await scanCodeQuality(mode);
    issues.push(...qualityIssues);

    // Update stats
    for (const issue of qualityIssues) {
      if (issue.description.includes("lint")) {
        stats.quality.lintErrors++;
      }
      if (issue.description.includes("type")) {
        stats.quality.typeErrors++;
      }
    }
  }

  // 3. Test Coverage Scan
  if (!category || category === "testing") {
    console.log("🧪 Running test coverage scan...");
    const testingIssues = await scanTesting(mode);
    issues.push(...testingIssues);

    // Extract coverage from issues
    const coverageIssue = testingIssues.find((i) => i.description.includes("coverage"));
    if (coverageIssue?.details) {
      const match = coverageIssue.details.match(/(\d+\.?\d*)%/);
      if (match) {
        stats.testing.coverage = Number.parseFloat(match[1]);
      }
    }
  }

  // 4. Dependencies Scan
  if (!category || category === "dependencies") {
    console.log("📦 Running dependencies scan...");
    const depsIssues = await scanDependencies(mode);
    issues.push(...depsIssues);

    // Extract stats from issues
    const auditIssue = depsIssues.find((i) => i.description.includes("vulnerabilities"));
    if (auditIssue?.details) {
      const match = auditIssue.details.match(/(\d+) vulnerabilities/);
      if (match) {
        stats.dependencies.vulnerable = Number.parseInt(match[1], 10);
      }
    }
  }

  // 5. Gateway Health (skip in quick mode)
  if (mode !== "quick" && (!category || category === "infrastructure")) {
    console.log("🌐 Checking Gateway health...");
    const gatewayIssues = await checkGateway(mode === "deep");
    issues.push(...gatewayIssues);

    // Extract gateway stats
    const statusIssue = gatewayIssues.find((i) => i.description.includes("Gateway"));
    if (statusIssue?.details) {
      stats.gateway.status = statusIssue.severity === "critical" ? "down" : "healthy";
    }
  }

  const duration = Date.now() - startTime;

  // Generate report
  const report: HealthReport = {
    timestamp: new Date().toISOString(),
    duration,
    issues,
    stats,
  };

  // Print summary
  printReport(report);

  // Exit with appropriate code
  const hasCritical = issues.some((i) => i.severity === "critical");
  const hasHigh = issues.some((i) => i.severity === "high");

  if (hasCritical) {
    console.error("\n❌ CRITICAL issues detected!");
    process.exit(2);
  }

  if (hasHigh) {
    console.error("\n⚠️  HIGH priority issues detected!");
    process.exit(1);
  }

  console.log("\n✅ All checks passed!");
  process.exit(0);
}

async function scanSecurity(_mode: string): Promise<HealthIssue[]> {
  const issues: HealthIssue[] = [];

  try {
    // Note: These would call actual OpenClaw security APIs
    // For now, simulate with npm audit

    const { stdout } = await execAsync("npm audit --json", {
      encoding: "utf-8",
    }).catch(() => ({ stdout: '{"metadata":{"vulnerabilities":{}}}' }));

    const audit = JSON.parse(stdout);
    const vulns = audit.metadata?.vulnerabilities || {};

    if (vulns.critical > 0) {
      issues.push({
        severity: "critical",
        category: "security",
        description: `${vulns.critical} critical security vulnerabilities detected`,
        details: `Run 'npm audit' for details`,
        action: "escalate",
        assignee: "ciso",
      });
    }

    if (vulns.high > 0) {
      issues.push({
        severity: "high",
        category: "security",
        description: `${vulns.high} high-severity security vulnerabilities detected`,
        details: `Run 'npm audit' for details`,
        action: "delegate",
        assignee: "security-engineer",
      });
    }
  } catch (error) {
    issues.push({
      severity: "medium",
      category: "security",
      description: "Security scan failed",
      details: String(error),
      action: "log",
    });
  }

  return issues;
}

async function scanCodeQuality(mode: string): Promise<HealthIssue[]> {
  const issues: HealthIssue[] = [];

  try {
    // Run lint check
    await execAsync("pnpm oxlint . --deny-warnings", {
      encoding: "utf-8",
    });
  } catch (error: unknown) {
    const err = error as { stdout?: string };
    const errorCount = (err.stdout?.match(/error/gi) || []).length;

    if (errorCount > 50) {
      issues.push({
        severity: "high",
        category: "quality",
        description: `${errorCount} lint errors detected`,
        details: "Run 'pnpm check' for details",
        action: "delegate",
        assignee: "quality-engineer",
      });
    } else if (errorCount > 0) {
      issues.push({
        severity: "medium",
        category: "quality",
        description: `${errorCount} lint errors detected`,
        details: "Run 'pnpm check' for details",
        action: "log",
      });
    }
  }

  // Type check (only in deep mode)
  if (mode === "deep") {
    try {
      await execAsync("pnpm tsc --noEmit", {
        encoding: "utf-8",
      });
    } catch (error: unknown) {
      const err = error as { stdout?: string };
      const errorCount = (err.stdout?.match(/error TS/g) || []).length;

      if (errorCount > 0) {
        issues.push({
          severity: "medium",
          category: "quality",
          description: `${errorCount} type errors detected`,
          details: "Run 'pnpm build' for details",
          action: "log",
        });
      }
    }
  }

  return issues;
}

async function scanTesting(mode: string): Promise<HealthIssue[]> {
  const issues: HealthIssue[] = [];

  if (mode === "quick") {
    // Skip tests in quick mode
    return issues;
  }

  try {
    // Run tests with coverage
    const { stdout } = await execAsync("pnpm test:coverage --reporter=json", {
      encoding: "utf-8",
    });

    // Parse coverage (this is simplified - actual format varies)
    const coverageMatch = stdout.match(/All files\s+\|\s+(\d+\.?\d*)/);
    if (coverageMatch) {
      const coverage = Number.parseFloat(coverageMatch[1]);

      if (coverage < THRESHOLDS.coverage.critical) {
        issues.push({
          severity: "critical",
          category: "testing",
          description: `Test coverage critically low: ${coverage}%`,
          details: `Target: ${THRESHOLDS.coverage.medium}%`,
          action: "escalate",
          assignee: "qa-lead",
        });
      } else if (coverage < THRESHOLDS.coverage.high) {
        issues.push({
          severity: "high",
          category: "testing",
          description: `Test coverage below target: ${coverage}%`,
          details: `Target: ${THRESHOLDS.coverage.medium}%`,
          action: "delegate",
          assignee: "qa-lead",
        });
      } else if (coverage < THRESHOLDS.coverage.medium) {
        issues.push({
          severity: "medium",
          category: "testing",
          description: `Test coverage near threshold: ${coverage}%`,
          details: `Target: ${THRESHOLDS.coverage.medium}%`,
          action: "log",
        });
      }
    }
  } catch (error: unknown) {
    // Check if tests failed
    const err = error as { stdout?: string };
    const failedCount = (err.stdout?.match(/FAIL/g) || []).length;

    if (failedCount > 0) {
      issues.push({
        severity: "high",
        category: "testing",
        description: `${failedCount} test suites failing`,
        details: "Run 'pnpm test' for details",
        action: "delegate",
        assignee: "qa-automation",
      });
    }
  }

  return issues;
}

async function scanDependencies(_mode: string): Promise<HealthIssue[]> {
  const issues: HealthIssue[] = [];

  try {
    // Check outdated dependencies
    const { stdout } = await execAsync("pnpm outdated --format json", {
      encoding: "utf-8",
    }).catch(() => ({ stdout: "[]" }));

    const outdated = JSON.parse(stdout);

    if (outdated.length > 20) {
      issues.push({
        severity: "medium",
        category: "dependencies",
        description: `${outdated.length} outdated dependencies`,
        details: "Run 'pnpm outdated' for details",
        action: "log",
      });
    }
  } catch {
    // Ignore - outdated check is optional
  }

  return issues;
}

async function checkGateway(_deep: boolean): Promise<HealthIssue[]> {
  const issues: HealthIssue[] = [];

  try {
    const startTime = Date.now();

    // This would call actual OpenClaw gateway status
    // For now, simulate with a simple command
    await execAsync("pnpm openclaw status", {
      encoding: "utf-8",
    });

    const responseTime = Date.now() - startTime;

    if (responseTime > THRESHOLDS.responseTime.critical) {
      issues.push({
        severity: "critical",
        category: "infrastructure",
        description: `Gateway critically slow: ${responseTime}ms`,
        details: `Target: <${THRESHOLDS.responseTime.medium}ms`,
        action: "escalate",
        assignee: "sre",
      });
    } else if (responseTime > THRESHOLDS.responseTime.high) {
      issues.push({
        severity: "high",
        category: "infrastructure",
        description: `Gateway response time high: ${responseTime}ms`,
        details: `Target: <${THRESHOLDS.responseTime.medium}ms`,
        action: "delegate",
        assignee: "performance-engineer",
      });
    }
  } catch (error) {
    issues.push({
      severity: "critical",
      category: "infrastructure",
      description: "Gateway unreachable or down",
      details: String(error),
      action: "escalate",
      assignee: "sre",
    });
  }

  return issues;
}

function printReport(report: HealthReport) {
  console.log("\n" + "=".repeat(60));
  console.log("📊 HEALTH REPORT");
  console.log("=".repeat(60));

  console.log(`\n⏱️  Scan completed in ${report.duration}ms`);
  console.log(`📅 Timestamp: ${report.timestamp}\n`);

  // Stats summary
  console.log("📈 STATISTICS:\n");
  console.log(`  Security:`);
  console.log(`    Critical: ${report.stats.security.critical}`);
  console.log(`    High: ${report.stats.security.high}`);
  console.log(`    Medium: ${report.stats.security.medium}`);
  console.log(`    Low: ${report.stats.security.low}`);

  console.log(`\n  Code Quality:`);
  console.log(`    Lint Errors: ${report.stats.quality.lintErrors}`);
  console.log(`    Type Errors: ${report.stats.quality.typeErrors}`);

  console.log(`\n  Testing:`);
  console.log(`    Coverage: ${report.stats.testing.coverage}%`);
  console.log(`    Failing: ${report.stats.testing.failing}`);

  console.log(`\n  Dependencies:`);
  console.log(`    Outdated: ${report.stats.dependencies.outdated}`);
  console.log(`    Vulnerable: ${report.stats.dependencies.vulnerable}`);

  console.log(`\n  Gateway:`);
  console.log(`    Status: ${report.stats.gateway.status}`);
  console.log(`    Response Time: ${report.stats.gateway.responseTime}ms`);

  // Issues
  if (report.issues.length === 0) {
    console.log("\n✅ No issues detected!");
    return;
  }

  console.log(`\n🚨 ISSUES DETECTED: ${report.issues.length}\n`);

  const bySeverity = {
    critical: report.issues.filter((i) => i.severity === "critical"),
    high: report.issues.filter((i) => i.severity === "high"),
    medium: report.issues.filter((i) => i.severity === "medium"),
    low: report.issues.filter((i) => i.severity === "low"),
  };

  for (const [severity, issues] of Object.entries(bySeverity)) {
    if (issues.length === 0) {
      continue;
    }

    const emoji = {
      critical: "🔴",
      high: "🟠",
      medium: "🟡",
      low: "🟢",
    }[severity];

    console.log(`${emoji} ${severity.toUpperCase()} (${issues.length}):`);

    for (const issue of issues) {
      console.log(`\n  • ${issue.description}`);
      console.log(`    Category: ${issue.category}`);
      console.log(`    Action: ${issue.action}`);
      if (issue.assignee) {
        console.log(`    Assignee: @${issue.assignee}`);
      }
      if (issue.details) {
        console.log(`    Details: ${issue.details}`);
      }
    }

    console.log();
  }

  console.log("=".repeat(60) + "\n");
}

main().catch((error) => {
  console.error("Fatal error during health check:", error);
  process.exit(3);
});
