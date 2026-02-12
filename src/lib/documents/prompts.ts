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
