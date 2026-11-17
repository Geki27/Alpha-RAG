import React, { useState } from 'react';
import { marked, Token, Tokens } from 'marked';
import { Check, Copy, Terminal, ExternalLink, FileCode, Sigma } from 'lucide-react';
import katex from 'katex';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  role?: 'user' | 'assistant';
  onCitationClick?: (pageOrDoc: string) => void;
}

// Code Block Component with Header & Copy Button
const CodeBlock: React.FC<{ code: string; language?: string }> = ({ code, language = 'text' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayLang = (language || 'código').toUpperCase();

  return (
    <div className="my-3.5 rounded-xl overflow-hidden border border-white/15 bg-[#090909]/90 shadow-xl">
      {/* Code Header Bar */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-white/[0.04] border-b border-white/[0.08] text-xs font-mono">
        <div className="flex items-center gap-2 text-neutral-400">
          <Terminal className="w-3.5 h-3.5 text-white/70" />
          <span className="font-semibold text-neutral-300 tracking-wider text-[11px]">{displayLang}</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/[0.06] hover:bg-white/[0.12] text-neutral-300 hover:text-white transition-all duration-150 text-[11px] cursor-pointer"
          title="Copiar código"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-white" />
              <span className="text-white font-medium">Copiado</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copiar</span>
            </>
          )}
        </button>
      </div>

      {/* Code Body */}
      <div className="p-4 overflow-x-auto text-xs font-mono leading-relaxed text-neutral-200 selection:bg-white selection:text-black">
        <pre className="whitespace-pre">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
};

// Render inline text with LaTeX math support ($...$ and $$...$$)
const renderMathFormattedText = (rawText: string, keyPrefix = 'math'): React.ReactNode => {
  if (!rawText) return null;

  // Split on block math $$...$$ or inline math $...$
  const regex = /(\$\$[\s\S]+?\$\$|\$[^\$\n]+?\$)/g;
  const parts = rawText.split(regex);

  if (parts.length === 1) {
    return rawText;
  }

  return parts.map((part, idx) => {
    const k = `${keyPrefix}-p-${idx}`;

    if (part.startsWith('$$') && part.endsWith('$$') && part.length > 4) {
      const mathStr = part.slice(2, -2).trim();
      let html = '';
      try {
        html = katex.renderToString(mathStr, { displayMode: true, throwOnError: false });
      } catch (err) {
        html = `<span class="font-serif italic">${mathStr}</span>`;
      }
      return (
        <span
          key={k}
          className="my-3 block p-3.5 rounded-xl bg-white/[0.03] border border-white/10 text-center text-white overflow-x-auto shadow-inner"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }

    if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
      const mathStr = part.slice(1, -1).trim();
      let html = '';
      try {
        html = katex.renderToString(mathStr, { displayMode: false, throwOnError: false });
      } catch (err) {
        html = `<span class="font-serif italic">${mathStr}</span>`;
      }
      return (
        <span
          key={k}
          className="inline-block px-1 text-white font-serif"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }

    return <span key={k}>{part}</span>;
  });
};

// Inline tokens renderer
const renderInlineTokens = (
  tokens: Token[] | undefined,
  keyPrefix = 'inline'
): React.ReactNode => {
  if (!tokens || tokens.length === 0) return null;

  return tokens.map((token, index) => {
    const key = `${keyPrefix}-${index}`;

    switch (token.type) {
      case 'strong':
        return (
          <strong key={key} className="font-semibold text-white">
            {renderInlineTokens((token as Tokens.Strong).tokens, `${key}-strong`)}
          </strong>
        );

      case 'em':
        return (
          <em key={key} className="italic text-neutral-200">
            {renderInlineTokens((token as Tokens.Em).tokens, `${key}-em`)}
          </em>
        );

      case 'codespan':
        return (
          <code
            key={key}
            className="px-1.5 py-0.5 mx-0.5 rounded-md bg-white/[0.08] border border-white/15 text-neutral-200 font-mono text-xs shadow-xs"
          >
            {(token as Tokens.Codespan).text}
          </code>
        );

      case 'link': {
        const linkToken = token as Tokens.Link;
        return (
          <a
            key={key}
            href={linkToken.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white underline underline-offset-4 decoration-white/40 hover:decoration-white hover:text-neutral-200 transition-colors inline-flex items-center gap-0.5 font-medium"
          >
            {renderInlineTokens(linkToken.tokens, `${key}-link`)}
            <ExternalLink className="w-2.5 h-2.5 inline-block opacity-70 ml-0.5" />
          </a>
        );
      }

      case 'del':
        return (
          <del key={key} className="line-through text-neutral-500">
            {renderInlineTokens((token as Tokens.Del).tokens, `${key}-del`)}
          </del>
        );

      case 'br':
        return <br key={key} />;

      case 'escape':
        return <span key={key}>{(token as Tokens.Escape).text}</span>;

      case 'text':
      default: {
        const textToken = token as Tokens.Text;
        if (textToken.tokens && textToken.tokens.length > 0) {
          return <span key={key}>{renderInlineTokens(textToken.tokens, `${key}-subtext`)}</span>;
        }
        return <span key={key}>{renderMathFormattedText(textToken.text, `${key}-m`)}</span>;
      }
    }
  });
};

// Main Markdown Renderer Component
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className = '',
  role = 'assistant',
}) => {
  // Parse markdown into AST tokens using marked.lexer
  const tokens = React.useMemo(() => {
    try {
      return marked.lexer(content, { gfm: true, breaks: true });
    } catch (err) {
      console.error('Error parsing markdown:', err);
      return [];
    }
  }, [content]);

  if (!tokens || tokens.length === 0) {
    return <div className={`text-sm text-neutral-200 ${className}`}>{content}</div>;
  }

  return (
    <div
      className={`markdown-body space-y-3 font-sans text-sm leading-relaxed text-neutral-200 selection:bg-white selection:text-black ${className}`}
    >
      {tokens.map((token, index) => {
        const key = `block-${index}`;

        switch (token.type) {
          case 'heading': {
            const headingToken = token as Tokens.Heading;
            const depth = headingToken.depth;
            const inlineContent = renderInlineTokens(headingToken.tokens, `${key}-h`);

            if (depth === 1) {
              return (
                <h1
                  key={key}
                  className="text-xl sm:text-2xl font-bold text-white tracking-tight pt-3 pb-2 border-b border-white/15 flex items-center gap-2 first:pt-0"
                >
                  {inlineContent}
                </h1>
              );
            }
            if (depth === 2) {
              return (
                <h2
                  key={key}
                  className="text-lg sm:text-xl font-semibold text-white tracking-tight pt-3 pb-1 border-b border-white/[0.08] flex items-center gap-2 first:pt-0"
                >
                  {inlineContent}
                </h2>
              );
            }
            if (depth === 3) {
              return (
                <h3
                  key={key}
                  className="text-base font-semibold text-neutral-100 tracking-tight pt-2 pb-0.5 flex items-center gap-1.5 first:pt-0"
                >
                  {inlineContent}
                </h3>
              );
            }
            return (
              <h4 key={key} className="text-sm font-semibold text-neutral-300 pt-1.5 first:pt-0">
                {inlineContent}
              </h4>
            );
          }

          case 'paragraph': {
            const paragraphToken = token as Tokens.Paragraph;
            return (
              <p key={key} className="text-sm leading-relaxed text-neutral-200 my-1.5">
                {renderInlineTokens(paragraphToken.tokens, `${key}-p`)}
              </p>
            );
          }

          case 'code': {
            const codeToken = token as Tokens.Code;
            return <CodeBlock key={key} code={codeToken.text} language={codeToken.lang} />;
          }

          case 'list': {
            const listToken = token as Tokens.List;
            if (listToken.ordered) {
              return (
                <ol key={key} className="my-2.5 space-y-1.5 pl-1 list-none">
                  {listToken.items.map((item, itemIdx) => (
                    <li key={`${key}-item-${itemIdx}`} className="flex items-start gap-2 text-sm text-neutral-200">
                      <span className="font-mono text-neutral-400 font-semibold text-xs mt-0.5 min-w-[18px] text-right">
                        {(listToken.start || 1) + itemIdx}.
                      </span>
                      <div className="flex-1">
                        {renderInlineTokens(item.tokens, `${key}-item-${itemIdx}`)}
                      </div>
                    </li>
                  ))}
                </ol>
              );
            }

            return (
              <ul key={key} className="my-2.5 space-y-1.5 pl-1 list-none">
                {listToken.items.map((item, itemIdx) => {
                  if (item.task) {
                    return (
                      <li key={`${key}-task-${itemIdx}`} className="flex items-start gap-2.5 text-sm text-neutral-200">
                        <span
                          className={`mt-0.5 flex items-center justify-center w-4 h-4 rounded border text-[10px] font-mono ${
                            item.checked
                              ? 'bg-white text-black border-white'
                              : 'border-white/30 bg-white/[0.04] text-transparent'
                          }`}
                        >
                          {item.checked ? '✓' : ''}
                        </span>
                        <div className="flex-1">
                          {renderInlineTokens(item.tokens, `${key}-task-${itemIdx}`)}
                        </div>
                      </li>
                    );
                  }

                  return (
                    <li key={`${key}-bullet-${itemIdx}`} className="flex items-start gap-2.5 text-sm text-neutral-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-neutral-300 mt-2 shrink-0 opacity-80" />
                      <div className="flex-1">
                        {renderInlineTokens(item.tokens, `${key}-bullet-${itemIdx}`)}
                      </div>
                    </li>
                  );
                })}
              </ul>
            );
          }

          case 'blockquote': {
            const quoteToken = token as Tokens.Blockquote;
            return (
              <blockquote
                key={key}
                className="my-3 pl-4 py-2 border-l-2 border-white/40 bg-white/[0.03] rounded-r-xl text-neutral-300 italic text-sm space-y-1 backdrop-blur-xs"
              >
                {quoteToken.tokens.map((subToken, subIdx) => {
                  if (subToken.type === 'paragraph') {
                    return (
                      <p key={`${key}-quote-${subIdx}`} className="my-0.5">
                        {renderInlineTokens((subToken as Tokens.Paragraph).tokens, `${key}-q-${subIdx}`)}
                      </p>
                    );
                  }
                  return null;
                })}
              </blockquote>
            );
          }

          case 'table': {
            const tableToken = token as Tokens.Table;
            return (
              <div key={key} className="overflow-x-auto my-3.5 rounded-xl border border-white/15 bg-white/[0.02]">
                <table className="min-w-full divide-y divide-white/10 text-left text-xs font-sans">
                  <thead className="bg-white/[0.06] text-white font-mono uppercase tracking-wider text-[11px]">
                    <tr>
                      {tableToken.header.map((th, thIdx) => (
                        <th
                          key={`${key}-th-${thIdx}`}
                          className={`px-3.5 py-2.5 font-semibold text-neutral-200 ${
                            th.align === 'center'
                              ? 'text-center'
                              : th.align === 'right'
                              ? 'text-right'
                              : 'text-left'
                          }`}
                        >
                          {renderInlineTokens(th.tokens, `${key}-th-${thIdx}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06] bg-transparent">
                    {tableToken.rows.map((row, rowIdx) => (
                      <tr
                        key={`${key}-tr-${rowIdx}`}
                        className="hover:bg-white/[0.03] transition-colors duration-100"
                      >
                        {row.map((cell, cellIdx) => (
                          <td
                            key={`${key}-td-${rowIdx}-${cellIdx}`}
                            className={`px-3.5 py-2.5 text-neutral-300 ${
                              tableToken.align[cellIdx] === 'center'
                                ? 'text-center'
                                : tableToken.align[cellIdx] === 'right'
                                ? 'text-right'
                                : 'text-left'
                            }`}
                          >
                            {renderInlineTokens(cell.tokens, `${key}-td-${rowIdx}-${cellIdx}`)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }

          case 'hr':
            return <hr key={key} className="my-4 border-t border-white/15" />;

          case 'space':
            return null;

          default:
            return (
              <div key={key} className="text-sm text-neutral-200 my-1">
                {(token as any).raw || ''}
              </div>
            );
        }
      })}
    </div>
  );
};
