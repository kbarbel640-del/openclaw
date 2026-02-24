# SDD 62 -- UX Quality Assurance Checklist

**Version:** 1.0
**Date:** 2026-02-24
**Scope:** Ted Workbench (VS Code extension webview), 26 operator surface cards, Lit HTML templates
**Methodology:** Composite checklist derived from six authoritative UX/accessibility frameworks

---

## Framework Sources

| #   | Source                                          | Focus Area                                     |
| --- | ----------------------------------------------- | ---------------------------------------------- |
| 1   | Nielsen Norman Group -- 10 Usability Heuristics | General usability evaluation                   |
| 2   | Google Material Design 3                        | Component quality, interaction patterns        |
| 3   | Microsoft VS Code Extension UX Guidelines       | Extension-specific constraints and patterns    |
| 4   | W3C WCAG 2.1 (Level AA)                         | Accessibility compliance                       |
| 5   | Baymard Institute UX Audit Methodology          | Task-flow analysis, enterprise dashboards      |
| 6   | Apple Human Interface Guidelines                | Self-explanatory design, information hierarchy |

Additional research domains: Enterprise dashboard UX, SaaS onboarding quality, contextual help patterns, self-explanatory UI design.

---

## Scoring Rubric

Each checklist item is scored as:

| Score       | Meaning            | Criteria                                                                    |
| ----------- | ------------------ | --------------------------------------------------------------------------- |
| **PASS**    | Meets the standard | No user confusion, no accessibility violation, behavior matches expectation |
| **PARTIAL** | Partially meets    | Some cases handled, others missing; minor friction but not blocking         |
| **FAIL**    | Does not meet      | User confusion likely, accessibility violation, or missing entirely         |
| **N/A**     | Not applicable     | Item does not apply to this surface/context                                 |

**Severity ratings for FAIL/PARTIAL items:**

| Severity        | Impact                                                |
| --------------- | ----------------------------------------------------- |
| **S1-CRITICAL** | Blocks task completion or causes data loss            |
| **S2-HIGH**     | Causes significant confusion or accessibility barrier |
| **S3-MEDIUM**   | Adds friction but workaround exists                   |
| **S4-LOW**      | Cosmetic or minor annoyance                           |

---

## Category 1: Visibility of System Status

_Source: Nielsen Norman Group Heuristic #1; Material Design feedback principles; VS Code UX Guidelines (status indicators)_

### 1.1 Loading States

| ID    | Checklist Item                                                                                     | Score | Notes |
| ----- | -------------------------------------------------------------------------------------------------- | ----- | ----- |
| V-001 | Every async operation displays a loading indicator within 100ms of initiation                      |       |       |
| V-002 | Loading indicators are proximate to the content they replace (not global-only)                     |       |       |
| V-003 | Long operations (>2s) show a progress indicator or explanatory message, not just a spinner         |       |       |
| V-004 | Skeleton screens or shimmer placeholders are used for content-heavy cards (vs. blank space)        |       |       |
| V-005 | Loading state prevents duplicate submissions (buttons disabled or visually suppressed during load) |       |       |
| V-006 | Timeout states display a clear message with retry affordance (not silent failure)                  |       |       |

### 1.2 Success/Error Feedback

| ID    | Checklist Item                                                                                       | Score | Notes |
| ----- | ---------------------------------------------------------------------------------------------------- | ----- | ----- |
| V-010 | Every user action (save, approve, reject, run) displays success confirmation                         |       |       |
| V-011 | Success messages auto-dismiss after 3-5s OR provide manual dismiss                                   |       |       |
| V-012 | Error messages are specific (what failed, why, and what to do) -- not generic "Something went wrong" |       |       |
| V-013 | Error messages persist until user acknowledges them (no auto-dismiss for errors)                     |       |       |
| V-014 | Network/sidecar connection state is visible at all times (connected/disconnected/reconnecting)       |       |       |
| V-015 | Stale data is visually indicated (e.g., "Last updated 5m ago" timestamp on cards)                    |       |       |
| V-016 | Partial failures surface clearly (e.g., "3 of 5 items synced" vs silent partial success)             |       |       |

### 1.3 Background Operations

| ID    | Checklist Item                                                              | Score | Notes |
| ----- | --------------------------------------------------------------------------- | ----- | ----- |
| V-020 | Scheduler status is visible (running/stopped, next scheduled run)           |       |       |
| V-021 | Background ingestion cycle status is visible (active/idle, items processed) |       |       |
| V-022 | Self-healing operations surface their status without operator intervention  |       |       |
| V-023 | Queued operations show position/count (e.g., draft queue depth)             |       |       |

---

## Category 2: Match Between System and Real World

_Source: Nielsen Norman Group Heuristic #2; Apple HIG (familiar terminology); Baymard (domain-appropriate language)_

| ID     | Checklist Item                                                                                                                  | Score | Notes |
| ------ | ------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| RW-001 | All labels use the operator's domain language (deals, commitments, actions) -- not internal system terms (JSONL, ledger, mutex) |       |       |
| RW-002 | Date/time formats match the operator's locale and include relative time ("2 hours ago") where useful                            |       |       |
| RW-003 | Icons are standard and universally recognized (no abstract/custom icons without labels)                                         |       |       |
| RW-004 | Status labels use plain language ("Ready", "Waiting for approval") -- not codes ("PENDING_REVIEW")                              |       |       |
| RW-005 | Error messages avoid internal jargon (no "JSONL parse failed" -- instead "Could not read saved data")                           |       |       |
| RW-006 | Units are human-readable (file sizes as "1.2 MB", durations as "3 min 20s")                                                     |       |       |
| RW-007 | Empty states use encouraging, actionable language ("No deals yet. Create your first deal to get started.")                      |       |       |
| RW-008 | Numerical data includes context (percentages show what they measure, counts show what they count)                               |       |       |

---

## Category 3: User Control and Freedom

_Source: Nielsen Norman Group Heuristic #3; Material Design (undo patterns); VS Code UX Guidelines (reversible actions)_

| ID     | Checklist Item                                                                                              | Score | Notes |
| ------ | ----------------------------------------------------------------------------------------------------------- | ----- | ----- |
| UC-001 | Destructive actions (delete, archive, reject) require confirmation dialog                                   |       |       |
| UC-002 | Non-destructive actions are immediately reversible (undo within 5-10s) OR require confirmation              |       |       |
| UC-003 | Navigation state is preserved when switching between workbench sections (operate/build/govern/intake/evals) |       |       |
| UC-004 | Form state is preserved when navigating away and back (no silent data loss)                                 |       |       |
| UC-005 | Every modal/dialog has a clear close/cancel mechanism                                                       |       |       |
| UC-006 | Batch operations (approve all, dismiss all) have undo or confirmation                                       |       |       |
| UC-007 | Filter/sort state persists within a session                                                                 |       |       |
| UC-008 | The operator can cancel in-progress operations (e.g., abort a morning brief generation)                     |       |       |
| UC-009 | Keyboard shortcut for "go back" or "cancel" works in all contexts (Escape key)                              |       |       |

---

## Category 4: Consistency and Standards

_Source: Nielsen Norman Group Heuristic #4; Material Design (component consistency); VS Code UX Guidelines (VS Code conventions); Apple HIG (platform conventions)_

### 4.1 Visual Consistency

| ID     | Checklist Item                                                                                                | Score | Notes |
| ------ | ------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| CS-001 | All cards use the same visual structure (header, body, footer/actions)                                        |       |       |
| CS-002 | Typography hierarchy is consistent (same heading sizes, body text, captions across all cards)                 |       |       |
| CS-003 | Color coding is consistent (same color for same meaning everywhere: error=red, success=green, warning=yellow) |       |       |
| CS-004 | Spacing and padding are consistent across all cards and sections                                              |       |       |
| CS-005 | Button styles are consistent (primary, secondary, destructive use same styling everywhere)                    |       |       |
| CS-006 | All data tables use the same column alignment, header style, and row spacing                                  |       |       |

### 4.2 Interaction Consistency

| ID     | Checklist Item                                                                                          | Score | Notes |
| ------ | ------------------------------------------------------------------------------------------------------- | ----- | ----- |
| CS-010 | Similar actions use the same interaction pattern (all "load" buttons work identically)                  |       |       |
| CS-011 | Error handling follows the same pattern across all cards (same placement, same styling)                 |       |       |
| CS-012 | Loading states use the same indicator type across all cards                                             |       |       |
| CS-013 | Confirmation flows use the same dialog style everywhere                                                 |       |       |
| CS-014 | Input validation feedback is consistent (inline vs. toast vs. banner -- pick one and use it everywhere) |       |       |

### 4.3 VS Code Extension Conventions

| ID     | Checklist Item                                                                                           | Score | Notes |
| ------ | -------------------------------------------------------------------------------------------------------- | ----- | ----- |
| CS-020 | Uses VS Code's CSS custom properties (--vscode-\* tokens) for all colors                                 |       |       |
| CS-021 | Respects the active VS Code theme (light, dark, high contrast)                                           |       |       |
| CS-022 | Uses VS Code Webview UI Toolkit components where appropriate (or visually matches them)                  |       |       |
| CS-023 | Follows VS Code's information architecture: Sidebar for navigation, Panel for output, Editor for editing |       |       |
| CS-024 | Extension activation is fast (<1s) and does not block VS Code startup                                    |       |       |
| CS-025 | Commands are registered in the Command Palette with clear, descriptive names                             |       |       |
| CS-026 | Context menu entries follow VS Code naming conventions (verb-noun)                                       |       |       |
| CS-027 | Status Bar items show only essential, at-a-glance information                                            |       |       |
| CS-028 | Webview content uses VS Code's font family (--vscode-font-family) and size variables                     |       |       |

---

## Category 5: Error Prevention

_Source: Nielsen Norman Group Heuristic #5; Material Design (input constraints); Baymard (form design)_

| ID     | Checklist Item                                                                                     | Score | Notes |
| ------ | -------------------------------------------------------------------------------------------------- | ----- | ----- |
| EP-001 | Form fields with constraints show those constraints before submission (e.g., "Max 500 characters") |       |       |
| EP-002 | Dropdown/select inputs are used instead of free-text where options are known and finite            |       |       |
| EP-003 | Required fields are clearly marked                                                                 |       |       |
| EP-004 | Real-time validation occurs on blur (not just on submit) for fields with known constraints         |       |       |
| EP-005 | Dangerous operations (apply thresholds, save policy) show a preview of changes before execution    |       |       |
| EP-006 | Default values are sensible and clearly indicated as defaults (vs. user-set values)                |       |       |
| EP-007 | Inputs that accept structured data (JSON, cron expressions) have syntax hints or examples          |       |       |
| EP-008 | Concurrent edit detection -- if another session changes data, the UI warns before overwriting      |       |       |
| EP-009 | Auto-save or draft preservation prevents data loss on accidental navigation                        |       |       |
| EP-010 | URL/path inputs are validated for format before submission                                         |       |       |

---

## Category 6: Recognition Rather Than Recall

_Source: Nielsen Norman Group Heuristic #6; Apple HIG (self-explanatory design); Material Design (affordances)_

| ID     | Checklist Item                                                                           | Score | Notes |
| ------ | ---------------------------------------------------------------------------------------- | ----- | ----- |
| RR-001 | All buttons and interactive elements have visible labels (not icon-only without tooltip) |       |       |
| RR-002 | Section headers include brief descriptions of what the section contains                  |       |       |
| RR-003 | Previous selections/inputs are visible when revisiting a card                            |       |       |
| RR-004 | Related information is grouped visually (proximity principle)                            |       |       |
| RR-005 | Key metrics show trend direction (up/down arrow, sparkline) not just current value       |       |       |
| RR-006 | Tooltips explain non-obvious fields or metrics on hover                                  |       |       |
| RR-007 | Navigation shows current location (active section highlighted, breadcrumb if nested)     |       |       |
| RR-008 | Empty states explain what data will appear and how to populate it                        |       |       |
| RR-009 | Status badges show meaning through both color AND text (not color alone)                 |       |       |
| RR-010 | Dropdown menus show the currently selected value                                         |       |       |

---

## Category 7: Flexibility and Efficiency of Use

_Source: Nielsen Norman Group Heuristic #7; VS Code UX Guidelines (keyboard-first design); Baymard (expert user paths)_

| ID     | Checklist Item                                                                    | Score | Notes |
| ------ | --------------------------------------------------------------------------------- | ----- | ----- |
| FE-001 | Keyboard navigation works for all interactive elements (Tab order is logical)     |       |       |
| FE-002 | Primary actions in each card are reachable in 1-2 clicks from the card header     |       |       |
| FE-003 | Frequently-used operations have keyboard shortcuts registered in VS Code          |       |       |
| FE-004 | The "All" section view provides a scannable overview without requiring drill-down |       |       |
| FE-005 | Cards can be collapsed/expanded to manage information density                     |       |       |
| FE-006 | Refresh is available per-card AND globally (not just globally)                    |       |       |
| FE-007 | Data can be copied to clipboard (e.g., JSON payloads, error messages)             |       |       |
| FE-008 | Expert users can access raw data (JSON view toggle) for debugging                 |       |       |
| FE-009 | Batch operations are available where multiple items need the same action          |       |       |
| FE-010 | Search/filter is available on lists with >10 items                                |       |       |

---

## Category 8: Aesthetic and Minimalist Design

_Source: Nielsen Norman Group Heuristic #8; Material Design (content density); Apple HIG (information hierarchy); Baymard (visual weight)_

| ID     | Checklist Item                                                                                                      | Score | Notes |
| ------ | ------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| AM-001 | Cards show summary/headline information first, with details on demand (progressive disclosure)                      |       |       |
| AM-002 | No more than 5-7 primary data points visible per card without scrolling                                             |       |       |
| AM-003 | Visual hierarchy clearly distinguishes: (1) card title, (2) key metric, (3) supporting detail, (4) actions          |       |       |
| AM-004 | Whitespace is used to separate logical groups (not dense walls of data)                                             |       |       |
| AM-005 | Decorative elements do not compete with functional content                                                          |       |       |
| AM-006 | Tables with many columns provide column prioritization (essential columns always visible)                           |       |       |
| AM-007 | Long text is truncated with ellipsis and expandable (not clipped or overflowing)                                    |       |       |
| AM-008 | Status indicators use minimal visual weight (dot + text, not large banners for routine status)                      |       |       |
| AM-009 | The section navigation (operate/build/govern/intake/evals) provides meaningful grouping that reduces cognitive load |       |       |
| AM-010 | Each card earns its screen space -- no cards that show only "No data" as their permanent state                      |       |       |

---

## Category 9: Help Users Recognize, Diagnose, and Recover from Errors

_Source: Nielsen Norman Group Heuristic #9; Material Design (error states); VS Code UX Guidelines (error handling)_

| ID     | Checklist Item                                                                                               | Score | Notes |
| ------ | ------------------------------------------------------------------------------------------------------------ | ----- | ----- |
| ER-001 | Error messages state what happened in plain language                                                         |       |       |
| ER-002 | Error messages suggest a specific corrective action ("Try refreshing" / "Check your connection")             |       |       |
| ER-003 | Errors related to configuration issues link to or name the specific config that needs fixing                 |       |       |
| ER-004 | Network errors distinguish between sidecar-down, auth-expired, and Graph API failures                        |       |       |
| ER-005 | Timeout errors show the timeout duration and offer a retry button                                            |       |       |
| ER-006 | Validation errors highlight the specific field that failed (not just a banner at the top)                    |       |       |
| ER-007 | Errors do not destroy user input (form state preserved after submission failure)                             |       |       |
| ER-008 | Repeated errors (e.g., sidecar not responding) collapse into a single persistent banner rather than stacking |       |       |
| ER-009 | Error state includes a "Report Issue" or "Copy Error Details" action for escalation                          |       |       |
| ER-010 | Auth token expiry shows a clear "Re-authenticate" button rather than cryptic 401 messages                    |       |       |

---

## Category 10: Help and Documentation

_Source: Nielsen Norman Group Heuristic #10; Apple HIG (contextual help); Baymard (onboarding); SaaS best practices_

### 10.1 Contextual Help

| ID     | Checklist Item                                                                         | Score | Notes |
| ------ | -------------------------------------------------------------------------------------- | ----- | ----- |
| HD-001 | Each card/section has a brief explanatory subtitle or help text explaining its purpose |       |       |
| HD-002 | Complex fields have inline help text (below the input, not just in a tooltip)          |       |       |
| HD-003 | Abbreviations and domain terms have tooltips with definitions                          |       |       |
| HD-004 | "What's this?" or info icons link to relevant documentation for advanced features      |       |       |
| HD-005 | First-time use of a feature shows an onboarding hint or empty state guide              |       |       |

### 10.2 Onboarding Experience

| ID     | Checklist Item                                                                                                            | Score | Notes |
| ------ | ------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| HD-010 | First launch shows a clear "Getting Started" flow (not a blank/error dashboard)                                           |       |       |
| HD-011 | Setup validation (ted-setup.sh / onboarding/validate) results are displayed in the UI with clear pass/fail                |       |       |
| HD-012 | Missing prerequisites (sidecar not running, no Graph credentials) show specific setup instructions                        |       |       |
| HD-013 | The Day 1 / Day 7 / Day 30 adoption path (per Operator Adoption Playbook) is reflected in the UI's progressive complexity |       |       |
| HD-014 | New features or newly-available cards are indicated (e.g., "New" badge or highlight)                                      |       |       |

### 10.3 Self-Explanatory Design

| ID     | Checklist Item                                                                                        | Score | Notes |
| ------ | ----------------------------------------------------------------------------------------------------- | ----- | ----- |
| HD-020 | A first-time user can understand each card's purpose without external documentation                   |       |       |
| HD-021 | Every action button's outcome is predictable from its label (no surprises)                            |       |       |
| HD-022 | The relationship between cards is visible (e.g., commitments derive from meetings)                    |       |       |
| HD-023 | The operator can understand the system's current mode/state (autonomy level, quiet hours) at a glance |       |       |
| HD-024 | Configuration changes show their effect before being applied (preview functionality)                  |       |       |

---

## Category 11: WCAG 2.1 Level AA Accessibility

_Source: W3C Web Content Accessibility Guidelines 2.1, Level AA success criteria_

### 11.1 Perceivable

| ID      | Checklist Item                                                                                                                             | Score | Notes |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----- | ----- |
| A11-001 | All non-text content (icons, images, charts) has text alternatives (alt text, aria-label)                                                  |       |       |
| A11-002 | Color is not the sole means of conveying information (always paired with text/icon/pattern)                                                |       |       |
| A11-003 | Text contrast ratio meets 4.5:1 minimum (normal text) and 3:1 (large text/UI components) against background                                |       |       |
| A11-004 | Content is readable and functional at 200% zoom without horizontal scrolling                                                               |       |       |
| A11-005 | Text spacing can be increased (line height 1.5x, paragraph spacing 2x, letter spacing 0.12em, word spacing 0.16em) without loss of content |       |       |
| A11-006 | Content reflows correctly in VS Code's narrow side panel without truncation or overlap                                                     |       |       |

### 11.2 Operable

| ID      | Checklist Item                                                                        | Score | Notes |
| ------- | ------------------------------------------------------------------------------------- | ----- | ----- |
| A11-010 | All functionality is available via keyboard (no mouse-only interactions)              |       |       |
| A11-011 | Focus indicator is visible on all interactive elements (2px outline minimum)          |       |       |
| A11-012 | Tab order follows visual reading order (left-to-right, top-to-bottom)                 |       |       |
| A11-013 | No keyboard traps -- focus can always be moved away from any element                  |       |       |
| A11-014 | Focus is managed correctly after dynamic content changes (modals, expanding sections) |       |       |
| A11-015 | Timing: operations that auto-dismiss content give sufficient time (5s minimum)        |       |       |
| A11-016 | No content flashes more than 3 times per second                                       |       |       |
| A11-017 | Skip navigation mechanism exists for repetitive card headers                          |       |       |

### 11.3 Understandable

| ID      | Checklist Item                                                                                | Score | Notes |
| ------- | --------------------------------------------------------------------------------------------- | ----- | ----- |
| A11-020 | Language attribute is set on the webview root (`lang="en"`)                                   |       |       |
| A11-021 | Form labels are programmatically associated with their inputs (label[for] or aria-labelledby) |       |       |
| A11-022 | Form validation errors are announced to screen readers (aria-live region or role="alert")     |       |       |
| A11-023 | Instructions do not rely on sensory characteristics alone ("Click the green button" -- bad)   |       |       |
| A11-024 | Consistent navigation: section tabs appear in the same order every time                       |       |       |

### 11.4 Robust

| ID      | Checklist Item                                                                                        | Score | Notes |
| ------- | ----------------------------------------------------------------------------------------------------- | ----- | ----- |
| A11-030 | HTML is valid and well-formed (no duplicate IDs, proper nesting)                                      |       |       |
| A11-031 | ARIA roles and properties are used correctly (no incorrect role assignments)                          |       |       |
| A11-032 | Dynamic content updates use aria-live regions appropriately (polite for status, assertive for errors) |       |       |
| A11-033 | Custom components (Lit elements) expose proper ARIA semantics                                         |       |       |
| A11-034 | The interface works with screen readers (VoiceOver, NVDA, JAWS)                                       |       |       |

---

## Category 12: Enterprise Dashboard Quality

_Source: Baymard Institute UX audit methodology; enterprise SaaS best practices_

### 12.1 Information Architecture

| ID     | Checklist Item                                                                                          | Score | Notes |
| ------ | ------------------------------------------------------------------------------------------------------- | ----- | ----- |
| ED-001 | The 5-section taxonomy (operate/build/govern/intake/evals) maps to operator mental models and workflows |       |       |
| ED-002 | Cards within each section are ordered by frequency of use (most-used first)                             |       |       |
| ED-003 | Cross-section relationships are navigable (e.g., clicking a commitment links to its source meeting)     |       |       |
| ED-004 | The "All" view provides a meaningful executive summary, not just a concatenation of all cards           |       |       |
| ED-005 | Drill-down depth is limited (max 3 levels: section > card > detail)                                     |       |       |
| ED-006 | The information hierarchy follows: (1) What needs attention NOW, (2) Status overview, (3) Configuration |       |       |

### 12.2 Data Density and Scanability

| ID     | Checklist Item                                                                                 | Score | Notes |
| ------ | ---------------------------------------------------------------------------------------------- | ----- | ----- |
| ED-010 | Key metrics are visible without scrolling ("above the fold")                                   |       |       |
| ED-011 | Numbers are formatted for quick scanning (thousands separator, 2 decimal places max)           |       |       |
| ED-012 | Color-coded status indicators enable rapid visual scanning of card health                      |       |       |
| ED-013 | Tables support sorting by at least one column                                                  |       |       |
| ED-014 | List items with actions show the action affordance on hover (not hidden behind a context menu) |       |       |
| ED-015 | Card states (healthy/warning/error) are visually distinct at a glance                          |       |       |

### 12.3 Operational Workflow

| ID     | Checklist Item                                                                                   | Score | Notes |
| ------ | ------------------------------------------------------------------------------------------------ | ----- | ----- |
| ED-020 | The operator's most common workflow (morning brief > triage > act) is supported as a linear flow |       |       |
| ED-021 | Approval/rejection actions are reachable in 1 click from the item display                        |       |       |
| ED-022 | Bulk triage is supported for high-volume scenarios (multiple approvals/rejections)               |       |       |
| ED-023 | The operator can distinguish "needs my attention" vs "informational" at a glance                 |       |       |
| ED-024 | Time-sensitive items are visually prioritized (upcoming meetings, expiring proposals)            |       |       |

---

## Category 13: SaaS Onboarding Quality

_Source: Industry best practices for SaaS onboarding; Baymard (first-run experience)_

| ID     | Checklist Item                                                                                                         | Score | Notes |
| ------ | ---------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| OB-001 | First-run experience guides the operator through: (1) Connect sidecar, (2) Authenticate Graph, (3) Configure role card |       |       |
| OB-002 | Setup validation endpoint results (/ops/setup/validate) are displayed in the UI with clear remediation steps           |       |       |
| OB-003 | Missing Graph credentials show a specific setup guide (not just "Auth failed")                                         |       |       |
| OB-004 | Progressive disclosure: advanced features (builder lane, self-healing) are hidden until basic setup is complete        |       |       |
| OB-005 | The system provides value within 5 minutes of first launch (at minimum: morning brief with local data)                 |       |       |
| OB-006 | "What to do next" guidance appears after each onboarding milestone                                                     |       |       |
| OB-007 | The operator can reset/restart onboarding if something goes wrong                                                      |       |       |
| OB-008 | Configuration pre-flight: the system validates all prerequisites before enabling features                              |       |       |

---

## Category 14: Contextual Help Design Patterns

_Source: Apple HIG (guidance); Material Design (educational UI); industry best practices_

| ID     | Checklist Item                                                                                                          | Score | Notes |
| ------ | ----------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| CH-001 | Inline help text appears directly below or beside the element it explains                                               |       |       |
| CH-002 | Help text is concise (1-2 sentences) and action-oriented                                                                |       |       |
| CH-003 | Complex workflows include a step indicator (Step 1 of 3)                                                                |       |       |
| CH-004 | Contextual help adapts to the operator's experience level (disappears after first use, or can be dismissed permanently) |       |       |
| CH-005 | Error states include contextual help specific to the failure (not generic help links)                                   |       |       |
| CH-006 | Keyboard shortcut discoverability: shortcuts are shown in tooltips alongside mouse instructions                         |       |       |
| CH-007 | Configuration fields with non-obvious impact include "Learn more" links                                                 |       |       |
| CH-008 | Example values are shown as placeholder text in empty inputs                                                            |       |       |

---

## Category 15: Performance and Responsiveness

_Source: VS Code UX Guidelines (performance); Google Web Vitals; Material Design (motion)_

| ID     | Checklist Item                                                                                      | Score | Notes |
| ------ | --------------------------------------------------------------------------------------------------- | ----- | ----- |
| PR-001 | Webview initial render completes in <500ms after panel activation                                   |       |       |
| PR-002 | Card data loads within 2s of card becoming visible (or shows loading state)                         |       |       |
| PR-003 | User interactions (click, type) respond within 100ms (visual feedback)                              |       |       |
| PR-004 | Scroll performance is smooth (60fps) even with all cards expanded                                   |       |       |
| PR-005 | Extension does not increase VS Code startup time by more than 200ms                                 |       |       |
| PR-006 | Memory usage remains stable over extended use (no leaks from re-renders)                            |       |       |
| PR-007 | Network requests are debounced for rapid user input (e.g., typing in search)                        |       |       |
| PR-008 | Stale data is served from cache with background refresh (stale-while-revalidate pattern)            |       |       |
| PR-009 | Large datasets (>100 items) use virtual scrolling or pagination                                     |       |       |
| PR-010 | Animations/transitions are 200-300ms (not instant, not sluggish) and respect prefers-reduced-motion |       |       |

---

## Category 16: Trust and Transparency

_Source: Ted-specific governance requirements; Apple HIG (trust); NNGroup (trust signals)_

| ID     | Checklist Item                                                                                 | Score | Notes |
| ------ | ---------------------------------------------------------------------------------------------- | ----- | ----- |
| TT-001 | The operator can see what Ted is doing autonomously at any time (event log, scheduler status)  |       |       |
| TT-002 | AI-generated content is clearly labeled as such (morning brief, draft emails, recommendations) |       |       |
| TT-003 | Autonomy level is visible and the operator understands what actions Ted can take independently |       |       |
| TT-004 | Approval gates are clearly communicated: which actions require approval, which don't           |       |       |
| TT-005 | The operator can audit any past action (full audit trail accessible from UI)                   |       |       |
| TT-006 | Confidence scores or uncertainty indicators accompany AI recommendations                       |       |       |
| TT-007 | Data sources are attributed (which Graph API, which profile, which ledger)                     |       |       |
| TT-008 | The operator can override or correct any AI decision (edit, reject, undo)                      |       |       |
| TT-009 | HIPAA/PHI handling is transparent (what gets redacted, where data flows)                       |       |       |
| TT-010 | Version/build information is accessible for support purposes                                   |       |       |

---

## Audit Execution Guide

### Step 1: Environment Preparation

1. Launch VS Code with the Ted extension enabled
2. Verify sidecar is running and connected
3. Test in both Light and Dark themes
4. Test at both default and 200% zoom
5. Enable VS Code's High Contrast theme for accessibility testing

### Step 2: Card-by-Card Evaluation

Evaluate each of the 26 operator surface cards against ALL applicable checklist items:

1. Overview / Connection Status
2. Role Card Editor
3. Job Board
4. Intake Recommendation
5. Threshold Configuration
6. Source Documents
7. Policy Editor
8. Connector Auth
9. Mail Viewer
10. Morning Brief
11. EOD Digest
12. Deal Pipeline
13. LLM Provider
14. Meetings / Commitments / GTD
15. Trust Metrics
16. Deep Work Metrics
17. Draft Queue
18. Event Log Stats
19. Planner (Microsoft Planner)
20. To Do (Microsoft To Do)
21. Sync Reconciliation
22. Improvement Proposals
23. Builder Lane Dashboard
24. Ingestion Status
25. Discovery Status
26. SharePoint Documents
27. Self-Healing Dashboard

### Step 3: Cross-Cutting Evaluation

After individual card evaluation, assess:

- **Navigation flow:** Move through all 5 sections and verify consistency
- **Keyboard-only navigation:** Complete a full workflow without mouse
- **Screen reader pass:** Navigate all cards with a screen reader
- **Error simulation:** Disconnect sidecar, expire tokens, corrupt data -- verify all error states
- **Theme switching:** Switch between Light, Dark, High Contrast and verify all elements
- **Zoom testing:** Test at 100%, 150%, and 200% zoom
- **Narrow panel:** Test in VS Code's narrow side panel width

### Step 4: Scoring and Prioritization

1. Score each checklist item as PASS / PARTIAL / FAIL / N/A
2. Assign severity (S1-S4) to each PARTIAL or FAIL
3. Calculate category scores: (PASS count) / (PASS + PARTIAL + FAIL count) \* 100
4. Prioritize remediation: All S1 before S2, all S2 before S3, etc.

### Quality Bar Thresholds

| Category                 | Minimum for Launch     | Target  |
| ------------------------ | ---------------------- | ------- |
| Cat 1 (Visibility)       | 80% PASS               | 95%     |
| Cat 2 (Real World)       | 85% PASS               | 95%     |
| Cat 3 (User Control)     | 75% PASS               | 90%     |
| Cat 4 (Consistency)      | 80% PASS               | 95%     |
| Cat 5 (Error Prevention) | 70% PASS               | 85%     |
| Cat 6 (Recognition)      | 80% PASS               | 90%     |
| Cat 7 (Flexibility)      | 60% PASS               | 80%     |
| Cat 8 (Aesthetics)       | 75% PASS               | 90%     |
| Cat 9 (Error Recovery)   | 85% PASS               | 95%     |
| Cat 10 (Help/Docs)       | 70% PASS               | 85%     |
| Cat 11 (Accessibility)   | 90% PASS (AA required) | 100%    |
| Cat 12 (Dashboard)       | 75% PASS               | 90%     |
| Cat 13 (Onboarding)      | 70% PASS               | 85%     |
| Cat 14 (Contextual Help) | 65% PASS               | 80%     |
| Cat 15 (Performance)     | 80% PASS               | 95%     |
| Cat 16 (Trust)           | 85% PASS               | 95%     |
| **Overall**              | **75% PASS**           | **90%** |

---

## Summary Statistics

| Metric                           | Count                               |
| -------------------------------- | ----------------------------------- |
| Total categories                 | 16                                  |
| Total checklist items            | 184                                 |
| Items from NNGroup heuristics    | ~65 (Cat 1-3, 6-10)                 |
| Items from WCAG 2.1 AA           | 24 (Cat 11)                         |
| Items from VS Code UX Guidelines | 14 (Cat 4.3, 15)                    |
| Items from Material Design       | ~20 (distributed across categories) |
| Items from Baymard/Enterprise    | ~25 (Cat 12, 13)                    |
| Items from Apple HIG             | ~15 (Cat 2, 6, 14, 16)              |
| Ted-specific governance items    | ~10 (Cat 16)                        |

---

## Appendix A: Severity Decision Tree

```
Is the user blocked from completing their task?
  YES -> S1-CRITICAL
  NO  -> Does it cause significant confusion or accessibility barrier?
           YES -> S2-HIGH
           NO  -> Does it add friction but a workaround exists?
                    YES -> S3-MEDIUM
                    NO  -> S4-LOW (cosmetic/minor)
```

## Appendix B: Common FAIL Patterns in VS Code Extension Webviews

Based on industry audit findings, the most common failure patterns in VS Code extension webviews:

1. **Theme ignorance** -- Hardcoded colors instead of `--vscode-*` tokens (Cat 4, CS-020/021)
2. **Missing loading states** -- Async operations with no visual feedback (Cat 1, V-001/002)
3. **Silent failures** -- Network errors swallowed without user notification (Cat 9, ER-001/002)
4. **Mouse-only interactions** -- Custom components unreachable via keyboard (Cat 11, A11-010)
5. **No focus management** -- Dynamic content appears but focus doesn't move to it (Cat 11, A11-014)
6. **Dense information walls** -- All data shown at once without progressive disclosure (Cat 8, AM-001)
7. **Generic error messages** -- "Error" or "Failed" without actionable detail (Cat 9, ER-001)
8. **Missing empty states** -- Blank space when no data exists (Cat 2, RW-007)
9. **Inconsistent patterns** -- Different loading/error patterns across cards (Cat 4, CS-010/011/012)
10. **No data freshness indicator** -- Stale data looks identical to fresh data (Cat 1, V-015)

## Appendix C: Cross-Reference to Ted Architecture

| UI Component        | Controller Function(s)                                                 | Sidecar Route(s)                                                  | Relevant Checklist Categories |
| ------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------- |
| Overview card       | `refreshTedSnapshot()`                                                 | `GET /workbench/snapshot`                                         | 1, 14, 15                     |
| Role Card Editor    | `validateTedRoleCard()`                                                | `POST /role-card/validate`                                        | 5, 6, 10                      |
| Draft Queue         | `loadDraftQueue()`, `executeDraft()`                                   | `GET /drafts/queue`, `POST /drafts/execute`                       | 1, 3, 9, 12                   |
| Sync Reconciliation | `runReconciliation()`, `approveSyncProposal()`, `rejectSyncProposal()` | `POST /sync/reconcile`, `POST /sync/approve`, `POST /sync/reject` | 3, 9, 12, 16                  |
| Builder Lane        | `loadBuilderLaneStatus()`                                              | `GET /builder-lane/status`                                        | 1, 6, 8, 16                   |
| Self-Healing        | `loadSelfHealingStatus()`                                              | `GET /self-healing/status`                                        | 1, 6, 16                      |
| SharePoint          | `loadSharepointItems()`, `uploadSharepointFile()`                      | `GET /sharepoint/items`, `POST /sharepoint/upload`                | 1, 3, 5, 12                   |
| Onboarding          | `validateSetup()`                                                      | `GET /ops/setup/validate`                                         | 10, 13                        |

---

_This checklist is a living document. Items should be added as new operator surface cards are introduced. Re-audit after any major UI change._
