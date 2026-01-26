# Run History View - UI Prototype

**Generated:** 2025-01-26
**Component:** Run History Table with Expandable Details
**Magic MCP Response:** Full table component with filtering, pagination, and expandable rows

---

## ⚠️ Stack Translation Required

**Magic MCP Output:** React + shadcn/ui Table component
**Clawdbot Stack:** Lit Web Components + Tailwind v4 + Custom Design System

The code below provides **design patterns, styling, and UX concepts** but must be translated from React to Lit Web Components for Clawdbot.

### Key Translation Points:
- React Table → `<table>` with Tailwind classes or custom Lit table element
- Expandable rows → Lit reactive state with CSS transitions
- Pagination buttons → Reactive page state in Lit
- Filters → Event listeners on input changes in Lit
- Collapsible details → CSS `display: none` toggle with animations

---

## Installation

```bash
npm install lucide-react @radix-ui/react-slot class-variance-authority @radix-ui/react-select @radix-ui/react-separator clsx tailwind-merge
```

---

## Main History View Component

```typescript
import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Clock,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Download,
  FileText,
  Filter,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';

// TypeScript Interfaces
interface Artifact {
  id: string;
  name: string;
  type: string;
  size: string;
  url: string;
}

interface TimelineEvent {
  timestamp: string;
  action: string;
  status: 'success' | 'warning' | 'error';
  details: string;
}

interface ConflictDetail {
  type: string;
  description: string;
  resolution: string;
}

interface ExecutionRecord {
  id: string;
  timestamp: string;
  duration: string;
  status: 'success' | 'failed' | 'warning' | 'running';
  summary: string;
  artifacts: Artifact[];
  timeline: TimelineEvent[];
  conflicts: ConflictDetail[];
  aiModel: {
    name: string;
    version: string;
    tokensUsed: number;
    cost: string;
  };
}

// Status Configuration
const statusConfig = {
  success: { color: 'bg-green-500/10 text-green-700 border-green-500/20', icon: CheckCircle2 },
  failed: { color: 'bg-red-500/10 text-red-700 border-red-500/20', icon: XCircle },
  warning: { color: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20', icon: AlertCircle },
  running: { color: 'bg-blue-500/10 text-blue-700 border-blue-500/20', icon: Clock },
};

// Main Component
const RunHistoryView: React.FC = () => {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const itemsPerPage = 20;

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const filteredData = mockData.filter(record => {
    if (statusFilter !== 'all' && record.status !== statusFilter) return false;
    if (dateFrom && record.timestamp < dateFrom) return false;
    if (dateTo && record.timestamp > dateTo) return false;
    return true;
  });

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage);

  const getStatusBadge = (status: ExecutionRecord['status']) => {
    const config = statusConfig[status];
    const Icon = config.icon;
    return (
      <Badge variant="outline" className={`${config.color} flex items-center gap-1 w-fit`}>
        <Icon className="w-3 h-3" />
        <span className="capitalize">{status}</span>
      </Badge>
    );
  };

  const getTimelineStatusColor = (status: TimelineEvent['status']) => {
    switch (status) {
      case 'success': return 'bg-green-500';
      case 'warning': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="w-full min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Run History</h1>
            <p className="text-muted-foreground mt-1">View and analyze past automation executions</p>
          </div>
        </div>

        {/* Filter Card */}
        <Card className="p-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters:</span>
            </div>

            {/* Date Range */}
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-40"
                placeholder="From"
              />
              <span className="text-muted-foreground">to</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-40"
                placeholder="To"
              />
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="running">Running</SelectItem>
              </SelectContent>
            </Select>

            {/* Clear Filters Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStatusFilter('all');
                setDateFrom('');
                setDateTo('');
              }}
            >
              Clear Filters
            </Button>
          </div>
        </Card>

        {/* History Table */}
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Summary</TableHead>
                <TableHead>Artifacts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.map((record) => (
                <React.Fragment key={record.id}>
                  {/* Main Row (clickable to expand) */}
                  <TableRow className="cursor-pointer hover:bg-muted/50">
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleRow(record.id)}
                        className="p-0 h-8 w-8"
                      >
                        {expandedRows.has(record.id) ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{record.timestamp}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span className="text-sm">{record.duration}</span>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(record.status)}</TableCell>
                    <TableCell className="max-w-md">
                      <p className="text-sm truncate">{record.summary}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono">
                        {record.artifacts.length} files
                      </Badge>
                    </TableCell>
                  </TableRow>

                  {/* Expanded Details Row */}
                  {expandedRows.has(record.id) && (
                    <TableRow>
                      <TableCell colSpan={6} className="bg-muted/30 p-6">
                        <div className="space-y-6">
                          {/* Two Column Layout */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                            {/* Left Column: Timeline + Conflicts */}
                            <div className="space-y-4">
                              {/* Execution Timeline */}
                              <div>
                                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                  <Clock className="w-4 h-4" />
                                  Execution Timeline
                                </h3>
                                <div className="space-y-3">
                                  {record.timeline.map((event, idx) => (
                                    <div key={idx} className="flex gap-3">
                                      <div className="flex flex-col items-center">
                                        {/* Timeline dot + connecting line */}
                                        <div className={`w-2 h-2 rounded-full ${getTimelineStatusColor(event.status)}`} />
                                        {idx < record.timeline.length - 1 && (
                                          <div className="w-0.5 h-full bg-border mt-1" />
                                        )}
                                      </div>
                                      <div className="flex-1 pb-4">
                                        <div className="flex items-center gap-2 mb-1">
                                          <span className="text-xs font-mono text-muted-foreground">
                                            {event.timestamp}
                                          </span>
                                          <span className="text-sm font-medium">{event.action}</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground">{event.details}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Conflict Details (if any) */}
                              {record.conflicts.length > 0 && (
                                <div>
                                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4" />
                                    Conflict Details
                                  </h3>
                                  <div className="space-y-2">
                                    {record.conflicts.map((conflict, idx) => (
                                      <div key={idx} className="bg-background rounded-lg p-3 border">
                                        <div className="flex items-start gap-2">
                                          <Badge variant="outline" className="text-xs">
                                            {conflict.type}
                                          </Badge>
                                        </div>
                                        <div>
                                          <p className="text-sm mt-2">{conflict.description}</p>
                                          <p className="text-xs text-muted-foreground mt-1">
                                            <span className="font-medium">Resolution:</span> {conflict.resolution}
                                          </p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Right Column: AI Info + Artifacts */}
                            <div className="space-y-4">
                              {/* AI Model Information */}
                              <div>
                                <h3 className="text-sm font-semibold mb-3">AI Model Information</h3>
                                <div className="bg-background rounded-lg p-4 border space-y-2">
                                  <div className="flex justify-between">
                                    <span className="text-sm text-muted-foreground">Model:</span>
                                    <span className="text-sm font-medium">{record.aiModel.name}</span>
                                  </div>
                                  <Separator />
                                  <div className="flex justify-between">
                                    <span className="text-sm text-muted-foreground">Version:</span>
                                    <span className="text-sm font-mono">{record.aiModel.version}</span>
                                  </div>
                                  <Separator />
                                  <div className="flex justify-between">
                                    <span className="text-sm text-muted-foreground">Tokens Used:</span>
                                    <span className="text-sm font-mono">{record.aiModel.tokensUsed.toLocaleString()}</span>
                                  </div>
                                  <Separator />
                                  <div className="flex justify-between">
                                    <span className="text-sm text-muted-foreground">Cost:</span>
                                    <span className="text-sm font-medium">{record.aiModel.cost}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Artifacts */}
                              <div>
                                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                  <FileText className="w-4 h-4" />
                                  Artifacts
                                </h3>
                                <div className="space-y-2">
                                  {record.artifacts.map((artifact) => (
                                    <div
                                      key={artifact.id}
                                      className="bg-background rounded-lg p-3 border flex items-center justify-between hover:bg-muted/50 transition-colors"
                                    >
                                      <div className="flex items-center gap-3">
                                        <FileText className="w-4 h-4 text-muted-foreground" />
                                        <div>
                                          <p className="text-sm font-medium">{artifact.name}</p>
                                          <p className="text-xs text-muted-foreground">
                                            {artifact.type.toUpperCase()} • {artifact.size}
                                          </p>
                                        </div>
                                      </div>
                                      <Button variant="ghost" size="sm">
                                        <Download className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>

          {/* Empty State */}
          {paginatedData.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No execution records found</p>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredData.length)} of{' '}
                {filteredData.length} results
              </div>
              <div className="flex items-center gap-2">
                {/* Previous Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Button>

                {/* Page Numbers */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    // Smart page number display logic
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setCurrentPage(pageNum)}
                        className="w-8 h-8 p-0"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>

                {/* Next Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default RunHistoryView;
```

---

## Key Features Captured

### Filter Controls
1. **Date Range Picker** - From/To date inputs for filtering by date range
2. **Status Dropdown** - Filter by execution status (All/Success/Failed/Warning/Running)
3. **Clear Filters Button** - Reset all filters to default

### Table Columns
1. **Expand Toggle** - Chevron up/down button to expand row details
2. **Timestamp** - Formatted date string
3. **Duration** - Time elapsed with clock icon
4. **Status Badge** - Color-coded badge with icon
5. **Summary** - One-line description of execution
6. **Artifacts Count** - Number of artifacts produced

### Expanded Details Section
1. **Execution Timeline** - Vertical timeline with colored dots, connecting lines, timestamps
2. **Conflict Details** - Shows conflict type, description, resolution (when applicable)
3. **AI Model Info** - Model name, version, tokens used, cost
4. **Artifacts List** - Downloadable files with type, size, and name

### Status Colors
- **Success**: Green background, checkmark icon
- **Failed**: Red background, X icon
- **Warning**: Yellow background, alert triangle icon
- **Running**: Blue background, clock icon

### Timeline Visuals
- Colored dots (green/yellow/red/gray) for each event status
- Vertical connecting lines between timeline events
- Timestamp + action label + details for each event

### Pagination
- Smart page number display (shows max 5 page numbers)
- Previous/Next buttons with disabled states
- Results count display ("Showing 1 to 20 of 156 results")

---

## Smart-Sync Fork Specific Fields

For Git fork sync automation runs, the expanded details should show:

```typescript
interface GitSyncExecutionRecord extends ExecutionRecord {
  // Basic fields (inherited)
  id: string;
  timestamp: string;
  duration: string;
  status: 'success' | 'partial' | 'failed';
  summary: string;

  // Git-specific artifacts
  artifacts: [
    { id: 'art-1', name: 'feature-branch', type: 'branch', url: 'https://github.com/user/repo/tree/branch' },
    { id: 'art-2', name: 'PR #123', type: 'pr', url: 'https://github.com/user/repo/pull/123' },
    { id: 'art-3', name: 'run-log.txt', type: 'log', url: '/api/logs/automation-run-id.log' },
  ];

  // Git-specific timeline
  timeline: [
    { timestamp: '10:30:15', action: 'Clone Repository', status: 'success', details: 'Cloned from git@github.com:user/repo.git' },
    { timestamp: '10:30:30', action: 'Fetch Upstream', status: 'success', details: 'Fetched 15 commits from upstream' },
    { timestamp: '10:31:00', action: 'Merge Detected', status: 'warning', details: 'Found 5 merge conflicts' },
    { timestamp: '10:32:15', action: 'Conflicts Resolved', status: 'success', details: 'Resolved 4 conflicts, 1 requires attention' },
    { timestamp: '10:33:00', action: 'Pushed Branch', status: 'success', details: 'Pushed to smart-sync/auto-sync-timestamp' },
    { timestamp: '10:33:15', action: 'PR Created', status: 'success', details: 'Opened PR #123' },
  ];

  // Conflict details
  conflicts: [
    {
      type: 'Merge Conflict',
      description: 'src/core/processor.ts - Conflicting changes in function signature',
      resolution: 'Accepted upstream version, preserved local additions'
    },
    {
      type: 'Uncertain Resolution',
      description: 'package.json - Dependency version conflict',
      resolution: 'Flagged for review - not auto-resolved'
    },
  ];

  // AI information
  aiModel: {
    name: 'claude-opus-4-5-20251101',
    version: 'latest',
    tokensUsed: 12450,
    cost: '$0.08',
  };
}
```

---

## Empty State

```html
<!-- When no history exists -->
<div class="text-center py-12">
  <svg class="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M12 8v4l-6 6" />
  </svg>
  <h3 class="text-lg font-semibold text-foreground mb-2">No run history yet</h3>
  <p class="text-muted-foreground">
    This automation hasn't been executed yet. Run it manually to see history here.
  </p>
</div>
```

---

## Responsive Behavior

- **Desktop (< 768px)**: Full table with all columns, two-column detail layout
- **Tablet (< 1024px)**: Hide less important columns, single column details
- **Mobile**: Stacked layout, full-width cards instead of table

---

## CSS Animations for Expand/Collapse

```css
/* Expandable row animation */
.expanded-row {
  animation: expand-row 0.3s ease-out;
}

@keyframes expand-row {
  from {
    max-height: 0;
    opacity: 0;
  }
  to {
    max-height: 1000px;
    opacity: 1;
  }
}

/* Chevron rotation */
.chevron {
  transition: transform 0.2s ease;
}

.chevron.up {
  transform: rotate(180deg);
}
```

---

## Lit Web Component Structure

```typescript
@customElement('run-history-view')
export class RunHistoryView extends LitElement {
  @state() private expandedRows: Set<string> = new Set();
  @state() private currentPage = 1;
  @state() private statusFilter = 'all';
  @state() private dateFrom = '';
  @state() private dateTo = '';
  @state() private data: ExecutionRecord[] = [];

  // Per-page items
  @state() private itemsPerPage = 20;

  // Computed properties
  private get totalPages(): number {
    return Math.ceil(this.data.length / this.itemsPerPage);
  }

  private get filteredData(): ExecutionRecord[] {
    return this.data.filter(record => {
      if (this.statusFilter !== 'all' && record.status !== this.statusFilter) return false;
      if (this.dateFrom && record.timestamp < this.dateFrom) return false;
      if (this.dateTo && record.timestamp > this.dateTo) return false;
      return true;
    });
  }

  private get paginatedData(): ExecutionRecord[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredData.slice(startIndex, startIndex + this.itemsPerPage);
  }

  // Event handlers
  private toggleRow(id: string) {
    if (this.expandedRows.has(id)) {
      this.expandedRows.delete(id);
    } else {
      this.expandedRows.add(id);
    }
    this.requestUpdate();
  }

  private goToPage(page: number) {
    this.currentPage = page;
  }

  // Render method would create the table structure
  // Using Lit's html template tag with reactive properties
}
```

---

## API Integration Notes

```typescript
// Fetch run history from Clawdbot API
const fetchRunHistory = async (automationId: string, limit = 50) => {
  const response = await fetch(`/api/automations/${automationId}/history?limit=${limit}`);
  return response.json();
};

// Real-time updates via SSE (optional)
const subscribeToUpdates = (automationId: string) => {
  const eventSource = new EventSource(`/api/automations/${automationId}/history/stream`);
  eventSource.onmessage = (event) => {
    const newRecord = JSON.parse(event.data);
    // Prepend to data array, maintain max limit
  };
};
```
