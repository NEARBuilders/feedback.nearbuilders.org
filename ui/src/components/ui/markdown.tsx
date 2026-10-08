import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

import "./editor/typeset.css";

interface MarkdownProps {
  content: string;
  className?: string;
}

const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "p",
    "a",
    "strong",
    "em",
    "del",
    "br",
    "hr",
    "ul",
    "ol",
    "li",
    "blockquote",
    "pre",
    "code",
    "table",
    "thead",
    "tbody",
    "tfoot",
    "tr",
    "th",
    "td",
    "img",
    "figure",
    "figcaption",
    "input",
    "span",
  ],
  attributes: {
    ...defaultSchema.attributes,
    a: ["href"],
    img: ["src", "alt"],
    code: ["className"],
    input: ["type", "checked", "disabled"],
    span: ["className", "id"],
    pre: ["className"],
    td: ["align"],
    th: ["align"],
    "*": ["id"],
  },
};

const markdownComponents: Components = {
  a: ({ href, children }) => (
    <a href={href ?? "#"} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),

  table: ({ children }) => <div className="typeset-scroll">{children}</div>,
};

export function Markdown({ content, className }: MarkdownProps) {
  return (
    <article className={cn("typeset max-w-none", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize(sanitizeSchema) as any, rehypeHighlight, rehypeSlug]}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}
