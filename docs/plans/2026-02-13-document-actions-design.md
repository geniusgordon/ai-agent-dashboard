# Document Actions & Enhanced Spawn Flow — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add "Document" actions (handoff, learnings, summary, custom) to sessions, and enhance the spawn flow with initial prompt + resume-from-documents.

**Architecture:** Document actions send crafted prompts via the existing `sendMessage` mutation — no new backend for writing docs. Enhanced spawn chains the existing 3-step spawn with an optional `sendMessage` call. A new `detectDocuments` tRPC query scans worktrees for existing doc files.

**Tech Stack:** React, tRPC, TanStack Query, shadcn/ui (DropdownMenu, Textarea, Checkbox), lucide-react, Node.js fs/glob for detection.

---

## Task 1: Create prompt templates module

**Files:**
- Create: `src/lib/documents/prompts.ts`

**Step 1: Create the prompts file**

```typescript
// src/lib/documents/prompts.ts

export type DocumentActionType = "handoff" | "learnings" | "summary";

export interface DocumentAction {
  type: DocumentActionType;
  label: string;
  description: string;
}

export const DOCUMENT_ACTIONS: DocumentAction[] = [
  {
    type: "handoff",
    label: "Handoff",
    description: "Write context for the next session",
  },
  {
    type: "learnings",
    label: "Learnings",
    description: "Document pitfalls and discoveries",
  },
  {
    type: "summary",
    label: "Summary",
    description: "Summarize what was accomplished",
  },
];

const PROMPTS: Record<DocumentActionType, string> = {
  handoff: `Write a handoff document for the next agent session picking up this work.

Save it as a markdown file under the docs/ directory in this project, following any existing documentation conventions you see. If no convention exists, use docs/handoff.md.

Include:
- What has been completed
- What is currently in progress
- Concrete next steps
- Gotchas, pitfalls, or important context the next session needs to know

Be concise and actionable.`,

  learnings: `Write a learnings document capturing what was discovered during this session.

Save it as a markdown file under the docs/ directory in this project, following any existing documentation conventions you see. If no convention exists, use docs/learnings.md.

Include:
- Pitfalls encountered and how they were resolved
- Patterns that worked well or didn't
- Debugging insights
- Anything a future developer working in this area should know

Be concise and specific.`,

  summary: `Write a summary document of what was accomplished in this session.

Save it as a markdown file under the docs/ directory in this project, following any existing documentation conventions you see. If no convention exists, use docs/summary.md.

Include:
- Key changes made (files, features, fixes)
- Decisions taken and why
- Any remaining items not completed

Be concise. This should be suitable as a PR description or changelog entry.`,
};

export function getDocumentPrompt(type: DocumentActionType): string {
  return PROMPTS[type];
}

export function buildCustomDocumentPrompt(instruction: string): string {
  return `${instruction}

Save the output as a markdown file under the docs/ directory in this project, following any existing documentation conventions you see.`;
}
```

**Step 2: Verify no lint errors**

Run: `pnpm check`

**Step 3: Commit**

```bash
git add src/lib/documents/prompts.ts
git commit -m "feat: add document action prompt templates"
```

---

## Task 2: Create DocumentActionMenu component

**Files:**
- Create: `src/components/dashboard/DocumentActionMenu.tsx`
- Modify: `src/components/dashboard/index.ts`

**Step 1: Create the component**

```typescript
// src/components/dashboard/DocumentActionMenu.tsx

import { FileText, Loader2, Pen } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import {
  DOCUMENT_ACTIONS,
  buildCustomDocumentPrompt,
  getDocumentPrompt,
} from "@/lib/documents/prompts";

interface DocumentActionMenuProps {
  onSendMessage: (message: string) => void;
  disabled: boolean;
}

export function DocumentActionMenu({
  onSendMessage,
  disabled,
}: DocumentActionMenuProps) {
  const [customOpen, setCustomOpen] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [sending, setSending] = useState(false);

  const handlePreset = (type: Parameters<typeof getDocumentPrompt>[0]) => {
    setSending(true);
    onSendMessage(getDocumentPrompt(type));
    // Reset after a short delay so the spinner shows briefly
    setTimeout(() => setSending(false), 500);
  };

  const handleCustomSubmit = () => {
    if (!customPrompt.trim()) return;
    onSendMessage(buildCustomDocumentPrompt(customPrompt.trim()));
    setCustomPrompt("");
    setCustomOpen(false);
  };

  if (customOpen) {
    return (
      <div className="space-y-2">
        <Textarea
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          placeholder="What should the agent document?"
          className="min-h-[80px] text-sm"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleCustomSubmit();
            }
            if (e.key === "Escape") {
              setCustomOpen(false);
              setCustomPrompt("");
            }
          }}
        />
        <div className="flex gap-1.5">
          <Button
            size="sm"
            onClick={handleCustomSubmit}
            disabled={!customPrompt.trim()}
            className="flex-1"
          >
            Send
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setCustomOpen(false);
              setCustomPrompt("");
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled || sending}
          className="w-full justify-center"
        >
          {sending ? <Loader2 className="animate-spin" /> : <FileText />}
          Document
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {DOCUMENT_ACTIONS.map((action) => (
          <DropdownMenuItem
            key={action.type}
            onClick={() => handlePreset(action.type)}
          >
            <div>
              <div className="font-medium">{action.label}</div>
              <div className="text-xs text-muted-foreground">
                {action.description}
              </div>
            </div>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setCustomOpen(true)}>
          <div className="flex items-center gap-2">
            <Pen className="size-3.5" />
            <div>
              <div className="font-medium">Custom</div>
              <div className="text-xs text-muted-foreground">
                Write your own instruction
              </div>
            </div>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

**Step 2: Add to barrel exports**

In `src/components/dashboard/index.ts`, add after the `DashboardLayout` export:

```typescript
export { DocumentActionMenu } from "./DocumentActionMenu";
```

**Step 3: Verify no lint errors**

Run: `pnpm check`

**Step 4: Commit**

```bash
git add src/components/dashboard/DocumentActionMenu.tsx src/components/dashboard/index.ts
git commit -m "feat: add DocumentActionMenu component"
```

---

## Task 3: Add DocumentActionMenu to SessionRightPanel

**Files:**
- Modify: `src/components/dashboard/SessionRightPanel.tsx`

**Step 1: Add the import and prop**

Add import at top of `SessionRightPanel.tsx`:
```typescript
import { DocumentActionMenu } from "@/components/dashboard/DocumentActionMenu";
```

Add to `SessionRightPanelProps`:
```typescript
  onSendMessage?: (message: string) => void;
```

Add `onSendMessage` to the destructured props.

**Step 2: Add the DocumentActionMenu in the sticky action footer**

In the `{/* ── Sticky action footer ─── */}` section, add the Document button **before** the Code Review button (after the session lifecycle buttons block, before `{onStartReview && branch && (`):

```typescript
          {/* Document actions */}
          {isActiveSession && onSendMessage && (
            <DocumentActionMenu
              onSendMessage={onSendMessage}
              disabled={session.status === "running"}
            />
          )}
```

**Step 3: Verify no lint errors**

Run: `pnpm check`

**Step 4: Commit**

```bash
git add src/components/dashboard/SessionRightPanel.tsx
git commit -m "feat: add Document action to SessionRightPanel"
```

---

## Task 4: Add DocumentActionMenu to SessionMobileDrawer

**Files:**
- Modify: `src/components/dashboard/SessionMobileDrawer.tsx`

**Step 1: Add the import and prop**

Add import at top:
```typescript
import { DocumentActionMenu } from "@/components/dashboard/DocumentActionMenu";
```

Add to `SessionMobileDrawerProps`:
```typescript
  onSendMessage?: (message: string) => void;
```

Add `onSendMessage` to the destructured props.

**Step 2: Add the DocumentActionMenu in DrawerFooter**

In `<DrawerFooter>`, add before the Code Review button (before `{onStartReview && branch && (`):

```typescript
          {/* Document actions */}
          {isActiveSession && onSendMessage && (
            <DocumentActionMenu
              onSendMessage={onSendMessage}
              disabled={session.status === "running"}
            />
          )}
```

**Step 3: Verify no lint errors**

Run: `pnpm check`

**Step 4: Commit**

```bash
git add src/components/dashboard/SessionMobileDrawer.tsx
git commit -m "feat: add Document action to SessionMobileDrawer"
```

---

## Task 5: Wire up DocumentActionMenu in SessionDetailView

**Files:**
- Modify: `src/components/dashboard/SessionDetailView.tsx`

**Step 1: Pass `sendMessage` to SessionRightPanel**

In the `<SessionRightPanel>` JSX in `SessionDetailView.tsx`, add the `onSendMessage` prop. The existing `sendMessage` from `useSessionDetail` takes `(message: string, images?: ImageAttachment[])` — we can pass it directly since extra args are ignored:

```typescript
            onSendMessage={(msg: string) => sendMessage(msg)}
```

**Step 2: Pass `sendMessage` to SessionMobileDrawer**

Same for `<SessionMobileDrawer>`:

```typescript
            onSendMessage={(msg: string) => sendMessage(msg)}
```

**Step 3: Verify no lint errors**

Run: `pnpm check`

**Step 4: Verify the app builds**

Run: `pnpm build`

**Step 5: Commit**

```bash
git add src/components/dashboard/SessionDetailView.tsx
git commit -m "feat: wire DocumentActionMenu into session detail view"
```

---

## Task 6: Add detectDocuments tRPC query

**Files:**
- Modify: `src/server/routers/worktrees.ts`

**Step 1: Add the detectDocuments query**

Add `fs` and `path` imports at the top of `worktrees.ts`:
```typescript
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
```

Add the query to the `worktreesRouter` (after the existing `unassignAgent` mutation):

```typescript
  detectDocuments: publicProcedure
    .input(z.object({ worktreePath: z.string() }))
    .query(async ({ input }) => {
      const { expandPath } = await import("../../lib/utils/expand-path.js");
      const absPath = expandPath(input.worktreePath);
      const patterns = [
        { dir: "docs", match: /^(handoff|learnings|summary)/i },
        { dir: ".", match: /^HANDOFF\.md$/i },
      ];
      const results: Array<{
        path: string;
        name: string;
        modifiedAt: string;
        content: string;
      }> = [];

      for (const { dir, match } of patterns) {
        const dirPath = join(absPath, dir);
        let entries: string[];
        try {
          entries = await readdir(dirPath);
        } catch {
          continue;
        }
        for (const entry of entries) {
          if (!match.test(entry)) continue;
          const filePath = join(dirPath, entry);
          try {
            const s = await stat(filePath);
            if (!s.isFile()) continue;
            const content = await readFile(filePath, "utf-8");
            results.push({
              path: relative(absPath, filePath),
              name: entry,
              modifiedAt: s.mtime.toISOString(),
              content: content.slice(0, 10000), // cap at 10k chars
            });
          } catch {
            continue;
          }
        }
      }

      return results;
    }),
```

**Step 2: Verify no lint errors**

Run: `pnpm check`

**Step 3: Commit**

```bash
git add src/server/routers/worktrees.ts
git commit -m "feat: add detectDocuments query to worktrees router"
```

---

## Task 7: Enhance SpawnAgentDialog with initial prompt + resume from docs

**Files:**
- Modify: `src/components/dashboard/SpawnAgentDialog.tsx`

**Step 1: Add imports and state**

Add imports:
```typescript
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, FileText } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
```

Add new state variables after existing state:
```typescript
  const [initialPrompt, setInitialPrompt] = useState("");
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [resumeFromDocs, setResumeFromDocs] = useState(false);
  const navigate = useNavigate();
```

Add the `detectDocuments` query:
```typescript
  const docsQuery = useQuery({
    ...trpc.worktrees.detectDocuments.queryOptions({ worktreePath: worktreePath }),
    enabled: open,
  });
  const detectedDocs = docsQuery.data ?? [];
```

**Step 2: Add sendMessage mutation**

```typescript
  const sendMessageMutation = useMutation(
    trpc.sessions.sendMessage.mutationOptions(),
  );
```

**Step 3: Modify handleSpawn to send initial prompt**

After the existing `assignMutation.mutateAsync(...)` call and before `invalidateAll()`, add:

```typescript
      // Build and send initial prompt if provided
      const parts: string[] = [];
      if (resumeFromDocs && detectedDocs.length > 0) {
        parts.push(
          "Here are documents from the previous session for context:\n\n" +
            detectedDocs
              .map((d) => `--- ${d.path} ---\n${d.content}`)
              .join("\n\n"),
        );
      }
      if (initialPrompt.trim()) {
        parts.push(initialPrompt.trim());
      }
      if (parts.length > 0) {
        await sendMessageMutation.mutateAsync({
          sessionId: session.id,
          message: parts.join("\n\n---\n\n"),
        });
      }

      invalidateAll();
      onOpenChange(false);

      // Navigate to the new session
      navigate({
        to: "/dashboard/sessions/$sessionId",
        params: { sessionId: session.id },
      });
```

Remove the duplicate `invalidateAll()` and `onOpenChange(false)` that were there before.

**Step 4: Add UI elements in the dialog body**

After the agent type buttons grid `<div className="grid gap-2 py-2">...</div>` and before the error display, add:

```typescript
        {/* Initial prompt (collapsible) */}
        <div className="space-y-2">
          <button
            type="button"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setPromptExpanded((prev) => !prev)}
          >
            {promptExpanded ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
            Initial prompt
          </button>

          {promptExpanded && (
            <Textarea
              value={initialPrompt}
              onChange={(e) => setInitialPrompt(e.target.value)}
              placeholder="Optional first message to send after spawning..."
              className="min-h-[80px] text-sm"
            />
          )}
        </div>

        {/* Resume from documents */}
        {detectedDocs.length > 0 && (
          <label className="flex items-start gap-2 p-3 rounded-lg border border-border bg-secondary/30 cursor-pointer">
            <Checkbox
              checked={resumeFromDocs}
              onCheckedChange={(checked) =>
                setResumeFromDocs(checked === true)
              }
              className="mt-0.5"
            />
            <div className="space-y-1">
              <span className="text-sm font-medium">
                Resume from previous documents
              </span>
              <div className="flex flex-wrap gap-1">
                {detectedDocs.map((doc) => (
                  <span
                    key={doc.path}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded"
                  >
                    <FileText className="size-3" />
                    {doc.path}
                  </span>
                ))}
              </div>
            </div>
          </label>
        )}
```

**Step 5: Reset state when dialog closes**

Update the `onOpenChange` on the `<Dialog>` to reset state:

Change `<Dialog open={open} onOpenChange={onOpenChange}>` to:
```typescript
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setInitialPrompt("");
          setPromptExpanded(false);
          setResumeFromDocs(false);
          setError(null);
        }
        onOpenChange(v);
      }}
    >
```

**Step 6: Verify no lint errors**

Run: `pnpm check`

**Step 7: Commit**

```bash
git add src/components/dashboard/SpawnAgentDialog.tsx
git commit -m "feat: add initial prompt and resume-from-docs to SpawnAgentDialog"
```

---

## Task 8: Enhance ProjectSpawnFlow with initial prompt + resume from docs

**Files:**
- Modify: `src/components/dashboard/ProjectSpawnFlow.tsx`

**Step 1: Add imports and state**

Add imports:
```typescript
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, FileText } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
```

Add state:
```typescript
  const [initialPrompt, setInitialPrompt] = useState("");
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [resumeFromDocs, setResumeFromDocs] = useState(false);
  const navigate = useNavigate();
```

**Step 2: Add queries and mutations**

Add `detectDocuments` query — needs the selected worktree's path:
```typescript
  const selectedWorktree = worktrees.find((w) => w.id === selectedWorktreeId);

  const docsQuery = useQuery({
    ...trpc.worktrees.detectDocuments.queryOptions({
      worktreePath: selectedWorktree?.path ?? "",
    }),
    enabled: !!selectedWorktree,
  });
  const detectedDocs = docsQuery.data ?? [];
```

Add `sendMessage` mutation:
```typescript
  const sendMessageMutation = useMutation(
    trpc.sessions.sendMessage.mutationOptions(),
  );
```

**Step 3: Modify handleSpawn**

After the `assignMutation.mutateAsync(...)` and before `invalidateAll()`, add the same prompt-building logic as Task 7 Step 3. Then navigate:

```typescript
      // Build and send initial prompt if provided
      const parts: string[] = [];
      if (resumeFromDocs && detectedDocs.length > 0) {
        parts.push(
          "Here are documents from the previous session for context:\n\n" +
            detectedDocs
              .map((d) => `--- ${d.path} ---\n${d.content}`)
              .join("\n\n"),
        );
      }
      if (initialPrompt.trim()) {
        parts.push(initialPrompt.trim());
      }
      if (parts.length > 0) {
        await sendMessageMutation.mutateAsync({
          sessionId: session.id,
          message: parts.join("\n\n---\n\n"),
        });
      }

      invalidateAll();

      // Navigate to the new session
      navigate({
        to: "/dashboard/sessions/$sessionId",
        params: { sessionId: session.id },
      });
```

**Step 4: Add UI elements**

After the agent type buttons `<div className="flex flex-wrap gap-2">...</div>` and before the error display, add the same collapsible prompt textarea + document detection UI as in Task 7 Step 4 (adjusted for compact layout — perhaps with slightly smaller spacing).

**Step 5: Reset resume state when worktree selection changes**

Add an effect or update the worktree change handler:
```typescript
  // In the Select onValueChange:
  onValueChange={(v) => {
    setSelectedWorktreeId(v);
    setResumeFromDocs(false);
  }}
```

**Step 6: Verify no lint errors**

Run: `pnpm check`

**Step 7: Commit**

```bash
git add src/components/dashboard/ProjectSpawnFlow.tsx
git commit -m "feat: add initial prompt and resume-from-docs to ProjectSpawnFlow"
```

---

## Task 9: Typecheck and build

**Files:** None (verification only)

**Step 1: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors.

**Step 2: Run full validation**

Run: `pnpm validate`
Expected: All checks pass.

**Step 3: Fix any issues found**

If typecheck or lint errors appear, fix them.

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: address lint and type errors"
```

---

## Dependency Graph

```
Task 1 (prompts) ──┬── Task 2 (DocumentActionMenu) ── Task 3 (RightPanel) ──┐
                   │                                   Task 4 (MobileDrawer)──┤
                   │                                                          ├── Task 9 (validate)
                   └── Task 6 (detectDocuments) ── Task 7 (SpawnAgentDialog) ─┤
                                                   Task 8 (ProjectSpawnFlow) ─┘
                                                          Task 5 (wire up) ───┘
```

Tasks 1 and 6 can run in parallel. Tasks 2-5 depend on 1. Tasks 7-8 depend on 6. Task 9 runs last.
