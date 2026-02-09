# Agent Dashboard UI Refactor (Viewport-Snap Version)

## 1. Objective
Refactor the Agent Dashboard from a card-based layout to a viewport-snapped, monolithic layout.

**Goals:**
- Maximize usable workspace
- Remove unused margins and gaps
- Improve information hierarchy for developer workflows

---

## 2. Design & UX Principles

### Monolithic Layout
- UI should feel like an IDE
- No floating cards
- Every area has a functional purpose

### Contextual Focus
- Separate global controls and task-specific controls using nested headers

### Responsive Design
- High density on desktop
- Drawer-based layout on mobile

### Fitts’s Law Optimization
- Snap panels to edges
- Make toggles and scrollbars easy to reach

---

## 3. Layout Architecture

### 3.1 Global Structure

**Old**
- Floating cards
- Margins and rounded corners

**New**
- Flexbox grid layout
- Panels separated by 1px borders

**T-Junction Pattern**
- Sidebar borders align with header border

---

### 3.2 Header Structure

#### Global Header (Primary)
- Full width
- Left: Breadcrumbs (e.g., `Sessions / ID`)
- Right: Status indicators and utilities

#### Context Header (Secondary)
- Sticky on top of log feed
- Shows active project (terminal-style badge)
- Contains log tools (filter, clear, etc.)

---

### 3.3 Right Panel (Sidebar / Drawer)

#### Desktop
- Always visible
- Fixed to screen edge

#### Mobile
- Bottom drawer

#### Toggle
- Button inside border gutter
- Attached visually to divider

---

## 4. Content Structure

### 4.1 Status & Metadata
- Unified status widget
- Shows:
  - Execution time
  - Agent status
  - Git branch
- Located at top of right panel

---

### 4.2 File & Commit Explorer
- Compact row layout
- Inline diff counts: `+4,029 -2,717`
- Use semantic success/error colors

**Goal:**  
Enable fast scanning of large change sets

---

### 4.3 Action Footer
- Fixed at bottom of right panel
- Always visible
- Contains critical actions:
- Kill
- Approve

---

## 5. Mobile Responsive Behavior

### Breakpoint
- `< 1024px`

### Layout Changes

| Area       | Behavior                 |
|------------|--------------------------|
| Left Nav   | Hamburger drawer         |
| Right Pane | Bottom sheet drawer      |
| Main Area  | Log feed remains primary |

### Mobile Intent
- Keep logs as main focus
- Allow quick access to metadata

---

## 6. Technical Guidelines

### Borders
- Solid 1px borders
- No shadows

### Scrolling
- Custom scrollbar for:
- Log area
- Right panel sections

### Safe Areas
- Respect iOS/Android safe insets
- Apply to drawers and footers

---

## 7. Success Criteria
- No floating cards
- No unused margins
- Clear header hierarchy
- Persistent action footer
- Smooth desktop/mobile transition
