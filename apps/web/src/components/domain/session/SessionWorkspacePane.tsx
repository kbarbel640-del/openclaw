"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WebTerminal, type WebTerminalRef } from "@/components/composed";
import {
  Maximize2,
  Minimize2,
  Terminal,
  FolderOpen,
  RefreshCw,
  ChevronDown,
} from "lucide-react";

export interface SessionWorkspacePaneProps {
  /** Whether the pane is maximized */
  isMaximized?: boolean;
  /** Callback to toggle maximize state */
  onToggleMaximize?: () => void;
  /** Agent workspace directory path */
  workspaceDir?: string;
  /** Session key for terminal context */
  sessionKey?: string;
  /** Callback when terminal receives data */
  onTerminalData?: (data: string) => void;
  /** Additional CSS classes */
  className?: string;
}

// Mock file tree for development
interface FileNode {
  name: string;
  type: "file" | "folder";
  children?: FileNode[];
}

const mockFileTree: FileNode[] = [
  {
    name: "workspace",
    type: "folder",
    children: [
      { name: "README.md", type: "file" },
      { name: "notes.txt", type: "file" },
      {
        name: "research",
        type: "folder",
        children: [
          { name: "findings.md", type: "file" },
          { name: "data.json", type: "file" },
        ],
      },
      {
        name: "scripts",
        type: "folder",
        children: [
          { name: "analyze.py", type: "file" },
          { name: "export.sh", type: "file" },
        ],
      },
    ],
  },
];

export function SessionWorkspacePane({
  isMaximized = false,
  onToggleMaximize,
  workspaceDir = "~/.clawdbrain/agents/default/workspace",
  sessionKey,
  onTerminalData,
  className,
}: SessionWorkspacePaneProps) {
  const terminalRef = React.useRef<WebTerminalRef>(null);
  const [activeTab, setActiveTab] = React.useState<"terminal" | "files">("terminal");

  // Handle terminal resize when maximized state changes
  React.useEffect(() => {
    if (terminalRef.current) {
      // Give time for layout to settle
      const timer = setTimeout(() => {
        terminalRef.current?.fit();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isMaximized]);

  const handleRefreshTerminal = () => {
    terminalRef.current?.clear();
    terminalRef.current?.writeln("Terminal cleared.");
    terminalRef.current?.writeln(`Session: ${sessionKey ?? "none"}`);
    terminalRef.current?.writeln(`Workspace: ${workspaceDir}`);
    terminalRef.current?.writeln("");
  };

  return (
    <div
      className={cn(
        "flex flex-col border border-border rounded-xl bg-card overflow-hidden",
        isMaximized && "fixed inset-x-4 bottom-4 top-20 z-50 shadow-2xl",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-muted/30 px-3 py-2">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "terminal" | "files")}>
          <TabsList className="h-8 bg-transparent p-0">
            <TabsTrigger
              value="terminal"
              className="h-7 px-3 text-xs data-[state=active]:bg-background"
            >
              <Terminal className="h-3.5 w-3.5 mr-1.5" />
              Terminal
            </TabsTrigger>
            <TabsTrigger
              value="files"
              className="h-7 px-3 text-xs data-[state=active]:bg-background"
            >
              <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
              Files
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-1">
          {activeTab === "terminal" && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleRefreshTerminal}
              title="Clear terminal"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          )}
          {onToggleMaximize && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onToggleMaximize}
              title={isMaximized ? "Minimize" : "Maximize"}
            >
              {isMaximized ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {activeTab === "terminal" ? (
          <WebTerminal
            ref={terminalRef}
            className="h-full rounded-none border-none"
            height="100%"
            welcomeMessage={`Clawdbrain Terminal\nSession: ${sessionKey ?? "none"}\nWorkspace: ${workspaceDir}\n`}
            onData={onTerminalData}
          />
        ) : (
          <FileExplorer files={mockFileTree} workspaceDir={workspaceDir} />
        )}
      </div>
    </div>
  );
}

interface FileExplorerProps {
  files: FileNode[];
  workspaceDir: string;
}

function FileExplorer({ files, workspaceDir }: FileExplorerProps) {
  return (
    <div className="h-full overflow-auto p-3 scrollbar-thin">
      {/* Workspace path */}
      <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
        <FolderOpen className="h-3.5 w-3.5" />
        <span className="font-mono truncate">{workspaceDir}</span>
      </div>

      {/* File tree */}
      <div className="space-y-1">
        {files.map((node) => (
          <FileTreeNode key={node.name} node={node} depth={0} />
        ))}
      </div>
    </div>
  );
}

interface FileTreeNodeProps {
  node: FileNode;
  depth: number;
}

function FileTreeNode({ node, depth }: FileTreeNodeProps) {
  const [isExpanded, setIsExpanded] = React.useState(true);
  const isFolder = node.type === "folder";

  return (
    <div>
      <button
        type="button"
        onClick={() => isFolder && setIsExpanded(!isExpanded)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs transition-colors",
          "hover:bg-muted/50",
          isFolder && "cursor-pointer",
          !isFolder && "cursor-default"
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {isFolder ? (
          <>
            <ChevronDown
              className={cn(
                "h-3 w-3 text-muted-foreground transition-transform",
                !isExpanded && "-rotate-90"
              )}
            />
            <FolderOpen className="h-3.5 w-3.5 text-yellow-500" />
          </>
        ) : (
          <>
            <span className="w-3" />
            <FileIcon filename={node.name} />
          </>
        )}
        <span className="truncate">{node.name}</span>
      </button>

      {isFolder && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeNode key={child.name} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function FileIcon({ filename }: { filename: string }) {
  const ext = filename.split(".").pop()?.toLowerCase();

  const iconClass = "h-3.5 w-3.5";

  switch (ext) {
    case "md":
      return <span className={cn(iconClass, "text-blue-400")}>📄</span>;
    case "json":
      return <span className={cn(iconClass, "text-yellow-400")}>📋</span>;
    case "py":
      return <span className={cn(iconClass, "text-green-400")}>🐍</span>;
    case "sh":
      return <span className={cn(iconClass, "text-gray-400")}>⚡</span>;
    case "txt":
      return <span className={cn(iconClass, "text-gray-400")}>📝</span>;
    default:
      return <span className={cn(iconClass, "text-gray-400")}>📄</span>;
  }
}

export default SessionWorkspacePane;
