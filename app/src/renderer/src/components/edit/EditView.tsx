import { useState, type CSSProperties } from "react";
import { HeroStat } from "../shared/HeroStat";
import { Rule } from "../shared/Rule";
import { SectionTitle } from "../shared/SectionTitle";
import { SpecRow } from "../shared/SpecRow";
import { FlaggedQueue } from "./FlaggedQueue";
import { SessionBreakdown } from "./SessionBreakdown";
import { SessionProgress as SessionProgressComponent } from "./SessionProgress";
import type { SessionProgress, SophieStatus } from "./types";

interface EditViewProps {
  progress: SessionProgress | null;
  status: SophieStatus;
}

interface RecentSession {
  title: string;
  started: string;
  completed: string;
  photos: number;
  flagged: number;
}

const MOCK_RECENT_SESSIONS: RecentSession[] = [
  {
    title: "TINA & JARED WEDDING",
    started: "2026-02-18 14:32",
    completed: "2026-02-18 16:14",
    photos: 1412,
    flagged: 23,
  },
  {
    title: "BROOKLYN BRIDGE SHOOT",
    started: "2026-02-17 09:15",
    completed: "2026-02-17 10:48",
    photos: 342,
    flagged: 5,
  },
  {
    title: "FAMILY PORTRAITS DEC",
    started: "2026-02-15 11:00",
    completed: "2026-02-15 12:22",
    photos: 187,
    flagged: 2,
  },
];

function ActiveSession({ progress }: { progress: SessionProgress }) {
  const fileName = `DSC_${String(progress.current).padStart(4, "0")}.NEF`;
  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div style={s.container}>
      {/* Top bar: session title + controls */}
      <div style={s.topBar}>
        <SectionTitle sub="2026-02-19 09:00">SESSION: TINA & JARED WEDDING</SectionTitle>
        <div style={s.controls}>
          <ControlBtn label="PAUSE" />
          <ControlBtn label="STOP" variant="danger" />
          <ControlBtn label="SKIP TO FLAGGED" />
        </div>
      </div>

      <Rule variant="strong" spacing="sm" />

      {/* Dashboard grid: 2 columns */}
      <div style={s.grid}>
        {/* Left column: progress + current file */}
        <div style={s.gridLeft}>
          <div style={s.progressBlock}>
            <div style={s.progressHeader}>
              <HeroStat value={`${pct}%`} label="COMPLETE" />
              <HeroStat value={String(progress.flagged)} label="FLAGGED" size="md" />
            </div>
            <div style={s.progressBarWrap}>
              <SessionProgressComponent
                current={progress.current}
                total={progress.total}
                flagged={progress.flagged}
                eta={progress.eta}
              />
            </div>
          </div>

          <Rule spacing="sm" />

          <div style={s.currentFile}>
            <div style={s.currentFileLabel}>CURRENT FILE</div>
            <div style={s.currentFileName}>{fileName}</div>
            <div style={s.currentFileMeta}>
              <SpecRow label="SCENARIO" value={progress.scenario ?? "—"} />
              <SpecRow
                label="CONFIDENCE"
                value={progress.confidence != null ? progress.confidence.toFixed(2) : "—"}
                valueColor={
                  progress.confidence != null && progress.confidence >= 0.7
                    ? "var(--accent)"
                    : "var(--text-primary)"
                }
              />
              <SpecRow label="APPLIED" value="YES" valueColor="var(--accent)" />
            </div>
          </div>
        </div>

        {/* Right column: flagged + breakdown */}
        <div style={s.gridRight}>
          <SectionTitle>FLAGGED FOR REVIEW</SectionTitle>
          <div style={s.flaggedWrap}>
            <FlaggedQueue />
          </div>

          <Rule spacing="sm" />

          <SectionTitle>BREAKDOWN</SectionTitle>
          <SessionBreakdown />
        </div>
      </div>
    </div>
  );
}

function IdleState() {
  return (
    <div style={s.container}>
      <SectionTitle size="screen">NO ACTIVE SESSION</SectionTitle>
      <Rule variant="strong" spacing="md" />

      <p style={s.helpText}>No active session. Initiate from Chat.</p>

      <Rule spacing="lg" />
      <SectionTitle>RECENT SESSIONS</SectionTitle>

      <div style={s.recentGrid}>
        {MOCK_RECENT_SESSIONS.map((session, i) => (
          <RecentCard key={i} session={session} />
        ))}
      </div>
    </div>
  );
}

function RecentCard({ session }: { session: RecentSession }) {
  const [hover, setHover] = useState(false);

  return (
    <div
      style={{
        ...s.recentCard,
        borderColor: hover ? "var(--border-strong)" : "var(--border)",
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div style={s.recentCardHeader}>
        <span style={s.recentTitle}>{session.title}</span>
      </div>
      <div style={s.recentCardRule} />
      <div style={s.recentCardBody}>
        <SpecRow label="STARTED" value={session.started} />
        <SpecRow label="COMPLETED" value={session.completed} />
        <SpecRow label="PHOTOS" value={session.photos.toLocaleString()} />
        <SpecRow label="FLAGGED" value={String(session.flagged)} />
      </div>
      <div style={s.recentCardFooter}>
        <button
          type="button"
          style={{
            ...s.viewBtn,
            borderColor: hover ? "var(--accent)" : "var(--border)",
            color: hover ? "var(--accent)" : "var(--text-secondary)",
          }}
        >
          VIEW REPORT
        </button>
      </div>
    </div>
  );
}

function ControlBtn({ label, variant }: { label: string; variant?: "danger" }) {
  const [hover, setHover] = useState(false);

  return (
    <button
      type="button"
      style={{
        ...s.controlBtn,
        borderColor: hover ? (variant === "danger" ? "#C0392B" : "var(--accent)") : "var(--border)",
        color: hover ? (variant === "danger" ? "#C0392B" : "var(--accent)") : "var(--text-primary)",
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {label}
    </button>
  );
}

export function EditView({ progress, status }: EditViewProps) {
  void status;
  if (progress !== null) {
    return <ActiveSession progress={progress} />;
  }
  return <IdleState />;
}

const s: Record<string, CSSProperties> = {
  container: {
    overflow: "auto",
    height: "100%",
  },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "var(--space-2)",
  },
  controls: {
    display: "flex",
    gap: "var(--space-2)",
    flexShrink: 0,
  },
  controlBtn: {
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 2,
    padding: "var(--space-2) var(--space-3)",
    border: "1px solid var(--border)",
    background: "transparent",
    cursor: "pointer",
    transition: "border-color 0.1s, color 0.1s",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "var(--space-5)",
    marginTop: "var(--space-3)",
  },
  gridLeft: {
    display: "flex",
    flexDirection: "column",
  },
  gridRight: {
    display: "flex",
    flexDirection: "column",
    borderLeft: "1px solid var(--border)",
    paddingLeft: "var(--space-5)",
  },
  progressBlock: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-3)",
  },
  progressHeader: {
    display: "flex",
    gap: "var(--space-6)",
  },
  progressBarWrap: {
    marginTop: "var(--space-2)",
  },
  currentFile: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-2)",
  },
  currentFileLabel: {
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    letterSpacing: 3,
    textTransform: "uppercase",
    color: "var(--text-muted)",
  },
  currentFileName: {
    fontFamily: "var(--font-mono)",
    fontSize: 24,
    fontWeight: 700,
    letterSpacing: -0.5,
    color: "var(--text-primary)",
  },
  currentFileMeta: {
    marginTop: "var(--space-2)",
  },
  flaggedWrap: {
    marginTop: "var(--space-2)",
    marginBottom: "var(--space-2)",
  },
  helpText: {
    fontFamily: "var(--font-sans)",
    fontSize: 14,
    color: "var(--text-secondary)",
    lineHeight: 1.5,
    marginBottom: "var(--space-3)",
  },
  recentGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
    gap: "var(--space-3)",
    marginTop: "var(--space-3)",
  },
  recentCard: {
    border: "1px solid var(--border)",
    background: "var(--bg-primary)",
    transition: "border-color 0.15s",
  },
  recentCardHeader: {
    padding: "var(--space-2) var(--space-3)",
  },
  recentCardRule: {
    height: 1,
    background: "var(--border)",
  },
  recentCardBody: {
    padding: "var(--space-2) var(--space-3)",
  },
  recentCardFooter: {
    padding: "0 var(--space-3) var(--space-3)",
  },
  recentTitle: {
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "var(--text-primary)",
  },
  viewBtn: {
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 2,
    padding: "var(--space-2) var(--space-3)",
    border: "1px solid var(--border)",
    background: "transparent",
    cursor: "pointer",
    transition: "border-color 0.1s, color 0.1s",
  },
};
