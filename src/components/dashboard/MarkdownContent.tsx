import Markdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  oneDark,
  oneLight,
} from "react-syntax-highlighter/dist/cjs/styles/prism";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

import { useTheme } from "@/hooks/useTheme";
import { CopyButton } from "./CopyButton";

/**
 * Shared Markdown renderer with custom components for code blocks (syntax
 * highlighting + copy button), tables, and inline code.  Used by both
 * LogEntryContent and GenericToolUpdateEntry so styling stays consistent.
 */
export function MarkdownContent({
  children,
}: {
  children: string | null | undefined;
}) {
  const { theme } = useTheme();
  if (!children) return null;

  const isDark = theme === "dark";
  return (
    <div
      className={`prose prose-sm max-w-none break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_hr]:border-border [&_hr]:my-3 ${isDark ? "prose-invert" : ""}`}
    >
      <Markdown
        components={getMarkdownComponents(isDark)}
        remarkPlugins={[remarkGfm, remarkBreaks]}
      >
        {children}
      </Markdown>
    </div>
  );
}

function getMarkdownComponents(
  isDark: boolean,
): React.ComponentProps<typeof Markdown>["components"] {
  const syntaxTheme = isDark ? oneDark : oneLight;
  const codeBlockBg = isDark ? "bg-[#282c34]" : "bg-[#fafafa]";
  const codeBlockHeaderBg = isDark ? "bg-white/5" : "bg-black/[0.03]";

  return {
    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || "");
      const codeString = String(children).replace(/\n$/, "");
      const isBlock = !!match || codeString.includes("\n");
      const language = match?.[1];

      if (!isBlock) {
        return (
          <code
            className="bg-secondary/80 border border-border/50 px-1.5 py-0.5 rounded text-[0.85em] font-mono"
            {...props}
          >
            {children}
          </code>
        );
      }

      return (
        <div
          className={`not-prose my-3 rounded-lg border border-border/50 overflow-hidden ${codeBlockBg}`}
        >
          <div
            className={`flex items-center justify-between px-4 py-1.5 ${codeBlockHeaderBg} border-b border-border/30`}
          >
            <span className="text-xs text-muted-foreground font-mono select-none">
              {language || "text"}
            </span>
            <CopyButton text={codeString} />
          </div>
          {language ? (
            <SyntaxHighlighter
              style={syntaxTheme}
              language={language}
              PreTag="div"
              customStyle={{
                margin: 0,
                padding: "0.75rem 1rem",
                borderRadius: 0,
                fontSize: "0.85em",
                background: "transparent",
              }}
              codeTagProps={{
                style: { background: "transparent" },
              }}
            >
              {codeString}
            </SyntaxHighlighter>
          ) : (
            <pre className="p-3 overflow-x-auto text-[0.85em] leading-relaxed">
              <code className="font-mono">{codeString}</code>
            </pre>
          )}
        </div>
      );
    },
    table({ children }) {
      return (
        <div className="not-prose my-3 overflow-x-auto rounded-lg border border-border/50">
          <table className="w-full text-sm border-collapse">{children}</table>
        </div>
      );
    },
    thead({ children }) {
      return <thead className="bg-secondary/50 text-left">{children}</thead>;
    },
    th({ children }) {
      return (
        <th className="px-3 py-2 font-semibold text-foreground border-b border-border/50 whitespace-nowrap">
          {children}
        </th>
      );
    },
    td({ children }) {
      return (
        <td className="px-3 py-2 border-b border-border/30">{children}</td>
      );
    },
    tr({ children, ...props }) {
      return (
        <tr
          className="hover:bg-accent/30 transition-colors even:bg-secondary/20"
          {...props}
        >
          {children}
        </tr>
      );
    },
    pre({ children }) {
      return <>{children}</>;
    },
  };
}
