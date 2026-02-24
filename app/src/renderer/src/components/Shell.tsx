import type { Section, SophieStatus, SessionProgress } from "../App";
import { ChatView } from "./chat/ChatView";
import { DNAView } from "./dna/DNAView";
import { EditView } from "./edit/EditView";
import { Header } from "./Header";
import { LearnView } from "./learn/LearnView";
import { NavRail } from "./NavRail";
import { StatusBar } from "./StatusBar";

interface ShellProps {
  activeSection: Section;
  onSectionChange: (section: Section) => void;
  status: SophieStatus;
  progress: SessionProgress | null;
  onStatusChange: (s: SophieStatus) => void;
  onProgressChange: (p: SessionProgress | null) => void;
}

const sectionLabels: Record<Section, string> = {
  chat: "CHAT",
  learn: "LEARN",
  edit: "EDIT",
  dna: "DNA",
};

export function Shell({
  activeSection,
  onSectionChange,
  status,
  progress,
  onStatusChange,
  onProgressChange,
}: ShellProps) {
  const content = {
    chat: <ChatView onStatusChange={onStatusChange} onProgressChange={onProgressChange} />,
    learn: <LearnView />,
    edit: <EditView progress={progress} status={status} />,
    dna: <DNAView />,
  }[activeSection];

  return (
    <div style={styles.shell}>
      <Header activeSection={sectionLabels[activeSection]} />
      <div style={styles.body}>
        <NavRail
          active={activeSection}
          onChange={onSectionChange}
          editActive={status === "editing"}
        />
        <main style={styles.content}>{content}</main>
      </div>
      <StatusBar status={status} progress={progress} />
    </div>
  );
}

const styles = {
  shell: {
    display: "flex",
    flexDirection: "column" as const,
    height: "100vh",
    background: "var(--bg-primary)",
    overflow: "hidden",
  },
  body: {
    display: "flex",
    flex: 1,
    overflow: "hidden",
  },
  content: {
    flex: 1,
    overflow: "auto",
    padding: "var(--space-5)",
  },
} as const;
