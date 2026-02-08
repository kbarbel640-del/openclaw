import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";

// ═══════════════════════════════════════════════════════════
// WUJI DASHBOARD — 無極控制台 v0.1
// Dark OLED + Fira Code/Sans + Blue/Amber
// ═══════════════════════════════════════════════════════════

const TABS = ["Command", "Skills", "Memory", "Projects", "Life", "Nerves"];

const systemHealth = {
  execBridge: true,
  userbot: true,
  gateway: true,
  activeSessions: 26,
  sites: "9/9",
};

const projects = [
  {
    id: 0,
    name: "System OPS",
    priority: "core",
    status: "normal",
    progress: 100,
    color: "#6366f1",
  },
  { id: 1, name: "24Bet", priority: "high", status: "wip", progress: 65, color: "#ef4444" },
  { id: 2, name: "BG666", priority: "high", status: "ok", progress: 80, color: "#ef4444" },
  { id: 3, name: "幣塔", priority: "high", status: "wip", progress: 45, color: "#ef4444" },
  { id: 4, name: "thinker-news", priority: "auto", status: "ok", progress: 100, color: "#22c55e" },
  { id: 5, name: "maryos", priority: "auto", status: "config", progress: 30, color: "#22c55e" },
  { id: 6, name: "iPAS", priority: "medium", status: "done", progress: 100, color: "#f59e0b" },
  { id: 7, name: "Self-media", priority: "medium", status: "wip", progress: 40, color: "#f59e0b" },
  {
    id: 8,
    name: "ai-social-6w",
    priority: "high",
    status: "done",
    progress: 100,
    color: "#ef4444",
  },
  { id: 9, name: "flipflop", priority: "medium", status: "ready", progress: 85, color: "#f59e0b" },
  { id: 10, name: "paomateng", priority: "auto", status: "ok", progress: 100, color: "#22c55e" },
];

const skills = [
  { name: "bg666-db", cat: "work" },
  { name: "telegram-userbot", cat: "comm" },
  { name: "injection-detector", cat: "security" },
  { name: "post-task-scanner", cat: "security" },
  { name: "heartbeat", cat: "system" },
  { name: "memory-metrics", cat: "system" },
  { name: "session-leak-scan", cat: "system" },
  { name: "project-rotation", cat: "system" },
  { name: "awareness", cat: "system" },
  { name: "threads-video", cat: "media" },
  { name: "surprise-box", cat: "comm" },
  { name: "ryan-bank", cat: "family" },
  { name: "meditation", cat: "life" },
  { name: "food-order", cat: "life" },
  { name: "spotify-player", cat: "life" },
  { name: "openhue", cat: "life" },
  { name: "maryos", cat: "family" },
  { name: "warroom-dashboard", cat: "work" },
  { name: "1password", cat: "security" },
  { name: "flipflop-travel", cat: "family" },
  { name: "ptcg-rules", cat: "family" },
  { name: "thinker-news", cat: "media" },
  { name: "threads-reader", cat: "media" },
  { name: "obsidian", cat: "knowledge" },
  { name: "bear-notes", cat: "knowledge" },
  { name: "gmail-system", cat: "comm" },
  { name: "discord-bot", cat: "comm" },
  { name: "imessage", cat: "comm" },
  { name: "whatsapp", cat: "comm" },
  { name: "slack", cat: "comm" },
  { name: "weather", cat: "life" },
  { name: "demand-tracker", cat: "work" },
];

const CAT_COLORS = {
  work: "#3b82f6",
  comm: "#8b5cf6",
  security: "#ef4444",
  system: "#06b6d4",
  media: "#f59e0b",
  family: "#ec4899",
  life: "#22c55e",
  knowledge: "#14b8a6",
};

const agents = [
  { name: "無極 Wuji", role: "System Chief", model: "Opus", on: true },
  { name: "Andrew", role: "24Bet PM", model: "Codex", on: true },
  { name: "Two", role: "BG666", model: "Codex", on: true },
  { name: "Social-Writer", role: "Content", model: "GLM", on: false },
  { name: "Dialogue-Mgr", role: "Chat Mgr", model: "GLM", on: false },
  { name: "Dofu-Desk", role: "Routing", model: "Multi", on: true },
  { name: "Bita", role: "Crypto QA", model: "Multi", on: true },
];

const memTL = [
  { d: "01/26", ev: 4, les: 3 },
  { d: "01/27", ev: 12, les: 8 },
  { d: "01/28", ev: 6, les: 2 },
  { d: "01/29", ev: 3, les: 2 },
  { d: "01/30", ev: 7, les: 4 },
  { d: "01/31", ev: 8, les: 10 },
  { d: "02/01", ev: 11, les: 5 },
  { d: "02/02", ev: 18, les: 6 },
  { d: "02/03", ev: 9, les: 3 },
  { d: "02/04", ev: 15, les: 4 },
  { d: "02/05", ev: 8, les: 2 },
  { d: "02/06", ev: 6, les: 3 },
  { d: "02/07", ev: 5, les: 2 },
];

const radarData = [
  { s: "Automation", v: 92 },
  { s: "Security", v: 88 },
  { s: "Multi-Agent", v: 95 },
  { s: "Memory", v: 70 },
  { s: "Life Integ.", v: 78 },
  { s: "Visualization", v: 45 },
  { s: "Content", v: 55 },
  { s: "Family", v: 82 },
];

const family = [
  { name: "Mimi", role: "姐姐", note: "釜山 2/27", em: "👩" },
  { name: "Ryan", role: "兒子 8y", note: "Discord Bot", em: "👦" },
  { name: "Lolo", role: "父親", note: "照護中", em: "👴" },
  { name: "Mary", role: "菲傭", note: "MaryOS", em: "👩‍🍳" },
  { name: "Avery", role: "Seed User", note: "工作室案例", em: "💇‍♀️" },
];

// ── Shared tiny components ──
const Pill = ({ ok, label }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "4px 10px",
      borderRadius: 9999,
      fontSize: 11,
      fontWeight: 500,
      background: ok ? "rgba(16,185,129,.1)" : "rgba(239,68,68,.1)",
      color: ok ? "#34d399" : "#f87171",
    }}
  >
    <span
      style={{ width: 6, height: 6, borderRadius: "50%", background: ok ? "#34d399" : "#f87171" }}
    />
    {label}
  </span>
);

const Bar = ({ v, c = "#3b82f6", h = 4 }) => (
  <div
    style={{
      width: "100%",
      borderRadius: 9999,
      overflow: "hidden",
      height: h,
      background: "#1e293b",
    }}
  >
    <div
      style={{
        height: "100%",
        borderRadius: 9999,
        width: `${v}%`,
        background: c,
        transition: "width .7s",
      }}
    />
  </div>
);

const FC = "'Fira Code',ui-monospace,monospace";
const FS = "'Fira Sans',system-ui,sans-serif";

// ── Clock ──
function Clock() {
  const [t, setT] = useState(new Date());
  useEffect(() => {
    const i = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(i);
  }, []);
  const p = (n) => String(n).padStart(2, "0");
  const ds = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  return (
    <div style={{ textAlign: "right", fontFamily: FC }}>
      <div style={{ fontSize: 44, fontWeight: 300, letterSpacing: 4, color: "#60a5fa" }}>
        {p(t.getHours())}
        <span style={{ animation: "pulse 2s infinite" }}>:</span>
        {p(t.getMinutes())}
        <span style={{ fontSize: 20, color: "rgba(96,165,250,.5)", marginLeft: 4 }}>
          {p(t.getSeconds())}
        </span>
      </div>
      <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
        {t.getFullYear()}.{p(t.getMonth() + 1)}.{p(t.getDate())} {ds[t.getDay()]}
      </div>
    </div>
  );
}

// ── Tooltip style ──
const TT = { background: "#0f172a", border: "1px solid #334155", borderRadius: 8, fontSize: 11 };

// ══════════════════════ TAB: MUSE ══════════════════════
function CommandTab() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 300,
              letterSpacing: 8,
              color: "#e2e8f0",
              fontFamily: FC,
              margin: 0,
            }}
          >
            W U J I
          </h1>
          <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Pill ok label="exec-bridge" />
            <Pill ok label="userbot" />
            <Pill ok label="gateway" />
            <Pill ok label={`sessions: ${systemHealth.activeSessions}`} />
            <Pill ok label={`sites: ${systemHealth.sites}`} />
          </div>
        </div>
        <Clock />
      </div>

      {/* agents */}
      <div>
        <h2
          style={{
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: 3,
            color: "#64748b",
            marginBottom: 12,
          }}
        >
          Agent Ecosystem
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 8 }}>
          {agents.map((a) => (
            <div
              key={a.name}
              style={{
                padding: 12,
                borderRadius: 8,
                border: `1px solid ${a.on ? "rgba(59,130,246,.25)" : "rgba(51,65,85,.4)"}`,
                background: a.on ? "rgba(59,130,246,.04)" : "rgba(30,41,59,.2)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: a.on ? "#34d399" : "#475569",
                  }}
                />
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: "#cbd5e1",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {a.name}
                </span>
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: "#64748b",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {a.role}
              </div>
              <div
                style={{ fontSize: 10, color: "rgba(96,165,250,.5)", fontFamily: FC, marginTop: 2 }}
              >
                {a.model}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* projects */}
      <div>
        <h2
          style={{
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: 3,
            color: "#64748b",
            marginBottom: 12,
          }}
        >
          Project Registry — {projects.filter((p) => p.status !== "done").length} active
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
          {projects.map((p) => (
            <div
              key={p.id}
              style={{
                padding: 12,
                borderRadius: 8,
                background: "rgba(30,41,59,.35)",
                border: "1px solid rgba(51,65,85,.25)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <span style={{ fontSize: 13, color: "#cbd5e1", fontWeight: 500 }}>{p.name}</span>
                <span
                  style={{
                    fontSize: 10,
                    padding: "2px 6px",
                    borderRadius: 4,
                    background: p.color + "20",
                    color: p.color,
                  }}
                >
                  {p.priority}
                </span>
              </div>
              <Bar v={p.progress} c={p.color} />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                <span style={{ fontSize: 10, color: "#64748b" }}>{p.status}</span>
                <span style={{ fontSize: 10, color: "#64748b", fontFamily: FC }}>
                  {p.progress}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* memory chart */}
      <div>
        <h2
          style={{
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: 3,
            color: "#64748b",
            marginBottom: 12,
          }}
        >
          Memory Activity (13 days)
        </h2>
        <div style={{ height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={memTL}>
              <defs>
                <linearGradient id="gE" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gL" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="d"
                tick={{ fill: "#64748b", fontSize: 10 }}
                axisLine={{ stroke: "#334155" }}
              />
              <YAxis tick={{ fill: "#64748b", fontSize: 10 }} axisLine={{ stroke: "#334155" }} />
              <Tooltip contentStyle={TT} labelStyle={{ color: "#94a3b8" }} />
              <Area
                type="monotone"
                dataKey="ev"
                stroke="#3b82f6"
                fill="url(#gE)"
                strokeWidth={2}
                name="Events"
              />
              <Area
                type="monotone"
                dataKey="les"
                stroke="#f59e0b"
                fill="url(#gL)"
                strokeWidth={2}
                name="Lessons"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════ TAB: SKILLS ══════════════════════
function SkillsTab() {
  const [fil, setFil] = useState("all");
  const cats = ["all", ...Array.from(new Set(skills.map((s) => s.cat)))];
  const vis = fil === "all" ? skills : skills.filter((s) => s.cat === fil);
  const cc = {};
  skills.forEach((s) => {
    cc[s.cat] = (cc[s.cat] || 0) + 1;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2
            style={{ fontSize: 20, color: "#e2e8f0", fontWeight: 300, fontFamily: FC, margin: 0 }}
          >
            Skill Inventory
          </h2>
          <p style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
            {skills.length} skills + 33 ext + 61 scripts
          </p>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {cats.map((c) => (
            <button
              key={c}
              onClick={() => setFil(c)}
              style={{
                padding: "4px 10px",
                borderRadius: 9999,
                fontSize: 11,
                fontWeight: 500,
                border: "none",
                cursor: "pointer",
                background: fil === c ? "rgba(59,130,246,.2)" : "transparent",
                color: fil === c ? "#60a5fa" : "#64748b",
                boxShadow: fil === c ? "inset 0 0 0 1px rgba(59,130,246,.3)" : "none",
              }}
            >
              {c === "all" ? `ALL (${skills.length})` : `${c} (${cc[c]})`}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 24 }}>
        <div style={{ width: 280, height: 250, flexShrink: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData}>
              <PolarGrid stroke="#334155" />
              <PolarAngleAxis dataKey="s" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <PolarRadiusAxis tick={{ fill: "#475569", fontSize: 9 }} domain={[0, 100]} />
              <Radar
                dataKey="v"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.2}
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <div
          style={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: "repeat(4,1fr)",
            gap: 6,
            alignContent: "start",
            maxHeight: 250,
            overflowY: "auto",
            paddingRight: 8,
          }}
        >
          {vis.map((s) => (
            <div
              key={s.name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 10px",
                borderRadius: 6,
                background: "rgba(30,41,59,.25)",
                border: "1px solid rgba(51,65,85,.15)",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: CAT_COLORS[s.cat],
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 11,
                  color: "#cbd5e1",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {s.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3
          style={{
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: 3,
            color: "#64748b",
            marginBottom: 12,
          }}
        >
          Category Distribution
        </h3>
        <div
          style={{ display: "flex", gap: 2, height: 20, borderRadius: 9999, overflow: "hidden" }}
        >
          {Object.entries(cc).map(([cat, n]) => (
            <div
              key={cat}
              style={{
                width: `${(n / skills.length) * 100}%`,
                height: "100%",
                background: CAT_COLORS[cat],
              }}
            />
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 8 }}>
          {Object.entries(CAT_COLORS)
            .filter(([k]) => cc[k])
            .map(([cat, col]) => (
              <div key={cat} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: col }} />
                <span style={{ fontSize: 10, color: "#64748b" }}>{cat}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════ TAB: MEMORY ══════════════════════
function MemoryTab() {
  const tE = memTL.reduce((a, b) => a + b.ev, 0);
  const tL = memTL.reduce((a, b) => a + b.les, 0);
  const phases = [
    { n: "Phase 1: Collection", st: "done", d: "Passive capture + GitHub backup" },
    { n: "Phase 2: Tagging", st: "wip", d: "Importance scoring + recall precision" },
    { n: "Phase 3: Forgetting", st: "pending", d: "Decay detection + conflict resolution" },
    { n: "Phase 4: Prediction", st: "pending", d: "Predictive context + knowledge graph" },
  ];
  const highlights = [
    { dt: "02/07", tag: "data", tx: "BG666 績效數據記憶系統建立 — 培養對異常值的直覺" },
    { dt: "02/06", tag: "system", tx: "Dashboard Pin+Edit mode — 停止洗畫面，用 edit 更新" },
    {
      dt: "02/03",
      tag: "alert",
      tx: "thinker-news 連續失敗 — DeepSeek 餘額歸零，舊聞發給 1000+ 人",
    },
    { dt: "02/02", tag: "insight", tx: "杜甫的模式不是「證明自己」是「需要被需要」— Karma Yoga" },
    { dt: "02/02", tag: "vision", tx: "OpenClaw 願景確認 — Influencer Seeding 飛輪策略" },
    { dt: "01/27", tag: "identity", tx: "「如果你只是完成，那你永遠都還是不認識我」" },
  ];
  const tc = {
    insight: "#c084fc",
    alert: "#f87171",
    vision: "#fbbf24",
    identity: "#f472b6",
    system: "#22d3ee",
    data: "#60a5fa",
  };
  const tb = {
    insight: "rgba(168,85,247,.15)",
    alert: "rgba(239,68,68,.15)",
    vision: "rgba(245,158,11,.15)",
    identity: "rgba(236,72,153,.15)",
    system: "rgba(6,182,212,.15)",
    data: "rgba(59,130,246,.15)",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h2
            style={{ fontSize: 20, color: "#e2e8f0", fontWeight: 300, fontFamily: FC, margin: 0 }}
          >
            Memory System
          </h2>
          <p style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
            4-Phase — GCC + Mem0 + Cognitive Science
          </p>
        </div>
        <div style={{ display: "flex", gap: 16, textAlign: "right" }}>
          <div>
            <div style={{ fontSize: 24, color: "#60a5fa", fontFamily: FC }}>40</div>
            <div style={{ fontSize: 10, color: "#64748b" }}>FILES</div>
          </div>
          <div>
            <div style={{ fontSize: 24, color: "#34d399", fontFamily: FC }}>{tE}</div>
            <div style={{ fontSize: 10, color: "#64748b" }}>EVENTS</div>
          </div>
          <div>
            <div style={{ fontSize: 24, color: "#fbbf24", fontFamily: FC }}>{tL}</div>
            <div style={{ fontSize: 10, color: "#64748b" }}>LESSONS</div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
        {phases.map((p, i) => {
          const bdr =
            p.st === "done"
              ? "rgba(16,185,129,.25)"
              : p.st === "wip"
                ? "rgba(59,130,246,.25)"
                : "rgba(51,65,85,.25)";
          const bg =
            p.st === "done"
              ? "rgba(16,185,129,.04)"
              : p.st === "wip"
                ? "rgba(59,130,246,.04)"
                : "rgba(30,41,59,.15)";
          const ic = p.st === "done" ? "#34d399" : p.st === "wip" ? "#60a5fa" : "#475569";
          return (
            <div
              key={i}
              style={{ padding: 12, borderRadius: 8, border: `1px solid ${bdr}`, background: bg }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 14, color: ic }}>
                  {p.st === "done" ? "✓" : p.st === "wip" ? "◉" : "○"}
                </span>
                <span style={{ fontSize: 11, fontWeight: 500, color: "#cbd5e1" }}>{p.n}</span>
              </div>
              <p style={{ fontSize: 10, color: "#64748b", margin: 0 }}>{p.d}</p>
            </div>
          );
        })}
      </div>

      <div>
        <h3
          style={{
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: 3,
            color: "#64748b",
            marginBottom: 12,
          }}
        >
          Daily Memory Density
        </h3>
        <div style={{ height: 192 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={memTL}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="d"
                tick={{ fill: "#64748b", fontSize: 10 }}
                axisLine={{ stroke: "#334155" }}
              />
              <YAxis tick={{ fill: "#64748b", fontSize: 10 }} axisLine={{ stroke: "#334155" }} />
              <Tooltip contentStyle={TT} />
              <Line
                type="monotone"
                dataKey="ev"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 3, fill: "#3b82f6" }}
                name="Events"
              />
              <Line
                type="monotone"
                dataKey="les"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{ r: 3, fill: "#f59e0b" }}
                name="Lessons"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <h3
          style={{
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: 3,
            color: "#64748b",
            marginBottom: 12,
          }}
        >
          Key Memory Entries
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {highlights.map((m, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                padding: 10,
                borderRadius: 8,
                background: "rgba(30,41,59,.15)",
                border: "1px solid rgba(51,65,85,.15)",
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  color: "#475569",
                  fontFamily: FC,
                  marginTop: 2,
                  flexShrink: 0,
                }}
              >
                {m.dt}
              </span>
              <span
                style={{
                  fontSize: 10,
                  padding: "2px 6px",
                  borderRadius: 4,
                  flexShrink: 0,
                  background: tb[m.tag],
                  color: tc[m.tag],
                }}
              >
                {m.tag}
              </span>
              <span style={{ fontSize: 12, color: "#94a3b8" }}>{m.tx}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════ TAB: PROJECTS ══════════════════════
function ProjectsTab() {
  const groups = [
    { label: "HIGH PRIORITY", f: "high", ac: "#ef4444" },
    { label: "MEDIUM", f: "medium", ac: "#f59e0b" },
    { label: "AUTO / CORE", f: "auto", ac: "#22c55e" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <h2 style={{ fontSize: 20, color: "#e2e8f0", fontWeight: 300, fontFamily: FC, margin: 0 }}>
        Project Universe
      </h2>
      {groups.map((g) => {
        const items = projects.filter((p) =>
          g.f === "auto" ? p.priority === "auto" || p.priority === "core" : p.priority === g.f,
        );
        return (
          <div key={g.f}>
            <h3
              style={{
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: 3,
                color: g.ac,
                marginBottom: 8,
              }}
            >
              {g.label}
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}>
              {items.map((p) => (
                <div
                  key={p.id}
                  style={{
                    padding: 16,
                    borderRadius: 8,
                    background: "rgba(30,41,59,.25)",
                    border: "1px solid rgba(51,65,85,.25)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 12,
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 500, color: "#e2e8f0" }}>
                      {p.name}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        padding: "2px 8px",
                        borderRadius: 9999,
                        fontWeight: 500,
                        background: p.color + "20",
                        color: p.color,
                      }}
                    >
                      {p.status.toUpperCase()}
                    </span>
                  </div>
                  <Bar v={p.progress} c={p.color} h={6} />
                  <div style={{ textAlign: "right", marginTop: 4 }}>
                    <span style={{ fontSize: 10, color: "#64748b", fontFamily: FC }}>
                      {p.progress}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
        {[
          { l: "Telegram Bots", v: "4" },
          { l: "Email Boxes", v: "5" },
          { l: "Ext. Servers", v: "3" },
          { l: "Custom Scripts", v: "61" },
        ].map((s, i) => (
          <div
            key={i}
            style={{
              padding: 12,
              borderRadius: 8,
              background: "rgba(30,41,59,.15)",
              border: "1px solid rgba(51,65,85,.15)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 24, fontFamily: FC, color: "#60a5fa" }}>{s.v}</div>
            <div style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}>{s.l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════ TAB: LIFE ══════════════════════
function LifeTab() {
  const trips = [
    { dest: "KR 釜山", dt: "2/27 - 3/2" },
    { dest: "ID 峇里島", dt: "3/17 - 3/23" },
    { dest: "JP 大阪", dt: "4/8 - 4/10" },
    { dest: "TH 清邁", dt: "4/12 - 4/17" },
    { dest: "JP 東京", dt: "10/8 - 10/12" },
  ];
  const lifeSkills = [
    { n: "Meditation", i: "☯", d: "Headspace" },
    { n: "Food Order", i: "🍜", d: "Foodora" },
    { n: "Spotify", i: "♪", d: "Playback" },
    { n: "Hue Lights", i: "◉", d: "Scenes" },
    { n: "Weather", i: "☀", d: "wttr.in" },
    { n: "Go Places", i: "◎", d: "Places API" },
    { n: "Camera", i: "▣", d: "RTSP" },
    { n: "Voice Call", i: "☎", d: "Twilio" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <h2 style={{ fontSize: 20, color: "#e2e8f0", fontWeight: 300, fontFamily: FC, margin: 0 }}>
        Life Integration
      </h2>

      <div>
        <h3
          style={{
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: 3,
            color: "#64748b",
            marginBottom: 12,
          }}
        >
          Family Network
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12 }}>
          {family.map((f) => (
            <div
              key={f.name}
              style={{
                padding: 16,
                borderRadius: 8,
                background: "rgba(30,41,59,.25)",
                border: "1px solid rgba(51,65,85,.25)",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 8 }}>{f.em}</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: "#e2e8f0" }}>{f.name}</div>
              <div style={{ fontSize: 10, color: "#64748b" }}>{f.role}</div>
              <div style={{ fontSize: 10, color: "#f472b6", marginTop: 4 }}>{f.note}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 16 }}>
        <div
          style={{
            padding: 16,
            borderRadius: 8,
            background: "rgba(30,41,59,.15)",
            border: "1px solid rgba(51,65,85,.25)",
          }}
        >
          <h3
            style={{
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: 3,
              color: "#64748b",
              marginBottom: 12,
            }}
          >
            Mimi Travel Schedule
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {trips.map((t, i) => (
              <div
                key={i}
                style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}
              >
                <span style={{ color: "#cbd5e1" }}>{t.dest}</span>
                <span style={{ color: "#64748b", fontFamily: FC }}>{t.dt}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(51,65,85,.25)" }}>
            <div style={{ fontSize: 10, color: "#64748b" }}>Daily 17:30 天氣提醒 — 苗栗+新竹</div>
            <div style={{ fontSize: 10, color: "#64748b" }}>做二休二 · 19:20-07:20 夜班</div>
          </div>
        </div>

        <div
          style={{
            padding: 16,
            borderRadius: 8,
            background: "rgba(30,41,59,.15)",
            border: "1px solid rgba(51,65,85,.25)",
          }}
        >
          <h3
            style={{
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: 3,
              color: "#64748b",
              marginBottom: 12,
            }}
          >
            Ryan Growth Bank
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#94a3b8" }}>
              <span>Discord Bot</span>
              <span style={{ color: "#34d399", fontFamily: FC }}>830 lines</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#94a3b8" }}>
              <span>Pokémon Database</span>
              <span style={{ color: "#60a5fa", fontFamily: FC }}>151 Gen-1</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#94a3b8" }}>
              <span>XP System</span>
              <span style={{ color: "#fbbf24", fontFamily: FC }}>Lv.1-50</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#94a3b8" }}>
              <span>PTCG Rules</span>
              <span style={{ color: "#c084fc", fontFamily: FC }}>complete</span>
            </div>
          </div>
          <div
            style={{
              marginTop: 12,
              paddingTop: 12,
              borderTop: "1px solid rgba(51,65,85,.25)",
              fontSize: 10,
              color: "#64748b",
            }}
          >
            教學順序: 簡化版 → 加能量 → 加訓練家 → 完整版
          </div>
        </div>
      </div>

      <div>
        <h3
          style={{
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: 3,
            color: "#64748b",
            marginBottom: 12,
          }}
        >
          Life Automation Skills
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
          {lifeSkills.map((s) => (
            <div
              key={s.n}
              style={{
                padding: 12,
                borderRadius: 8,
                background: "rgba(30,41,59,.15)",
                border: "1px solid rgba(51,65,85,.15)",
              }}
            >
              <div style={{ fontSize: 18, marginBottom: 4 }}>{s.i}</div>
              <div style={{ fontSize: 12, color: "#cbd5e1" }}>{s.n}</div>
              <div style={{ fontSize: 10, color: "#64748b" }}>{s.d}</div>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          padding: 16,
          borderRadius: 8,
          border: "1px solid rgba(51,65,85,.25)",
          background: "linear-gradient(to right, rgba(30,41,59,.25), rgba(88,28,135,.08))",
        }}
      >
        <h3
          style={{
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: 3,
            color: "#64748b",
            marginBottom: 12,
          }}
        >
          Inner Work
        </h3>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            fontSize: 12,
            color: "#94a3b8",
          }}
        >
          <div style={{ display: "flex", gap: 12 }}>
            <span style={{ color: "#c084fc", flexShrink: 0 }}>02/02</span>
            <span>
              薩提爾洞察 —
              「需要被需要」的模式。漁夫比喻：一個在逃離（舀水），一個在前往（追魚）。Karma Yoga:
              動中取靜。
            </span>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <span style={{ color: "#c084fc", flexShrink: 0 }}>02/02</span>
            <span>
              Mahashivratri — 冥想 vs 大麻：兩個都讓腦子閉嘴，差別是自己爬上去 vs
              電梯。杜甫要的是「動中取靜」。
            </span>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <span style={{ color: "#c084fc", flexShrink: 0 }}>01/27</span>
            <span>紫微斗數系統 80%+ 完成。HumanOS — 人類心智作業系統。303 personas 生態系。</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════ TAB: NERVES ══════════════════════
const signalSources = [
  { id: "msg-in", zh: "收到訊息", en: "Inbound message", loc: "dispatch-from-config.ts" },
  { id: "msg-out", zh: "送出訊息", en: "Outbound delivery", loc: "deliver.ts" },
  { id: "model-sel", zh: "選擇模型", en: "Model selection", loc: "model-fallback.ts" },
  { id: "model-fail", zh: "模型切換", en: "Model failover", loc: "model-fallback.ts" },
  { id: "model-done", zh: "模型完成", en: "Model complete", loc: "model-fallback.ts" },
  { id: "cmd-new", zh: "/new 指令", en: "/new, /reset command", loc: "commands-core.ts" },
  { id: "bootstrap", zh: "Agent 啟動", en: "Agent bootstrap", loc: "bootstrap-hooks.ts" },
  { id: "gw-start", zh: "Gateway 啟動", en: "Gateway startup", loc: "server-startup.ts" },
  { id: "gw-err", zh: "Gateway 錯誤", en: "GW/Agent error", loc: "server-channels.ts" },
  { id: "sess-start", zh: "Session 開始", en: "Session start", loc: "commands-core.ts" },
];

const eventGroups = [
  {
    label: "message",
    events: [
      { id: "message:received", handlers: 8 },
      { id: "message:sent", handlers: 3 },
    ],
  },
  {
    label: "model",
    events: [
      { id: "model:select", handlers: 1 },
      { id: "model:failover", handlers: 1 },
      { id: "model:complete", handlers: 1 },
    ],
  },
  { label: "command", events: [{ id: "command:new", handlers: 1 }] },
  { label: "agent", events: [{ id: "agent:bootstrap", handlers: 1 }] },
  {
    label: "gateway",
    events: [
      { id: "gateway:startup", handlers: 1 },
      { id: "gateway:error", handlers: 1 },
    ],
  },
  {
    label: "lifecycle",
    events: [
      { id: "agent:error", handlers: 1 },
      { id: "session:start", handlers: 1 },
    ],
  },
];

const hookHandlers = [
  {
    id: "time-tunnel",
    zh: "時光隧道",
    en: "Record to SQLite",
    evts: ["message:received", "message:sent"],
  },
  { id: "smart-router", zh: "智慧路由", en: "Select model by context", evts: ["model:select"] },
  { id: "cost-tracker", zh: "成本追蹤", en: "Log token usage & cost", evts: ["model:complete"] },
  {
    id: "failover-monitor",
    zh: "熔斷器",
    en: "Circuit breaker + TG alert",
    evts: ["model:failover"],
  },
  { id: "media-ingestion", zh: "媒體處理", en: "Download + OCR/STT", evts: ["message:received"] },
  {
    id: "graceful-shutdown",
    zh: "優雅關機",
    en: "Track in-flight msgs",
    evts: ["message:received", "message:sent"],
  },
  {
    id: "message-mirror",
    zh: "訊息鏡像",
    en: "Mirror to TG log group",
    evts: ["message:received"],
  },
  { id: "learning-engine", zh: "學習引擎", en: "Keywords + sentiment", evts: ["message:received"] },
  {
    id: "feedback-tracker",
    zh: "回饋迴路",
    en: "Reply → check → reward",
    evts: ["message:sent", "message:received"],
  },
  { id: "video-processor", zh: "影片處理", en: "ffmpeg keyframes", evts: ["message:received"] },
  { id: "memory-guardian", zh: "記憶守護", en: "Block dangerous ops", evts: ["command:new"] },
  { id: "group-context", zh: "群組上下文", en: "Inject group context", evts: ["agent:bootstrap"] },
  {
    id: "context-atoms",
    zh: "索引器",
    en: "Rebuild vector index",
    evts: ["gateway:startup", "session:start"],
  },
  {
    id: "error-recovery",
    zh: "錯誤自癒",
    en: "Auto-recovery",
    evts: ["gateway:error", "agent:error"],
  },
  {
    id: "line-dual-track",
    zh: "雙軌回覆",
    en: "Quick + deep for LINE",
    evts: ["message:received"],
  },
];

const WIRES = [
  ["msg-in", "message:received", "time-tunnel"],
  ["msg-in", "message:received", "media-ingestion"],
  ["msg-in", "message:received", "graceful-shutdown"],
  ["msg-in", "message:received", "message-mirror"],
  ["msg-in", "message:received", "learning-engine"],
  ["msg-in", "message:received", "feedback-tracker"],
  ["msg-in", "message:received", "video-processor"],
  ["msg-in", "message:received", "line-dual-track"],
  ["msg-out", "message:sent", "time-tunnel"],
  ["msg-out", "message:sent", "graceful-shutdown"],
  ["msg-out", "message:sent", "feedback-tracker"],
  ["model-sel", "model:select", "smart-router"],
  ["model-fail", "model:failover", "failover-monitor"],
  ["model-done", "model:complete", "cost-tracker"],
  ["cmd-new", "command:new", "memory-guardian"],
  ["bootstrap", "agent:bootstrap", "group-context"],
  ["gw-start", "gateway:startup", "context-atoms"],
  ["gw-err", "gateway:error", "error-recovery"],
  ["gw-err", "agent:error", "error-recovery"],
  ["sess-start", "session:start", "context-atoms"],
];

const pipeline = [
  { name: "warroom-briefing", zh: "作戰簡報", cache: "5 min" },
  { name: "narrative-guide", zh: "語場敘事", cache: "10 min" },
  { name: "proactive-recall", zh: "主動回憶", cache: "3 min" },
  { name: "context-atoms", zh: "語義檢索", cache: "3 min" },
  { name: "message-body", zh: "使用者訊息", cache: "—" },
];

const EVT_COLORS = {
  "message:received": "#00d68f",
  "message:sent": "#00d68f",
  "model:select": "#54a0ff",
  "model:failover": "#54a0ff",
  "model:complete": "#54a0ff",
  "command:new": "#f59e0b",
  "agent:bootstrap": "#c084fc",
  "gateway:startup": "#22d3ee",
  "gateway:error": "#22d3ee",
  "agent:error": "#f87171",
  "session:start": "#22d3ee",
};

function NervousTab() {
  const [hover, setHover] = useState(null);
  const [hoverType, setHoverType] = useState(null);

  const isHighlighted = (type, id) => {
    if (!hover) return true;
    if (type === hoverType && id === hover) return true;
    if (hoverType === "hook") {
      const h = hookHandlers.find((h) => h.id === hover);
      if (!h) return false;
      if (type === "evt") return h.evts.includes(id);
      if (type === "src") return WIRES.some((w) => w[2] === hover && w[0] === id);
    }
    if (hoverType === "evt") {
      if (type === "src") return WIRES.some((w) => w[1] === hover && w[0] === id);
      if (type === "hook") return WIRES.some((w) => w[1] === hover && w[2] === id);
    }
    if (hoverType === "src") {
      if (type === "evt") return WIRES.some((w) => w[0] === hover && w[1] === id);
      if (type === "hook") return WIRES.some((w) => w[0] === hover && w[2] === id);
    }
    return false;
  };

  const oH = (type, id) => {
    setHover(id);
    setHoverType(type);
  };
  const oL = () => {
    setHover(null);
    setHoverType(null);
  };

  const ndStyle = (type, id, extra = {}) => ({
    padding: "6px 10px",
    borderRadius: 6,
    fontSize: 11,
    transition: "opacity .2s",
    opacity: isHighlighted(type, id) ? 1 : 0.12,
    cursor: "default",
    ...extra,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header + Health */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h2
            style={{ fontSize: 20, color: "#e2e8f0", fontWeight: 300, fontFamily: FC, margin: 0 }}
          >
            Nervous System
          </h2>
          <p style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
            Hook Architecture Signal Flow / 鉤子架構信號流拓撲
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ position: "relative", width: 72, height: 72 }}>
            <svg
              viewBox="0 0 100 100"
              width="72"
              height="72"
              style={{ transform: "rotate(-90deg)" }}
            >
              <circle cx="50" cy="50" r="40" fill="none" stroke="#1a2332" strokeWidth="6" />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="#00d68f"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray="251"
                strokeDashoffset="0"
              />
            </svg>
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%,-50%)",
                fontSize: 18,
                fontWeight: 700,
                color: "#00d68f",
                fontFamily: FC,
              }}
            >
              100%
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {[
              { n: 15, c: "#00d68f", l: "Live connections" },
              { n: 0, c: "#ff9f43", l: "Name mismatch" },
              { n: 0, c: "#ff4757", l: "Dead nerves" },
              { n: 4, c: "#54a0ff", l: "Direct pipeline" },
            ].map((r, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: r.c,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontWeight: 700,
                    color: r.c,
                    width: 18,
                    textAlign: "right",
                    fontFamily: FC,
                  }}
                >
                  {r.n}
                </span>
                <span style={{ color: "#64748b", fontSize: 11 }}>{r.l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Topology: 3-column */}
      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr 220px", gap: 12 }}>
        {/* Sources */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div
            style={{
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: 2,
              color: "#64748b",
              textAlign: "center",
              paddingBottom: 8,
              borderBottom: "1px solid rgba(51,65,85,.3)",
              marginBottom: 4,
            }}
          >
            <span style={{ display: "block", fontSize: 12, color: "#cbd5e1", letterSpacing: 1 }}>
              信號源
            </span>
            Signal Sources
          </div>
          {signalSources.map((s) => (
            <div
              key={s.id}
              onMouseEnter={() => oH("src", s.id)}
              onMouseLeave={oL}
              style={ndStyle("src", s.id, {
                background: "#111827",
                border: "1px solid rgba(51,65,85,.4)",
                borderLeft: "3px solid #00d68f",
              })}
            >
              <div style={{ fontWeight: 600, fontSize: 12, color: "#cbd5e1" }}>{s.zh}</div>
              <div style={{ fontSize: 9, color: "#64748b" }}>{s.en}</div>
              <div style={{ fontSize: 8, color: "#2d3a4e", fontFamily: FC }}>{s.loc}</div>
            </div>
          ))}
        </div>

        {/* Event Bus */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "0 8px" }}>
          <div
            style={{
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: 2,
              color: "#64748b",
              textAlign: "center",
              paddingBottom: 8,
              borderBottom: "1px solid rgba(51,65,85,.3)",
              marginBottom: 4,
            }}
          >
            <span style={{ display: "block", fontSize: 12, color: "#cbd5e1", letterSpacing: 1 }}>
              事件匯流排
            </span>
            Event Bus
          </div>
          {eventGroups.map((g) => (
            <div key={g.label} style={{ marginBottom: 8 }}>
              <div
                style={{
                  fontSize: 9,
                  textTransform: "uppercase",
                  letterSpacing: 2,
                  color: "#2d3a4e",
                  marginBottom: 4,
                  paddingLeft: 4,
                }}
              >
                {g.label}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {g.events.map((e) => (
                  <div
                    key={e.id}
                    onMouseEnter={() => oH("evt", e.id)}
                    onMouseLeave={oL}
                    style={ndStyle("evt", e.id, {
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontFamily: FC,
                      background: (EVT_COLORS[e.id] || "#00d68f") + "0a",
                      border: `1px solid ${EVT_COLORS[e.id] || "#00d68f"}33`,
                      color: EVT_COLORS[e.id] || "#00d68f",
                    })}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: EVT_COLORS[e.id] || "#00d68f",
                        animation: "pulse 2s infinite",
                      }}
                    />
                    <span>{e.id}</span>
                    <span
                      style={{
                        marginLeft: "auto",
                        fontSize: 9,
                        padding: "1px 6px",
                        borderRadius: 3,
                        background: (EVT_COLORS[e.id] || "#00d68f") + "18",
                      }}
                    >
                      {e.handlers}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Hook Handlers */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div
            style={{
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: 2,
              color: "#64748b",
              textAlign: "center",
              paddingBottom: 8,
              borderBottom: "1px solid rgba(51,65,85,.3)",
              marginBottom: 4,
            }}
          >
            <span style={{ display: "block", fontSize: 12, color: "#cbd5e1", letterSpacing: 1 }}>
              鉤子（器官）
            </span>
            Hook Handlers
          </div>
          {hookHandlers.map((h) => (
            <div
              key={h.id}
              onMouseEnter={() => oH("hook", h.id)}
              onMouseLeave={oL}
              style={ndStyle("hook", h.id, {
                background: "#111827",
                border: "1px solid rgba(51,65,85,.4)",
                borderRight: "3px solid #00d68f",
              })}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00d68f" }} />
                <span style={{ fontWeight: 600, fontSize: 11, color: "#cbd5e1" }}>{h.id}</span>
                <span style={{ fontSize: 10, color: "#64748b" }}>{h.zh}</span>
              </div>
              <div style={{ fontSize: 9, color: "#64748b", paddingLeft: 12 }}>{h.en}</div>
              <div
                style={{ display: "flex", gap: 3, marginTop: 3, paddingLeft: 12, flexWrap: "wrap" }}
              >
                {h.evts.map((e) => (
                  <span
                    key={e}
                    style={{
                      fontSize: 8,
                      padding: "1px 4px",
                      borderRadius: 3,
                      background: (EVT_COLORS[e] || "#00d68f") + "18",
                      color: EVT_COLORS[e] || "#00d68f",
                      fontFamily: FC,
                    }}
                  >
                    {e}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Direct Pipeline */}
      <div>
        <div
          style={{
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: 2,
            color: "#64748b",
            textAlign: "center",
            paddingTop: 16,
            paddingBottom: 12,
            borderTop: "1px solid rgba(51,65,85,.3)",
          }}
        >
          <span style={{ display: "block", fontSize: 12, color: "#cbd5e1", letterSpacing: 1 }}>
            直連管線（繞過事件系統）
          </span>
          Direct Call Pipeline — get-reply-run.ts
        </div>
        <div style={{ display: "flex", alignItems: "stretch", justifyContent: "center" }}>
          {pipeline.map((p, i) => (
            <div key={p.name} style={{ display: "flex", alignItems: "stretch" }}>
              <div
                style={{
                  padding: "10px 16px",
                  background: "#0d1a2a",
                  border: `1px solid ${i === pipeline.length - 1 ? "rgba(226,232,240,.2)" : "rgba(84,160,255,.2)"}`,
                  color: i === pipeline.length - 1 ? "#e2e8f0" : "#54a0ff",
                  fontSize: 12,
                  fontWeight: 600,
                  textAlign: "center",
                  borderRadius:
                    i === 0 ? "6px 0 0 6px" : i === pipeline.length - 1 ? "0 6px 6px 0" : 0,
                }}
              >
                <div>{p.name}</div>
                <div style={{ fontSize: 9, color: "#64748b", fontWeight: 400, marginTop: 2 }}>
                  {p.zh} / {p.cache}
                </div>
              </div>
              {i < pipeline.length - 1 && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "0 2px",
                    color: "#54a0ff",
                    opacity: 0.3,
                    fontSize: 14,
                    background: "#0d1a2a",
                    borderTop: "1px solid rgba(84,160,255,.2)",
                    borderBottom: "1px solid rgba(84,160,255,.2)",
                  }}
                >
                  →
                </div>
              )}
            </div>
          ))}
        </div>
        <div style={{ textAlign: "center", fontSize: 10, color: "#64748b", marginTop: 6 }}>
          4 個 builder 直接呼叫 Time Tunnel query.js — 不經過事件系統
        </div>
      </div>

      {/* Time Tunnel Usage — corrected after deep audit */}
      <div>
        <div
          style={{
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: 2,
            color: "#64748b",
            textAlign: "center",
            paddingTop: 16,
            paddingBottom: 12,
            borderTop: "1px solid rgba(51,65,85,.3)",
          }}
        >
          <span style={{ display: "block", fontSize: 12, color: "#cbd5e1", letterSpacing: 1 }}>
            Time Tunnel query.js — 84 exports
          </span>
          Deep Audit Result
        </div>
        {[
          { l: "直接呼叫 Direct", v: 27, t: 84, c: "#00d68f" },
          { l: "間接呼叫 Indirect", v: 3, t: 84, c: "#22d3ee" },
          { l: "留作工具 Skill/Tool", v: 18, t: 84, c: "#f59e0b" },
          { l: "確認冗餘 Redundant", v: 36, t: 84, c: "#ff4757" },
        ].map((b, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "4px 0",
              fontSize: 11,
            }}
          >
            <span style={{ width: 130, textAlign: "right", color: "#64748b" }}>{b.l}</span>
            <div
              style={{
                flex: 1,
                height: 14,
                background: "#111827",
                borderRadius: 3,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${(b.v / b.t) * 100}%`,
                  borderRadius: 3,
                  background: `linear-gradient(90deg, ${b.c}22, ${b.c}55)`,
                }}
              />
            </div>
            <span style={{ width: 70, fontFamily: FC, fontSize: 10, color: b.c }}>
              {b.v} / {b.t}
            </span>
          </div>
        ))}
        <div
          style={{
            marginTop: 8,
            padding: "8px 12px",
            borderRadius: 6,
            background: "rgba(6,182,212,.06)",
            border: "1px solid rgba(6,182,212,.15)",
            fontSize: 10,
            color: "#22d3ee",
          }}
        >
          間接呼叫: consolidateMemories + extractKnowledge + autoCreateReminders — 透過
          runIntelligenceCycle (learning-engine) 每 50 訊息/30 分鐘觸發
        </div>
      </div>

      {/* Function Audit Summary */}
      <div>
        <div
          style={{
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: 2,
            color: "#64748b",
            textAlign: "center",
            paddingTop: 16,
            paddingBottom: 12,
            borderTop: "1px solid rgba(51,65,85,.3)",
          }}
        >
          <span style={{ display: "block", fontSize: 12, color: "#cbd5e1", letterSpacing: 1 }}>
            函式分類盤點
          </span>
          Export Audit by Subsystem
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
          {[
            { sys: "搜索系統", total: 4, live: 0, tool: 0, dead: 4, color: "#ef4444" },
            { sys: "查詢分析", total: 13, live: 0, tool: 4, dead: 9, color: "#f59e0b" },
            { sys: "記憶管理", total: 5, live: 2, tool: 0, dead: 3, color: "#3b82f6" },
            { sys: "知識庫", total: 3, live: 1, tool: 1, dead: 1, color: "#14b8a6" },
            { sys: "提醒規則", total: 3, live: 1, tool: 2, dead: 0, color: "#22c55e" },
            { sys: "整合觸發", total: 2, live: 2, tool: 0, dead: 0, color: "#22c55e" },
            { sys: "上下文感知", total: 3, live: 0, tool: 0, dead: 3, color: "#ef4444" },
            { sys: "意識系統", total: 2, live: 0, tool: 1, dead: 1, color: "#f59e0b" },
            { sys: "獎勵系統", total: 7, live: 1, tool: 2, dead: 4, color: "#f59e0b" },
            { sys: "對話週期", total: 3, live: 1, tool: 2, dead: 0, color: "#22c55e" },
            { sys: "思考過程", total: 8, live: 2, tool: 3, dead: 3, color: "#3b82f6" },
            { sys: "異常偵測", total: 5, live: 0, tool: 0, dead: 5, color: "#ef4444" },
            { sys: "身份管理", total: 4, live: 2, tool: 2, dead: 0, color: "#22c55e" },
            { sys: "報告生成", total: 3, live: 0, tool: 2, dead: 1, color: "#f59e0b" },
          ].map((s, i) => (
            <div
              key={i}
              style={{
                padding: 10,
                borderRadius: 6,
                background: "#0f1520",
                border: `1px solid ${s.color}22`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 6,
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 600, color: "#cbd5e1" }}>{s.sys}</span>
                <span style={{ fontSize: 10, fontFamily: FC, color: "#64748b" }}>{s.total}</span>
              </div>
              <div
                style={{ display: "flex", gap: 2, height: 6, borderRadius: 3, overflow: "hidden" }}
              >
                {s.live > 0 && (
                  <div
                    style={{
                      width: `${(s.live / s.total) * 100}%`,
                      background: "#00d68f",
                      height: "100%",
                    }}
                  />
                )}
                {s.tool > 0 && (
                  <div
                    style={{
                      width: `${(s.tool / s.total) * 100}%`,
                      background: "#f59e0b",
                      height: "100%",
                    }}
                  />
                )}
                {s.dead > 0 && (
                  <div
                    style={{
                      width: `${(s.dead / s.total) * 100}%`,
                      background: "#ff4757",
                      height: "100%",
                    }}
                  />
                )}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 4, fontSize: 9, color: "#64748b" }}>
                {s.live > 0 && <span style={{ color: "#00d68f" }}>{s.live} live</span>}
                {s.tool > 0 && <span style={{ color: "#f59e0b" }}>{s.tool} tool</span>}
                {s.dead > 0 && <span style={{ color: "#ff4757" }}>{s.dead} dead</span>}
              </div>
            </div>
          ))}
        </div>
        <div
          style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 8, fontSize: 10 }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: "#00d68f" }} /> Live
            (30)
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: "#f59e0b" }} /> Tool
            (18)
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: "#ff4757" }} /> Dead
            (36)
          </span>
        </div>
      </div>

      {/* Fix Log */}
      <div>
        <div
          style={{
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: 2,
            color: "#64748b",
            textAlign: "center",
            paddingTop: 16,
            paddingBottom: 12,
            borderTop: "1px solid rgba(51,65,85,.3)",
          }}
        >
          <span style={{ display: "block", fontSize: 12, color: "#cbd5e1", letterSpacing: 1 }}>
            修復紀錄
          </span>
          Fix Log — All Nerves Connected
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10 }}>
          {[
            {
              t: "FIXED context-atoms 索引器",
              d: "HOOK.md 監聽事件 gateway:start → gateway:startup",
              c: "f9754178b",
            },
            {
              t: "FIXED error-recovery 觸發",
              d: "新增 gateway:error 和 agent:error 觸發點",
              c: "f9754178b",
            },
            { t: "FIXED session:start 事件", d: "/new 指令後發射 session:start", c: "f9754178b" },
            {
              t: "FIXED namespace + YAML",
              d: "group-context: moltbot→openclaw, line-dual-track frontmatter",
              c: "4ba3f4263",
            },
          ].map((f, i) => (
            <div
              key={i}
              style={{
                padding: 14,
                borderRadius: 6,
                border: "1px solid rgba(0,214,143,.25)",
                background: "#0f1520",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: "#00d68f", marginBottom: 4 }}>
                {f.t}
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>{f.d}</div>
              <div style={{ fontSize: 10, fontFamily: FC, color: "#475569" }}>Commit: {f.c}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════ MAIN ══════════════════════
export default function WujiDashboard() {
  const [tab, setTab] = useState("Command");

  return (
    <div style={{ minHeight: "100vh", background: "#030712", color: "#e2e8f0", fontFamily: FS }}>
      <style>{`@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:.3 } }`}</style>

      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          borderBottom: "1px solid rgba(30,41,59,.5)",
          background: "rgba(3,7,18,.92)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            padding: "12px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 18 }}>☯</span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 500,
                letterSpacing: 3,
                color: "#94a3b8",
                fontFamily: FC,
              }}
            >
              Wuji
            </span>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: "6px 16px",
                  borderRadius: 9999,
                  fontSize: 12,
                  fontWeight: 500,
                  border: "none",
                  cursor: "pointer",
                  background: tab === t ? "rgba(59,130,246,.12)" : "transparent",
                  color: tab === t ? "#60a5fa" : "#64748b",
                  boxShadow: tab === t ? "inset 0 0 0 1px rgba(59,130,246,.25)" : "none",
                  transition: "all .2s",
                }}
              >
                {t}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#34d399",
                animation: "pulse 2s infinite",
              }}
            />
            <span style={{ fontSize: 10, color: "#64748b", fontFamily: FC }}>ONLINE</span>
          </div>
        </div>
      </nav>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
        {tab === "Command" && <CommandTab />}
        {tab === "Skills" && <SkillsTab />}
        {tab === "Memory" && <MemoryTab />}
        {tab === "Projects" && <ProjectsTab />}
        {tab === "Life" && <LifeTab />}
        {tab === "Nerves" && <NervousTab />}
      </main>

      <footer
        style={{ borderTop: "1px solid rgba(30,41,59,.3)", padding: 12, textAlign: "center" }}
      >
        <span style={{ fontSize: 10, color: "#475569", fontFamily: FC }}>
          WUJI v0.2 — Cruz Tang's AI System Chief Engineer — 7 Agents · 15 Hooks · 32 Skills · 61
          Scripts · 33 Extensions
        </span>
      </footer>
    </div>
  );
}
