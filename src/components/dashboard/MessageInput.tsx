import { ImagePlus, Loader2, Send, StopCircle, X } from "lucide-react";
import {
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { CommandPalette } from "@/components/dashboard/CommandPalette";
import { ContextMeter } from "@/components/dashboard/ContextMeter";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SessionMode, UsageUpdatePayload } from "@/lib/agents/types";
import { clearDraft, getDraft, saveDraft } from "@/lib/draft-store";

export interface ImageAttachment {
  id: string;
  file: File;
  preview: string; // data URL for preview
  base64: string; // base64 without data: prefix
  mimeType: string;
}

export interface MessageInputProps {
  /** Session ID used to persist unsent drafts across navigation */
  sessionId: string;
  onSend: (message: string, images?: ImageAttachment[]) => void;
  disabled: boolean;
  isAgentBusy?: boolean;
  placeholder?: string;
  supportsImages?: boolean;
  /** Available modes for this session */
  availableModes?: SessionMode[];
  /** Current mode ID */
  currentModeId?: string;
  /** Callback to change mode */
  onSetMode?: (modeId: string) => void;
  /** Whether a mode change is in progress */
  isSettingMode?: boolean;
  /** Callback to cancel the running prompt */
  onCancel?: () => void;
  /** Whether a cancel is in progress */
  isCancelling?: boolean;
  /** Context window usage info */
  usageInfo?: UsageUpdatePayload;
  /** Available slash commands from the agent */
  availableCommands?: Array<{
    name: string;
    description: string;
    hasInput: boolean;
  }>;
}

const ACCEPTED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

export function MessageInput({
  sessionId,
  onSend,
  disabled,
  isAgentBusy = false,
  placeholder = "Send a message...",
  supportsImages = true,
  availableModes,
  currentModeId,
  onSetMode,
  isSettingMode,
  onCancel,
  isCancelling,
  usageInfo,
  availableCommands,
}: MessageInputProps) {
  const [input, setInput] = useState(() => getDraft(sessionId)?.text ?? "");
  const [images, setImages] = useState<ImageAttachment[]>(
    () => getDraft(sessionId)?.images ?? [],
  );
  const [isDragging, setIsDragging] = useState(false);
  const [commandSelectedIndex, setCommandSelectedIndex] = useState(0);
  const [commandPaletteDismissed, setCommandPaletteDismissed] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persist draft whenever input or images change
  useEffect(() => {
    saveDraft(sessionId, { text: input, images });
  }, [sessionId, input, images]);

  // Restore draft when switching sessions (sessionId changes but component stays mounted)
  const prevSessionIdRef = useRef(sessionId);
  useEffect(() => {
    if (prevSessionIdRef.current === sessionId) return;
    prevSessionIdRef.current = sessionId;

    const draft = getDraft(sessionId);
    setInput(draft?.text ?? "");
    setImages(draft?.images ?? []);
    // Reset textarea height for restored content
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      if (draft?.text) {
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
      }
    }
  }, [sessionId]);

  // Command palette: show when input starts with "/" and commands are available
  const showCommandPalette =
    !commandPaletteDismissed &&
    availableCommands &&
    availableCommands.length > 0 &&
    input.startsWith("/") &&
    !input.includes(" ");
  const commandFilter = showCommandPalette ? input.slice(1) : "";
  const filteredCommands = showCommandPalette
    ? availableCommands!.filter((cmd) =>
        cmd.name.toLowerCase().startsWith(commandFilter.toLowerCase()),
      )
    : [];

  const showModeSelector =
    availableModes && availableModes.length > 0 && onSetMode;
  const imagePickerTitle = supportsImages
    ? "Attach image"
    : "This agent does not support image input";

  const selectCommand = (name: string) => {
    setInput(`/${name} `);
    setCommandSelectedIndex(0);
    textareaRef.current?.focus();
  };

  const submit = () => {
    const trimmed = input.trim();
    if (!trimmed && images.length === 0) return;
    onSend(trimmed, images.length > 0 ? images : undefined);
    setInput("");
    setImages([]);
    clearDraft(sessionId);
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
    setCommandSelectedIndex(0);
    setCommandPaletteDismissed(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  };

  // Enter submits, Shift+Enter inserts newline (Slack/ChatGPT convention)
  // When command palette is visible, arrow keys navigate and Enter selects
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showCommandPalette) {
      if (e.key === "Escape") {
        e.preventDefault();
        setCommandPaletteDismissed(true);
        setCommandSelectedIndex(0);
        return;
      }
      if (filteredCommands.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setCommandSelectedIndex((prev) =>
            prev < filteredCommands.length - 1 ? prev + 1 : 0,
          );
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setCommandSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredCommands.length - 1,
          );
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          selectCommand(
            filteredCommands[commandSelectedIndex]?.name ??
              filteredCommands[0].name,
          );
          return;
        }
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  // Process files into ImageAttachment
  const processFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validFiles = fileArray.filter(
      (f) => ACCEPTED_IMAGE_TYPES.includes(f.type) && f.size <= MAX_IMAGE_SIZE,
    );

    const newAttachments: ImageAttachment[] = await Promise.all(
      validFiles.map(async (file) => {
        const base64 = await fileToBase64(file);
        return {
          id: `img_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          file,
          preview: `data:${file.type};base64,${base64}`,
          base64,
          mimeType: file.type,
        };
      }),
    );

    setImages((prev) => [...prev, ...newAttachments]);
  };

  // File input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
      e.target.value = ""; // Reset so same file can be selected again
    }
  };

  // Drag & Drop handlers
  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    if (supportsImages) setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!supportsImages) return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFiles(files);
    }
  };

  // Paste handler
  const handlePaste = (e: ClipboardEvent) => {
    if (!supportsImages) return;

    const items = e.clipboardData.items;
    const imageFiles: File[] = [];

    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault(); // Prevent pasting image as text
      processFiles(imageFiles);
    }
  };

  // Remove an image
  const removeImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  };

  const canSubmit = input.trim() || images.length > 0;

  return (
    <TooltipProvider>
      <form
        onSubmit={handleSubmit}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="shrink-0"
      >
        <div
          className={`
            flex flex-col gap-2 p-2 border-t border-border bg-background transition-colors
            ${isDragging ? "border-t-primary bg-primary/5" : ""}
          `}
        >
          {/* Context window meter — hidden when busy to avoid redundancy with right panel */}
          {usageInfo && usageInfo.size > 0 && !isAgentBusy && (
            <ContextMeter usage={usageInfo} />
          )}

          {/* Processing indicator */}
          {isAgentBusy && (
            <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-status-running">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-running opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-status-running" />
              </span>
              <Loader2 className="size-3 animate-spin" />
              <span className="font-medium">Agent is thinking...</span>
            </div>
          )}

          {/* Image previews */}
          {images.length > 0 && (
            <div className="flex flex-wrap gap-2 px-2 pt-1">
              {images.map((img) => (
                <div key={img.id} className="relative group">
                  <img
                    src={img.preview}
                    alt="attachment"
                    className="h-16 w-16 object-cover rounded-lg border border-border"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(img.id)}
                    className="
                    absolute -top-1.5 -right-1.5 p-0.5 rounded-full
                    bg-destructive text-destructive-foreground
                    opacity-0 group-hover:opacity-100 transition-opacity
                    hover:bg-destructive/90
                  "
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Toolbar row — shown above textarea on mobile, inline on sm+ */}
          <div className="flex items-center gap-1.5 px-1 sm:hidden">
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={disabled || !supportsImages}
                    className="cursor-pointer disabled:cursor-not-allowed"
                  >
                    <ImagePlus className="size-4" />
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">{imagePickerTitle}</TooltipContent>
            </Tooltip>
            {showModeSelector && (
              <Select
                value={currentModeId}
                onValueChange={(value) => {
                  if (value) onSetMode(value);
                }}
                disabled={isSettingMode}
              >
                <SelectTrigger
                  size="sm"
                  className="h-7 w-auto min-w-[4.5rem] text-xs border-none bg-secondary/50 hover:bg-secondary/80 shadow-none"
                >
                  {isSettingMode ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <SelectValue placeholder="Mode" />
                  )}
                </SelectTrigger>
                <SelectContent position="popper" side="top" align="start">
                  {availableModes.map((mode) => (
                    <SelectItem key={mode.id} value={mode.id}>
                      {mode.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Hidden file input */}
          {supportsImages && (
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_IMAGE_TYPES.join(",")}
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
          )}

          {/* Input row */}
          <div className="relative flex gap-2 items-end">
            {/* Command palette (positioned above input) */}
            {showCommandPalette && (
              <CommandPalette
                commands={availableCommands!}
                filter={commandFilter}
                onSelect={selectCommand}
                selectedIndex={commandSelectedIndex}
                onSelectedIndexChange={setCommandSelectedIndex}
              />
            )}
            {/* Image upload button — hidden on mobile, shown inline on sm+ */}
            <div className="hidden sm:block">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={disabled || !supportsImages}
                      className="cursor-pointer disabled:cursor-not-allowed"
                    >
                      <ImagePlus className="size-5" />
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">{imagePickerTitle}</TooltipContent>
              </Tooltip>
            </div>

            {/* Mode selector — hidden on mobile, shown inline on sm+ */}
            {showModeSelector && (
              <div className="hidden sm:block self-center">
                <Select
                  value={currentModeId}
                  onValueChange={(value) => {
                    if (value) onSetMode(value);
                  }}
                  disabled={isSettingMode}
                >
                  <SelectTrigger
                    size="sm"
                    className="h-8 w-auto min-w-[5rem] text-xs border-none bg-secondary/50 hover:bg-secondary/80 shadow-none"
                  >
                    {isSettingMode ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <SelectValue placeholder="Mode" />
                    )}
                  </SelectTrigger>
                  <SelectContent position="popper" side="top" align="start">
                    {availableModes.map((mode) => (
                      <SelectItem key={mode.id} value={mode.id}>
                        {mode.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => handleInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={isDragging ? "Drop image here..." : placeholder}
              disabled={disabled}
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
            {isAgentBusy && onCancel ? (
              <button
                type="button"
                onClick={onCancel}
                disabled={isCancelling}
                className="
                  px-3 lg:px-5 py-2 lg:py-2.5 rounded-lg font-semibold text-sm
                  bg-action-danger text-white
                  hover:bg-action-danger-hover
                  transition-colors duration-200
                  disabled:opacity-50 disabled:cursor-not-allowed
                  cursor-pointer shrink-0 inline-flex items-center gap-2
                "
              >
                {isCancelling ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <StopCircle className="size-4" />
                )}
                <span className="hidden sm:inline">
                  {isCancelling ? "Stopping…" : "Stop"}
                </span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={!canSubmit || disabled}
                className="
                  px-3 lg:px-5 py-2 lg:py-2.5 rounded-lg font-semibold text-sm
                  bg-action-success text-white
                  hover:bg-action-success-hover
                  transition-colors duration-200
                  disabled:opacity-50 disabled:cursor-not-allowed
                  cursor-pointer shrink-0 inline-flex items-center gap-2
                "
              >
                <Send className="size-4" />
                <span className="hidden sm:inline">Send</span>
              </button>
            )}
          </div>
        </div>
      </form>
    </TooltipProvider>
  );
}

// Helper: Convert file to base64
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data:mime;base64, prefix
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
