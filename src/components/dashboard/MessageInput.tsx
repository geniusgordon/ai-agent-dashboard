import { Loader2, Send } from "lucide-react";
import { type KeyboardEvent, useRef, useState } from "react";

export interface MessageInputProps {
  onSend: (message: string) => void;
  isSending: boolean;
  disabled: boolean;
  placeholder?: string;
}

export function MessageInput({
  onSend,
  isSending,
  disabled,
  placeholder = "Send a message...",
}: MessageInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setInput("");
    // Reset height after clearing
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleSubmit = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    submit();
  };

  // Auto-resize textarea to fit content
  const handleInput = (value: string) => {
    setInput(value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  };

  // Enter submits, Shift+Enter inserts newline (Slack/ChatGPT convention)
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="shrink-0">
      <div className="flex gap-2 p-2 rounded-xl border border-border bg-card shadow-md">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => handleInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isSending || disabled}
          rows={1}
          className="
            flex-1 px-4 py-2.5 rounded-lg
            text-base sm:text-sm
            bg-transparent border-none font-sans
            text-foreground placeholder-muted-foreground
            focus:outline-none
            disabled:opacity-50
            resize-none
          "
        />
        <button
          type="submit"
          disabled={!input.trim() || isSending || disabled}
          className="
            px-5 py-2.5 rounded-lg font-semibold text-sm
            bg-action-success text-white
            hover:bg-action-success-hover hover:-translate-y-px
            active:translate-y-0
            transition-all duration-200
            disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0
            cursor-pointer shrink-0 inline-flex items-center gap-2
            self-end
          "
        >
          {isSending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          <span className="hidden sm:inline">Send</span>
        </button>
      </div>
    </form>
  );
}
