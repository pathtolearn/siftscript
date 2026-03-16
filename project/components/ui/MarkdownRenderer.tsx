import React from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  const elements = parseMarkdown(content);
  return <div className={`markdown-rendered ${className}`}>{elements}</div>;
}

function parseMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Empty line
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim())) {
      elements.push(<hr key={key++} className="my-3 border-gray-200" />);
      i++;
      continue;
    }

    // Headings
    if (line.startsWith('# ')) {
      elements.push(<h1 key={key++} className="text-xl font-bold text-gray-900 mt-4 mb-2">{renderInline(line.slice(2))}</h1>);
      i++;
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(<h2 key={key++} className="text-lg font-semibold text-gray-900 mt-3 mb-1.5">{renderInline(line.slice(3))}</h2>);
      i++;
      continue;
    }
    if (line.startsWith('### ')) {
      elements.push(<h3 key={key++} className="text-base font-semibold text-gray-900 mt-2.5 mb-1">{renderInline(line.slice(4))}</h3>);
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <blockquote key={key++} className="border-l-3 border-gray-300 pl-3 my-2 text-gray-600 italic">
          {quoteLines.map((ql, qi) => (
            <p key={qi} className="my-0.5">{renderInline(ql)}</p>
          ))}
        </blockquote>
      );
      continue;
    }

    // Checkbox list items
    if (/^[-*]\s+\[[ x]\]\s/.test(line)) {
      const checkItems: { checked: boolean; text: string }[] = [];
      while (i < lines.length && /^[-*]\s+\[[ x]\]\s/.test(lines[i])) {
        const checked = /^[-*]\s+\[x\]\s/i.test(lines[i]);
        const text = lines[i].replace(/^[-*]\s+\[[ x]\]\s/, '');
        checkItems.push({ checked, text });
        i++;
      }
      elements.push(
        <ul key={key++} className="my-2 space-y-1">
          {checkItems.map((item, ci) => (
            <li key={ci} className="flex items-start gap-2">
              <input type="checkbox" checked={item.checked} readOnly className="mt-1 rounded" />
              <span className={`text-sm ${item.checked ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                {renderInline(item.text)}
              </span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Unordered list
    if (/^[-*+]\s/.test(line)) {
      const listItems: string[] = [];
      while (i < lines.length && /^[-*+]\s/.test(lines[i])) {
        listItems.push(lines[i].replace(/^[-*+]\s/, ''));
        i++;
      }
      elements.push(
        <ul key={key++} className="my-2 ml-4 space-y-1 list-disc">
          {listItems.map((li, li_idx) => (
            <li key={li_idx} className="text-sm text-gray-700">{renderInline(li)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      const listItems: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        listItems.push(lines[i].replace(/^\d+\.\s/, ''));
        i++;
      }
      elements.push(
        <ol key={key++} className="my-2 ml-4 space-y-1 list-decimal">
          {listItems.map((li, li_idx) => (
            <li key={li_idx} className="text-sm text-gray-700">{renderInline(li)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Regular paragraph — collect consecutive non-empty, non-special lines
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].startsWith('#') &&
      !lines[i].startsWith('> ') &&
      !/^[-*+]\s/.test(lines[i]) &&
      !/^\d+\.\s/.test(lines[i]) &&
      !/^(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      elements.push(
        <p key={key++} className="text-sm text-gray-700 leading-relaxed my-1.5">
          {renderInline(paraLines.join('\n'))}
        </p>
      );
    }
  }

  return elements;
}

function renderInline(text: string): React.ReactNode {
  // Process inline markdown: bold, italic, code, links
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let partKey = 0;

  while (remaining.length > 0) {
    // Bold + italic
    let match = remaining.match(/^\*\*\*(.*?)\*\*\*/);
    if (match) {
      parts.push(<strong key={partKey++}><em>{match[1]}</em></strong>);
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Bold
    match = remaining.match(/^\*\*(.*?)\*\*/);
    if (match) {
      parts.push(<strong key={partKey++} className="font-semibold text-gray-900">{match[1]}</strong>);
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Italic with *
    match = remaining.match(/^\*(.*?)\*/);
    if (match) {
      parts.push(<em key={partKey++} className="italic">{match[1]}</em>);
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Inline code
    match = remaining.match(/^`(.*?)`/);
    if (match) {
      parts.push(
        <code key={partKey++} className="px-1 py-0.5 bg-gray-100 text-gray-800 rounded text-xs font-mono">
          {match[1]}
        </code>
      );
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Link [text](url)
    match = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (match) {
      parts.push(
        <a key={partKey++} href={match[2]} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
          {match[1]}
        </a>
      );
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Plain text — consume until the next special char or end
    const nextSpecial = remaining.slice(1).search(/[*`\[]/);
    if (nextSpecial === -1) {
      parts.push(remaining);
      remaining = '';
    } else {
      parts.push(remaining.slice(0, nextSpecial + 1));
      remaining = remaining.slice(nextSpecial + 1);
    }
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}
