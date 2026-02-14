import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = process.cwd();
const uxDir = path.resolve(repoRoot, "dispatch/ux");
const dispatcherSpecPath = path.resolve(uxDir, "dispatcher_cockpit_v0.md");
const techPacketSpecPath = path.resolve(uxDir, "technician_job_packet_v0.md");
const uxReadmePath = path.resolve(uxDir, "README.md");

function mustInclude(text, pattern, message) {
  assert.match(text, pattern, message);
}

test("story 10 UX artifacts exist and are non-empty", () => {
  for (const filePath of [dispatcherSpecPath, techPacketSpecPath, uxReadmePath]) {
    assert.ok(fs.existsSync(filePath), `missing UX artifact: ${filePath}`);
    const stat = fs.statSync(filePath);
    assert.ok(stat.size > 0, `UX artifact is empty: ${filePath}`);
  }
});

test("dispatcher cockpit spec includes SLA timers, assignment override, timeline, and wireframe", () => {
  const content = fs.readFileSync(dispatcherSpecPath, "utf8");

  mustInclude(content, /SLA Timer Rules/i, "dispatcher spec must define SLA timer behavior");
  mustInclude(content, /Assignment Override Flow/i, "dispatcher spec must define assignment override");
  mustInclude(content, /Timeline Panel/i, "dispatcher spec must define timeline view");
  mustInclude(content, /Wireframe \(ASCII\)/i, "dispatcher spec must include wireframe");

  mustInclude(content, /sla_timer_remaining/i, "queue fields must include sla timer column");
  mustInclude(content, /correlation_id/i, "timeline fields must include correlation id");
});

test("technician job packet spec includes required packet fields and closeout evidence gates", () => {
  const content = fs.readFileSync(techPacketSpecPath, "utf8");

  mustInclude(content, /Packet Structure/i, "tech packet spec must define packet structure");
  mustInclude(content, /Evidence Checklist Mapping/i, "tech packet spec must define evidence mapping");
  mustInclude(content, /Signature Requirement/i, "tech packet spec must define signature handling");
  mustInclude(content, /Closeout Gate Behavior/i, "tech packet spec must define closeout gate behavior");
  mustInclude(content, /Mobile Wireframe \(ASCII\)/i, "tech packet spec must include wireframe");

  mustInclude(content, /no_signature_reason/i, "tech packet must require no-signature reason path");
  mustInclude(content, /Complete Work/i, "tech packet must define completion action gating");
});
