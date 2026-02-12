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
  buildCustomDocumentPrompt,
  DOCUMENT_ACTIONS,
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
