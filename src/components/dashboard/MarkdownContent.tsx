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
      className={`prose prose-sm max-w-none break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 ${isDark ? "prose-invert" : ""}`}
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
    a({ href, children, ...props }) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 decoration-primary/40 hover:decoration-primary/80 transition-colors"
          {...props}
        >
          {children}
        </a>
      );
    },
    blockquote({ children }) {
      return (
        <blockquote className="border-l-2 border-primary/30 pl-3 my-2 text-muted-foreground italic">
          {children}
        </blockquote>
      );
    },
    h1({ children }) {
      return (
        <h1 className="text-lg font-semibold font-heading mt-4 mb-2 text-foreground">
          {children}
        </h1>
      );
    },
    h2({ children }) {
      return (
        <h2 className="text-base font-semibold font-heading mt-3 mb-1.5 text-foreground">
          {children}
        </h2>
      );
    },
    h3({ children }) {
      return (
        <h3 className="text-sm font-semibold font-heading mt-2.5 mb-1 text-foreground">
          {children}
        </h3>
      );
    },
    h4({ children }) {
      return (
        <h4 className="text-sm font-medium font-heading mt-2 mb-1 text-foreground">
          {children}
        </h4>
      );
    },
    ul({ children }) {
      return <ul className="my-1.5 pl-4 list-disc space-y-0.5">{children}</ul>;
    },
    ol({ children }) {
      return (
        <ol className="my-1.5 pl-4 list-decimal space-y-0.5">{children}</ol>
      );
    },
    li({ children }) {
      return (
        <li className="text-foreground/90 leading-relaxed">{children}</li>
      );
    },
    hr() {
      return <hr className="my-3 border-border" />;
    },
    img({ src, alt, ...props }) {
      return (
        <img
          src={src}
          alt={alt ?? ""}
          className="max-w-full rounded-md my-2"
          loading="lazy"
          {...props}
        />
      );
    },
    pre({ children }) {
      return <>{children}</>;
    },
  };
}
