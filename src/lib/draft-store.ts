import type { ImageAttachment } from "@/components/dashboard/MessageInput";

export interface MessageDraft {
  text: string;
  images: ImageAttachment[];
}

const drafts = new Map<string, MessageDraft>();

export function getDraft(sessionId: string): MessageDraft | undefined {
  return drafts.get(sessionId);
}

export function saveDraft(sessionId: string, draft: MessageDraft): void {
  if (!draft.text && draft.images.length === 0) {
    drafts.delete(sessionId);
  } else {
    drafts.set(sessionId, draft);
  }
}

export function clearDraft(sessionId: string): void {
  drafts.delete(sessionId);
}
