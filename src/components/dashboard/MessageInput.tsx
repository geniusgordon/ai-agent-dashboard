import {
  ChevronDown,
  ImagePlus,
  Loader2,
  Send,
  StopCircle,
  X,
} from "lucide-react";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  SessionConfigValueOption,
  SessionMode,
  UsageUpdatePayload,
} from "@/lib/agents/types";
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
  /** Available model options */
  availableModels?: SessionConfigValueOption[];
  /** Current model */
  currentModel?: string;
  /** Callback to change model */
  onSetModel?: (model: string) => void;
  /** Whether a model change is in progress */
  isSettingModel?: boolean;
  /** Available thought level options */
  availableThoughtLevels?: SessionConfigValueOption[];
  /** Current thought level */
  currentThoughtLevel?: string;
  /** Callback to change thought level */
  onSetThoughtLevel?: (thoughtLevel: string) => void;
  /** Whether a thought-level change is in progress */
  isSettingThoughtLevel?: boolean;
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

interface ConfigDropdownProps {
  value?: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  isLoading?: boolean;
  label: string;
  options: SessionConfigValueOption[];
}

function ConfigDropdown({
  value,
  onValueChange,
  disabled,
  isLoading,
  label,
  options,
}: ConfigDropdownProps) {
  const current = options.find((o) => o.value === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          disabled={disabled}
          className="gap-1 text-muted-foreground hover:text-foreground"
        >
          {isLoading ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <span className="max-w-[6rem] truncate">
              {current?.name ?? label}
            </span>
          )}
          <ChevronDown className="size-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next) => {
            if (next) onValueChange(next);
          }}
        >
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

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
  availableModels,
  currentModel,
  onSetModel,
  isSettingModel,
  availableThoughtLevels,
  currentThoughtLevel,
  onSetThoughtLevel,
  isSettingThoughtLevel,
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
  const showModelSelector =
    availableModels && availableModels.length > 0 && onSetModel;
  const showThoughtLevelSelector =
    availableThoughtLevels &&
    availableThoughtLevels.length > 0 &&
    onSetThoughtLevel;
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
        <div className="flex flex-col gap-1.5 px-3 pb-3 pt-1">
          {/* Context window meter — above the input container */}
          {usageInfo && usageInfo.size > 0 && !isAgentBusy && (
            <ContextMeter usage={usageInfo} />
          )}

          {/* Processing indicator — above the input container */}
          {isAgentBusy && (
            <div className="flex items-center gap-2 px-1 py-1 text-xs text-status-running">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-running opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-status-running" />
              </span>
              <span className="font-medium">Agent is thinking...</span>
            </div>
          )}

          {/* Rounded input container */}
          <div className="relative">
            {/* Command palette (positioned above the container) */}
            {showCommandPalette && (
              <CommandPalette
                commands={availableCommands!}
                filter={commandFilter}
                onSelect={selectCommand}
                selectedIndex={commandSelectedIndex}
                onSelectedIndexChange={setCommandSelectedIndex}
              />
            )}

            <div
              className={`
                rounded-2xl border bg-muted/30 transition-[border-color,box-shadow]
                focus-within:border-ring focus-within:ring-1 focus-within:ring-ring/30
                ${isDragging ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border"}
              `}
            >
              {/* Image previews */}
              {images.length > 0 && (
                <div className="flex flex-wrap gap-2 px-3 pt-3">
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

              {/* Textarea — full width */}
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
                  w-full min-h-[2.5rem] max-h-[10rem] px-4 pt-3 pb-1
                  text-base sm:text-sm bg-transparent border-none font-sans
                  text-foreground placeholder-muted-foreground
                  focus:outline-none disabled:opacity-50
                  resize-none
                "
              />

              {/* Bottom toolbar */}
              <div className="flex items-center gap-1 px-2 pb-2">
                {/* Left side: image attach + config dropdowns */}
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
                  <ConfigDropdown
                    value={currentModeId}
                    onValueChange={onSetMode}
                    disabled={isSettingMode}
                    isLoading={isSettingMode}
                    label="Mode"
                    options={availableModes!.map((mode) => ({
                      value: mode.id,
                      name: mode.name,
                    }))}
                  />
                )}

                {showModelSelector && (
                  <ConfigDropdown
                    value={currentModel}
                    onValueChange={onSetModel}
                    disabled={isSettingModel}
                    isLoading={isSettingModel}
                    label="Model"
                    options={availableModels!}
                  />
                )}

                {showThoughtLevelSelector && (
                  <ConfigDropdown
                    value={currentThoughtLevel}
                    onValueChange={onSetThoughtLevel}
                    disabled={isSettingThoughtLevel}
                    isLoading={isSettingThoughtLevel}
                    label="Thinking"
                    options={availableThoughtLevels!}
                  />
                )}

                {/* Spacer */}
                <div className="flex-1" />

                {/* Right side: Send or Stop */}
                {isAgentBusy && onCancel ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="xs"
                    onClick={onCancel}
                    disabled={isCancelling}
                    className="cursor-pointer"
                  >
                    {isCancelling ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <StopCircle className="size-3" />
                    )}
                    <span className="hidden sm:inline">
                      {isCancelling ? "Stopping…" : "Stop"}
                    </span>
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    variant="success"
                    size="icon-xs"
                    disabled={!canSubmit || disabled}
                    className="cursor-pointer rounded-full"
                  >
                    <Send className="size-3" />
                  </Button>
                )}
              </div>
            </div>
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
