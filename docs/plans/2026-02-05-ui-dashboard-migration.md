# UI Dashboard Tech Stack Migration

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate the ui-dashboard from hand-rolled CSS Modules + custom components to Tailwind CSS + shadcn/ui, and add IDE-grade libraries (Monaco Editor, xterm.js, resizable panels, file tree).

**Architecture:** Replace the existing custom UI component library and CSS Modules with shadcn/ui (Radix primitives + Tailwind). Replace the rigid ThreeColumnLayout with `react-resizable-panels` for VS Code-like panel management. Add Monaco Editor for code/diff viewing, xterm.js for terminal output, and react-arborist for file trees. Keep Zustand store, gateway WebSocket, and types untouched.

**Tech Stack:** React 19, Vite, TypeScript, Tailwind CSS v4, shadcn/ui, Monaco Editor, xterm.js, react-resizable-panels, react-arborist, @dnd-kit/core, Zustand

---

## Phase 1: Foundation — Tailwind CSS + shadcn/ui Setup

### Task 1: Install Tailwind CSS v4

Tailwind v4 uses the new Vite plugin approach (no PostCSS config needed).

**Files:**
- Modify: `ui-dashboard/package.json`
- Modify: `ui-dashboard/vite.config.ts`
- Create: `ui-dashboard/src/styles/tailwind.css` (replaces index.css)

**Step 1: Install Tailwind v4 + Vite plugin**

```bash
cd ui-dashboard && npm install tailwindcss @tailwindcss/vite
```

**Step 2: Add Tailwind Vite plugin**

Modify `ui-dashboard/vite.config.ts`:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
  ],
})
```

**Step 3: Create Tailwind entry CSS**

Create `ui-dashboard/src/styles/tailwind.css`:
```css
@import "tailwindcss";
```

**Step 4: Update main.tsx to import Tailwind CSS**

Replace the `index.css` import in `ui-dashboard/src/main.tsx` with:
```ts
import './styles/tailwind.css'
```

**Step 5: Verify Tailwind works**

```bash
cd ui-dashboard && npm run dev
```

Open browser, inspect any element — Tailwind's preflight reset should be active.

**Step 6: Commit**

```
feat(ui-dashboard): add Tailwind CSS v4 with Vite plugin
```

---

### Task 2: Configure Tailwind theme with existing design tokens

Port the design system from `variables.css` into Tailwind's theme configuration.

**Files:**
- Modify: `ui-dashboard/src/styles/tailwind.css`

**Step 1: Add theme configuration to tailwind.css**

Tailwind v4 uses CSS-based configuration with `@theme`:

```css
@import "tailwindcss";

@theme {
  /* Colors - Background */
  --color-bg-primary: #0d1117;
  --color-bg-secondary: #161b22;
  --color-bg-tertiary: #21262d;
  --color-bg-card: #1c2128;

  /* Colors - Text */
  --color-text-primary: #c9d1d9;
  --color-text-secondary: #8b949e;
  --color-text-muted: #484f58;

  /* Colors - Accent */
  --color-accent: #58a6ff;
  --color-accent-hover: #4c9aed;

  /* Colors - Status */
  --color-success: #3fb950;
  --color-warning: #d29922;
  --color-error: #f85149;
  --color-purple: #a371f7;

  /* Colors - Border */
  --color-border: #30363d;
  --color-border-hover: #484f58;
  --color-border-active: #58a6ff;

  /* Spacing */
  --spacing-1: 4px;
  --spacing-2: 8px;
  --spacing-3: 12px;
  --spacing-4: 16px;
  --spacing-5: 20px;
  --spacing-6: 24px;
  --spacing-7: 28px;
  --spacing-8: 32px;

  /* Layout */
  --header-height: 48px;
  --sidebar-width: 240px;
  --context-panel-width: 300px;

  /* Border radius */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;

  /* Transitions */
  --transition-fast: 0.15s ease;

  /* Font */
  --font-mono: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
}
```

**Step 2: Add base styles (from reset.css + global.css)**

Append to `tailwind.css`:
```css
@layer base {
  @font-face {
    font-family: 'JetBrains Mono';
    src: url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&display=swap');
  }

  html {
    font-family: var(--font-mono);
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
  }

  body {
    min-height: 100vh;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }

  ::selection {
    background: color-mix(in srgb, var(--color-accent) 30%, transparent);
  }

  *:focus-visible {
    outline: 1px solid var(--color-accent);
    outline-offset: 2px;
  }

  /* Scrollbar styling */
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  ::-webkit-scrollbar-track {
    background: transparent;
  }
  ::-webkit-scrollbar-thumb {
    background: var(--color-border);
    border-radius: 4px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: var(--color-border-hover);
  }
}

@layer utilities {
  .animate-pulse-slow {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
}
```

**Step 3: Verify theme tokens resolve**

```bash
cd ui-dashboard && npm run dev
```

The app background should be `#0d1117`, text should be `#c9d1d9`.

**Step 4: Commit**

```
feat(ui-dashboard): configure Tailwind theme with design tokens
```

---

### Task 3: Install and initialize shadcn/ui

**Files:**
- Modify: `ui-dashboard/package.json`
- Create: `ui-dashboard/components.json` (shadcn config)
- Modify: `ui-dashboard/tsconfig.app.json` (path aliases)
- Modify: `ui-dashboard/vite.config.ts` (path aliases)

**Step 1: Install shadcn/ui dependencies**

```bash
cd ui-dashboard && npm install class-variance-authority clsx tailwind-merge lucide-react
```

These are the core utilities shadcn/ui components depend on.

**Step 2: Create the cn utility**

Create `ui-dashboard/src/lib/utils.ts`:
```ts
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

**Step 3: Add path aliases to tsconfig**

Modify `ui-dashboard/tsconfig.app.json` — add to `compilerOptions`:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

**Step 4: Add path aliases to Vite**

Modify `ui-dashboard/vite.config.ts`:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
```

**Step 5: Create shadcn components.json**

Create `ui-dashboard/components.json`:
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/styles/tailwind.css",
    "baseColor": "zinc",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

**Step 6: Verify the setup compiles**

```bash
cd ui-dashboard && npm run build
```

**Step 7: Commit**

```
feat(ui-dashboard): initialize shadcn/ui with path aliases and cn utility
```

---

### Task 4: Add shadcn/ui components

Install the specific shadcn components we need to replace custom ones.

**Step 1: Add components via CLI**

```bash
cd ui-dashboard
npx shadcn@latest add button badge avatar input textarea tabs select card separator scroll-area tooltip dialog dropdown-menu sheet progress
```

This creates files in `src/components/ui/` — they will coexist temporarily with old components.

**Step 2: Verify components are generated**

```bash
ls ui-dashboard/src/components/ui/
```

Should see: `button.tsx`, `badge.tsx`, `avatar.tsx`, `input.tsx`, `textarea.tsx`, `tabs.tsx`, `select.tsx`, `card.tsx`, etc.

**Step 3: Verify build succeeds**

```bash
cd ui-dashboard && npm run build
```

**Step 4: Commit**

```
feat(ui-dashboard): add shadcn/ui component library
```

---

## Phase 2: IDE Libraries Installation

### Task 5: Install IDE libraries

**Files:**
- Modify: `ui-dashboard/package.json`

**Step 1: Install all IDE libraries**

```bash
cd ui-dashboard && npm install \
  @monaco-editor/react monaco-editor \
  @xterm/xterm @xterm/addon-fit @xterm/addon-web-links \
  react-resizable-panels \
  react-arborist \
  @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

**Step 2: Verify build still works**

```bash
cd ui-dashboard && npm run build
```

**Step 3: Commit**

```
feat(ui-dashboard): install Monaco, xterm, resizable-panels, arborist, dnd-kit
```

---

## Phase 3: Layout Migration — Resizable Panels

### Task 6: Create ResizableLayout component

Replace the rigid `ThreeColumnLayout` with `react-resizable-panels`.

**Files:**
- Create: `ui-dashboard/src/components/layout/ResizableLayout.tsx`
- Modify: `ui-dashboard/src/components/layout/index.ts`

**Step 1: Build ResizableLayout**

Create `ui-dashboard/src/components/layout/ResizableLayout.tsx`:
```tsx
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { cn } from '@/lib/utils'

interface ResizableLayoutProps {
  sidebar?: React.ReactNode
  main: React.ReactNode
  context?: React.ReactNode
  terminal?: React.ReactNode
  defaultSidebarSize?: number
  defaultContextSize?: number
  defaultTerminalSize?: number
}

function ResizeHandle({ className }: { className?: string }) {
  return (
    <PanelResizeHandle
      className={cn(
        'w-[1px] bg-border hover:bg-accent transition-colors duration-150',
        'data-[resize-handle-active]:bg-accent',
        className
      )}
    />
  )
}

function HorizontalResizeHandle({ className }: { className?: string }) {
  return (
    <PanelResizeHandle
      className={cn(
        'h-[1px] bg-border hover:bg-accent transition-colors duration-150',
        'data-[resize-handle-active]:bg-accent',
        className
      )}
    />
  )
}

export function ResizableLayout({
  sidebar,
  main,
  context,
  terminal,
  defaultSidebarSize = 18,
  defaultContextSize = 22,
  defaultTerminalSize = 30,
}: ResizableLayoutProps) {
  return (
    <PanelGroup direction="horizontal" className="h-full">
      {sidebar && (
        <>
          <Panel
            defaultSize={defaultSidebarSize}
            minSize={12}
            maxSize={30}
            className="bg-bg-secondary"
          >
            {sidebar}
          </Panel>
          <ResizeHandle />
        </>
      )}

      <Panel minSize={30}>
        {terminal ? (
          <PanelGroup direction="vertical">
            <Panel minSize={20}>
              {main}
            </Panel>
            <HorizontalResizeHandle />
            <Panel
              defaultSize={defaultTerminalSize}
              minSize={10}
              maxSize={60}
              className="bg-bg-primary"
            >
              {terminal}
            </Panel>
          </PanelGroup>
        ) : (
          main
        )}
      </Panel>

      {context && (
        <>
          <ResizeHandle />
          <Panel
            defaultSize={defaultContextSize}
            minSize={15}
            maxSize={35}
            className="bg-bg-secondary"
          >
            {context}
          </Panel>
        </>
      )}
    </PanelGroup>
  )
}
```

**Step 2: Export from layout index**

Update `ui-dashboard/src/components/layout/index.ts` to add:
```ts
export { ResizableLayout } from './ResizableLayout'
```

**Step 3: Verify it compiles**

```bash
cd ui-dashboard && npm run build
```

**Step 4: Commit**

```
feat(ui-dashboard): add ResizableLayout with react-resizable-panels
```

---

### Task 7: Migrate Header to Tailwind + shadcn

**Files:**
- Rewrite: `ui-dashboard/src/components/layout/Header.tsx`
- Delete: `ui-dashboard/src/components/layout/Header.module.css`

**Step 1: Rewrite Header.tsx with Tailwind classes + shadcn Badge**

Replace the entire file. Use Tailwind utility classes. Replace the custom Badge import with the shadcn Badge. Use `lucide-react` icons instead of Unicode characters. Keep all existing functionality (nav links, stats, connection indicator, review badge).

Key mapping from old CSS to Tailwind:
- `.header` → `flex items-center h-12 px-4 bg-bg-secondary border-b border-border`
- `.navLink` → `text-[13px] px-3 py-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors`
- `.navLink.active` → add `bg-bg-tertiary text-text-primary`
- `.connectionDot` → `w-2 h-2 rounded-full` with color classes

**Step 2: Remove Header.module.css**

```bash
rm ui-dashboard/src/components/layout/Header.module.css
```

**Step 3: Verify the header renders correctly**

```bash
cd ui-dashboard && npm run dev
```

Check: logo, nav links, stats, connection dot all visible and styled.

**Step 4: Commit**

```
refactor(ui-dashboard): migrate Header to Tailwind + shadcn
```

---

### Task 8: Migrate Sidebar to Tailwind + shadcn

**Files:**
- Rewrite: `ui-dashboard/src/components/layout/Sidebar.tsx`
- Delete: `ui-dashboard/src/components/layout/Sidebar.module.css`

**Step 1: Rewrite Sidebar.tsx**

Replace CSS Module classes with Tailwind utilities. Use shadcn ScrollArea for the scrollable track/worker lists. Use shadcn Badge for counts.

Key mappings:
- `.sidebar` → `h-full flex flex-col border-r border-border bg-bg-secondary overflow-hidden`
- `.section` → `px-3 py-3 border-b border-border`
- `.trackItem` → `flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-[13px] text-text-secondary hover:bg-bg-tertiary`
- `.trackItem.active` → add `bg-bg-tertiary text-text-primary border-l-2 border-accent`
- `.workerStatus` → `w-2 h-2 rounded-full` with status-specific colors

**Step 2: Delete Sidebar.module.css**

**Step 3: Verify sidebar renders**

**Step 4: Commit**

```
refactor(ui-dashboard): migrate Sidebar to Tailwind + shadcn
```

---

### Task 9: Migrate ContextPanel to Tailwind + shadcn

**Files:**
- Rewrite: `ui-dashboard/src/components/layout/ContextPanel.tsx`
- Delete: `ui-dashboard/src/components/layout/ContextPanel.module.css`

**Step 1: Rewrite ContextPanel.tsx**

Replace CSS Modules with Tailwind. Use shadcn Card for stat cards, Progress for track progress, Badge for status. Keep the ContextSection, ContextRow, TrackContextPanel, TaskContextPanel exports.

**Step 2: Delete ContextPanel.module.css**

**Step 3: Verify context panel renders in ChatView**

**Step 4: Commit**

```
refactor(ui-dashboard): migrate ContextPanel to Tailwind + shadcn
```

---

### Task 10: Replace ThreeColumnLayout usages with ResizableLayout

**Files:**
- Modify: `ui-dashboard/src/views/ChatView.tsx`
- Modify: `ui-dashboard/src/views/BoardView.tsx`
- Modify: `ui-dashboard/src/views/GitView.tsx`
- Modify: `ui-dashboard/src/views/FilesView.tsx`
- Modify: `ui-dashboard/src/views/TimelineView.tsx`
- Modify: `ui-dashboard/src/views/SettingsView.tsx`
- Delete: `ui-dashboard/src/components/layout/ThreeColumnLayout.tsx`
- Delete: `ui-dashboard/src/components/layout/ThreeColumnLayout.module.css`

**Step 1: Update imports in all views**

Change `ThreeColumnLayout` → `ResizableLayout` in every view. The prop names are the same (`sidebar`, `main`, `context`).

**Step 2: Delete old ThreeColumnLayout files**

**Step 3: Verify all views render with resizable panels**

```bash
cd ui-dashboard && npm run dev
```

Navigate to each route: /, /board, /git, /files, /timeline, /settings — all should render with draggable panel dividers.

**Step 4: Commit**

```
refactor(ui-dashboard): replace ThreeColumnLayout with ResizableLayout
```

---

## Phase 4: Feature Component Migration

### Task 11: Migrate ChatView + MessageList + MessageInput to Tailwind

**Files:**
- Rewrite: `ui-dashboard/src/views/ChatView.tsx`
- Rewrite: `ui-dashboard/src/components/features/chat/MessageList.tsx`
- Rewrite: `ui-dashboard/src/components/features/chat/MessageInput.tsx`
- Delete: `ui-dashboard/src/views/ChatView.module.css`
- Delete: `ui-dashboard/src/components/features/chat/MessageList.module.css`
- Delete: `ui-dashboard/src/components/features/chat/MessageInput.module.css`

**Step 1: Rewrite MessageList.tsx with Tailwind**

Replace all CSS Module references. Use shadcn Badge, Card, Avatar from shadcn. Keep the TaskCard, WorkerCard, MessageItem internal components. Use Tailwind for layout/spacing/colors.

**Step 2: Rewrite MessageInput.tsx with Tailwind**

Replace CSS Modules. Use shadcn Button for send button. Use Tailwind for the auto-growing textarea wrapper.

**Step 3: Rewrite ChatView.tsx**

Remove CSS Module import. Use ResizableLayout. The view is mostly composition — should be minimal changes beyond imports.

**Step 4: Delete all 3 CSS Module files**

**Step 5: Verify chat renders and message sending works**

**Step 6: Commit**

```
refactor(ui-dashboard): migrate chat components to Tailwind + shadcn
```

---

### Task 12: Migrate BoardView + TaskBoard to Tailwind + dnd-kit

**Files:**
- Rewrite: `ui-dashboard/src/views/BoardView.tsx`
- Rewrite: `ui-dashboard/src/components/features/board/TaskBoard.tsx`
- Delete: `ui-dashboard/src/components/features/board/TaskBoard.module.css`

**Step 1: Rewrite TaskBoard.tsx with Tailwind + dnd-kit**

Replace CSS Modules with Tailwind. Add basic drag-and-drop using `@dnd-kit/core` and `@dnd-kit/sortable`:
- Wrap the board in `DndContext`
- Each column is a `useDroppable` zone
- Each task card is a `useDraggable` item
- On drag end, call `updateTask` in the store to change status

Use shadcn Badge for status labels, Card for task cards.

**Step 2: Update BoardView.tsx**

Remove CSS Module. Use ResizableLayout.

**Step 3: Delete TaskBoard.module.css**

**Step 4: Verify board renders, drag a card between columns**

**Step 5: Commit**

```
feat(ui-dashboard): migrate board to Tailwind + add dnd-kit drag-drop
```

---

### Task 13: Build Monaco-powered GitView + DiffViewer

Replace the hand-rolled diff viewer with Monaco's built-in diff editor.

**Files:**
- Rewrite: `ui-dashboard/src/components/features/git/WorktreeView.tsx`
- Delete: `ui-dashboard/src/components/features/git/WorktreeView.module.css`
- Modify: `ui-dashboard/src/views/GitView.tsx`

**Step 1: Rewrite WorktreeView.tsx with Monaco diff editor**

Replace the custom diff rendering with Monaco's `DiffEditor` component:
```tsx
import { DiffEditor } from '@monaco-editor/react'

// In the diff section:
<DiffEditor
  height="100%"
  language="typescript"
  original={originalContent}
  modified={modifiedContent}
  theme="vs-dark"
  options={{
    readOnly: true,
    renderSideBySide: true,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    fontSize: 13,
    fontFamily: 'var(--font-mono)',
  }}
/>
```

Keep the worktree sidebar list with Tailwind classes. Use shadcn Badge for branch status.

**Step 2: Update GitView.tsx to use ResizableLayout**

**Step 3: Delete WorktreeView.module.css**

**Step 4: Verify diff renders with Monaco**

```bash
cd ui-dashboard && npm run dev
```

Navigate to /git — should see Monaco diff editor with syntax highlighting.

**Step 5: Commit**

```
feat(ui-dashboard): replace hand-rolled diff viewer with Monaco DiffEditor
```

---

### Task 14: Build FilesView with Monaco + react-arborist

Replace the placeholder with a working file browser + code editor.

**Files:**
- Rewrite: `ui-dashboard/src/views/FilesView.tsx`
- Delete: `ui-dashboard/src/views/FilesView.module.css`

**Step 1: Build FilesView with file tree + editor**

Layout: ResizableLayout with:
- **Sidebar:** `react-arborist` Tree component showing project file structure
- **Main:** Monaco Editor showing selected file content
- **Context (optional):** File metadata panel

```tsx
import { Tree } from 'react-arborist'
import Editor from '@monaco-editor/react'

// File tree in sidebar
<Tree
  data={fileTreeData}
  width="100%"
  height={containerHeight}
  indent={16}
  rowHeight={28}
  onSelect={(nodes) => {
    if (nodes[0]?.data) setSelectedFile(nodes[0].data)
  }}
>
  {FileNode}
</Tree>

// Monaco editor in main
<Editor
  height="100%"
  language={detectLanguage(selectedFile.path)}
  value={selectedFile.content}
  theme="vs-dark"
  options={{
    readOnly: true,
    minimap: { enabled: true },
    fontSize: 13,
    fontFamily: 'var(--font-mono)',
    scrollBeyondLastLine: false,
    wordWrap: 'on',
  }}
/>
```

Use mock file tree data for now (matching the existing mock data pattern).

**Step 2: Add mock file tree data to mockData.ts**

Add a `mockFileTree` export with a sample project structure.

**Step 3: Verify file browser renders**

Navigate to /files — should see tree on left, editor on right.

**Step 4: Commit**

```
feat(ui-dashboard): build FilesView with react-arborist + Monaco Editor
```

---

### Task 15: Migrate ReviewQueueView to Tailwind + shadcn

**Files:**
- Rewrite: `ui-dashboard/src/views/ReviewQueueView.tsx`
- Delete: `ui-dashboard/src/views/ReviewQueueView.module.css`

**Step 1: Rewrite with Tailwind + shadcn**

Use shadcn Tabs for the status filter tabs. Use shadcn Badge, Button, Card for the review items and detail view. Use shadcn ScrollArea for the review list. Use Monaco DiffEditor for showing review diffs (connect to review's diff data).

**Step 2: Delete ReviewQueueView.module.css**

**Step 3: Verify reviews render with tabs, list, and detail**

**Step 4: Commit**

```
refactor(ui-dashboard): migrate ReviewQueueView to Tailwind + shadcn
```

---

### Task 16: Migrate TimelineView to Tailwind

**Files:**
- Rewrite: `ui-dashboard/src/views/TimelineView.tsx`
- Delete: `ui-dashboard/src/views/TimelineView.module.css`

**Step 1: Rewrite with Tailwind**

Replace all CSS Module classes and inline styles with Tailwind utilities. Use shadcn Badge for event type/status labels. Use shadcn Card for the stats panel in the context area.

**Step 2: Delete TimelineView.module.css**

**Step 3: Verify timeline renders**

**Step 4: Commit**

```
refactor(ui-dashboard): migrate TimelineView to Tailwind + shadcn
```

---

### Task 17: Migrate SettingsView to Tailwind + shadcn

**Files:**
- Rewrite: `ui-dashboard/src/views/SettingsView.tsx`
- Delete: `ui-dashboard/src/views/SettingsView.module.css`

**Step 1: Rewrite with shadcn form components**

Use shadcn Select for dropdowns, Input for text/number fields, Switch for toggles (replacing custom CSS toggle), Button for actions. Use Tailwind for layout.

**Step 2: Delete SettingsView.module.css**

**Step 3: Verify settings page renders with working toggles**

**Step 4: Commit**

```
refactor(ui-dashboard): migrate SettingsView to Tailwind + shadcn
```

---

### Task 18: Add Terminal component with xterm.js

**Files:**
- Create: `ui-dashboard/src/components/features/terminal/Terminal.tsx`
- Create: `ui-dashboard/src/components/features/terminal/index.ts`

**Step 1: Build Terminal component**

```tsx
import { useEffect, useRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'

interface TerminalProps {
  className?: string
}

export function Terminal({ className }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<XTerm | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const terminal = new XTerm({
      theme: {
        background: '#0d1117',
        foreground: '#c9d1d9',
        cursor: '#58a6ff',
        selectionBackground: 'rgba(88, 166, 255, 0.3)',
        black: '#484f58',
        red: '#f85149',
        green: '#3fb950',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#a371f7',
        cyan: '#56d4dd',
        white: '#c9d1d9',
      },
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 13,
      cursorBlink: true,
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.loadAddon(new WebLinksAddon())

    terminal.open(containerRef.current)
    fitAddon.fit()

    terminalRef.current = terminal

    const resizeObserver = new ResizeObserver(() => fitAddon.fit())
    resizeObserver.observe(containerRef.current)

    // Write welcome message
    terminal.writeln('\x1b[1;34m● OpenClaw Terminal\x1b[0m')
    terminal.writeln('')

    return () => {
      resizeObserver.disconnect()
      terminal.dispose()
    }
  }, [])

  return <div ref={containerRef} className={cn('h-full w-full', className)} />
}
```

**Step 2: Integrate into ChatView as bottom panel**

Update `ChatView.tsx` to pass `terminal={<Terminal />}` to `ResizableLayout`.

**Step 3: Verify terminal renders below chat**

```bash
cd ui-dashboard && npm run dev
```

Navigate to / — should see chat area with a resizable terminal panel below.

**Step 4: Commit**

```
feat(ui-dashboard): add xterm.js Terminal component
```

---

## Phase 5: Cleanup

### Task 19: Delete old CSS Modules and custom UI components

**Files:**
- Delete: `ui-dashboard/src/styles/variables.css` (tokens now in tailwind.css)
- Delete: `ui-dashboard/src/styles/reset.css` (Tailwind preflight handles this)
- Delete: `ui-dashboard/src/styles/global.css` (merged into tailwind.css)
- Delete: `ui-dashboard/src/index.css`
- Delete: `ui-dashboard/src/App.css`
- Delete: `ui-dashboard/src/views/PlaceholderView.tsx`
- Delete: `ui-dashboard/src/views/PlaceholderView.module.css`
- Delete: All old custom UI component CSS modules that were replaced:
  - `Button.module.css`, `Badge.module.css`, `Avatar.module.css`, `Card.module.css`
  - `Input.module.css`, `TextArea.module.css`, `Select.module.css`, `Tabs.module.css`
  - `Progress.module.css`
- Delete: Old custom component TSX files replaced by shadcn versions:
  - Old `Button.tsx`, `Badge.tsx`, `Avatar.tsx`, `Card.tsx`, `Input.tsx`
  - Old `TextArea.tsx`, `Select.tsx`, `Tabs.tsx`, `Progress.tsx`
  - `Icon.tsx` (replaced by lucide-react icons)
- Modify: `ui-dashboard/src/components/ui/index.ts` — re-export shadcn components

**Step 1: Delete all files listed above**

**Step 2: Update ui/index.ts to export shadcn components**

```ts
export { Button } from './button'
export { Badge } from './badge'
export { Avatar, AvatarFallback, AvatarImage } from './avatar'
export { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from './card'
export { Input } from './input'
export { Textarea } from './textarea'
export { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs'
export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './select'
export { Progress } from './progress'
export { ScrollArea } from './scroll-area'
export { Separator } from './separator'
export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from './tooltip'
export { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './dialog'
export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from './dropdown-menu'
export { Sheet, SheetTrigger, SheetContent } from './sheet'
```

**Step 3: Verify full build succeeds with no dead imports**

```bash
cd ui-dashboard && npm run build
```

Fix any remaining import errors.

**Step 4: Commit**

```
refactor(ui-dashboard): remove old CSS Modules and custom components
```

---

### Task 20: Update App.tsx routing and ErrorBoundary

**Files:**
- Modify: `ui-dashboard/src/App.tsx`
- Modify: `ui-dashboard/src/components/ErrorBoundary.tsx`

**Step 1: Clean up App.tsx**

Remove `App.css` import. Convert inline error styles to Tailwind. Remove `PlaceholderView` references. Ensure all routes use the migrated views.

**Step 2: Update ErrorBoundary.tsx with Tailwind**

Replace any inline styles or CSS Module usage with Tailwind utility classes.

**Step 3: Verify full app navigation**

```bash
cd ui-dashboard && npm run dev
```

Test every route: /, /board, /git, /files, /timeline, /reviews, /settings.

**Step 4: Commit**

```
refactor(ui-dashboard): clean up App.tsx and ErrorBoundary
```

---

### Task 21: Delete development artifacts

**Files:**
- Delete: `ui-dashboard/debug-screenshot.png`
- Delete: `ui-dashboard/test-render.html`

**Step 1: Remove the files**

```bash
rm ui-dashboard/debug-screenshot.png ui-dashboard/test-render.html
```

**Step 2: Commit**

```
chore(ui-dashboard): remove development artifacts
```

---

### Task 22: Final verification

**Step 1: Full build**

```bash
cd ui-dashboard && npm run build
```

Must succeed with zero errors.

**Step 2: Dev server smoke test**

```bash
cd ui-dashboard && npm run dev
```

Visit every route. Verify:
- [ ] Header navigation works, connection status shows
- [ ] Chat: messages display, input works, terminal panel visible
- [ ] Board: Kanban columns render, drag-drop works between columns
- [ ] Git: worktree list renders, Monaco diff editor shows diffs
- [ ] Files: file tree renders, clicking a file shows it in Monaco editor
- [ ] Timeline: events chronologically listed
- [ ] Reviews: tab filtering works, review detail shows
- [ ] Settings: toggles, dropdowns, inputs all functional
- [ ] All panels are resizable via drag handles
- [ ] Dark theme consistent throughout

**Step 3: Final commit**

```
feat(ui-dashboard): complete migration to shadcn/ui + Tailwind + IDE libraries
```
