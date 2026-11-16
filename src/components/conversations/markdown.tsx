import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

// Raw HTML is never rendered (react-markdown escapes it by default) and unsafe
// link protocols are stripped by its default URL transform.
const components: Components = {
  p: ({ children }) => <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>,
  h1: ({ children }) => (
    <h3 className="mt-3 mb-1.5 text-base font-bold first:mt-0">{children}</h3>
  ),
  h2: ({ children }) => (
    <h3 className="mt-3 mb-1.5 text-[15px] font-bold first:mt-0">{children}</h3>
  ),
  h3: ({ children }) => (
    <h4 className="mt-2.5 mb-1 text-sm font-bold first:mt-0">{children}</h4>
  ),
  h4: ({ children }) => (
    <h4 className="mt-2 mb-1 text-sm font-semibold first:mt-0">{children}</h4>
  ),
  ul: ({ children }) => <ul className="my-1.5 list-disc space-y-0.5 pl-5">{children}</ul>,
  ol: ({ children }) => (
    <ol className="my-1.5 list-decimal space-y-0.5 pl-5">{children}</ol>
  ),
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-accent underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-accent/30 pl-3 text-muted">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-accent/15" />,
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-lg border border-border bg-canvas p-3 text-xs leading-5 [&_code]:bg-transparent [&_code]:p-0">
      {children}
    </pre>
  ),
  code: ({ children }) => (
    <code className="rounded bg-canvas px-1 py-0.5 font-mono text-[0.85em]">
      {children}
    </code>
  ),
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-left text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-border bg-canvas px-2.5 py-1.5 font-semibold">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-border/60 px-2.5 py-1.5 align-top">{children}</td>
  ),
  img: ({ alt }) => <span className="text-muted">[image: {alt}]</span>,
};

export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components} skipHtml>
      {children}
    </ReactMarkdown>
  );
}
