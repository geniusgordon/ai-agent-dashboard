import { Command } from "lucide-react";
import { useEffect, useRef } from "react";

export interface CommandPaletteProps {
  commands: Array<{ name: string; description: string; hasInput: boolean }>;
  filter: string;
  onSelect: (commandName: string) => void;
  selectedIndex: number;
  onSelectedIndexChange: (index: number) => void;
}

export function CommandPalette({
  commands,
  filter,
  onSelect,
  selectedIndex,
  onSelectedIndexChange,
}: CommandPaletteProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // Filter commands by what the user typed after "/"
  const filtered = commands.filter((cmd) =>
    cmd.name.toLowerCase().startsWith(filter.toLowerCase()),
  );

  // Clamp selectedIndex when filtered list changes
  useEffect(() => {
    if (selectedIndex >= filtered.length) {
      onSelectedIndexChange(Math.max(0, filtered.length - 1));
    }
  }, [filtered.length, selectedIndex, onSelectedIndexChange]);

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const selected = list.children[selectedIndex] as HTMLElement | undefined;
    selected?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (filtered.length === 0) return null;

  return (
    <div
      ref={listRef}
      role="listbox"
      className="
        absolute bottom-full left-0 right-0 mb-1
        max-h-48 overflow-y-auto
        rounded-lg border border-border bg-popover shadow-lg
        z-50
      "
    >
      {filtered.map((cmd, i) => (
        <button
          key={cmd.name}
          type="button"
          role="option"
          aria-selected={i === selectedIndex}
          onMouseDown={(e) => {
            e.preventDefault(); // Keep focus on textarea
            onSelect(cmd.name);
          }}
          onMouseEnter={() => onSelectedIndexChange(i)}
          className={`
            w-full text-left px-3 py-2 flex items-start gap-2.5 text-sm
            cursor-pointer transition-colors
            ${i === selectedIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"}
          `}
        >
          <Command className="size-4 shrink-0 mt-0.5 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="font-medium font-mono text-xs">/{cmd.name}</div>
            <div className="text-xs text-muted-foreground truncate">
              {cmd.description}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
