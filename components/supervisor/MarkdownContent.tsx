'use client'

import { useMemo } from 'react'

function parseInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part
  )
}

export function MarkdownContent({ text, className }: { text: string; className?: string }) {
  const nodes = useMemo(() => {
    const lines = text.split('\n')
    const result: React.ReactNode[] = []
    let listItems: string[] = []
    let key = 0

    function flushList() {
      if (!listItems.length) return
      result.push(
        <ul key={key++} className="my-2 space-y-1 pl-4 list-none">
          {listItems.map((item, i) => (
            <li key={i} className="relative pl-3 before:content-['–'] before:absolute before:left-0 before:text-muted-foreground">
              {parseInline(item)}
            </li>
          ))}
        </ul>
      )
      listItems = []
    }

    for (const line of lines) {
      if (line.startsWith('### ') || line.startsWith('#### ')) {
        flushList()
        const content = line.replace(/^#{3,4} /, '')
        result.push(
          <h3 key={key++} className="text-sm font-semibold mt-4 mb-1.5 first:mt-0" style={{ color: 'var(--primary)' }}>
            {parseInline(content)}
          </h3>
        )
      } else if (line.startsWith('- ')) {
        listItems.push(line.slice(2))
      } else if (line === '---') {
        flushList()
        result.push(<hr key={key++} className="my-3" style={{ borderColor: 'var(--border)' }} />)
      } else if (line.trim() === '') {
        flushList()
      } else {
        flushList()
        result.push(
          <p key={key++} className="text-sm leading-relaxed my-1.5">
            {parseInline(line)}
          </p>
        )
      }
    }
    flushList()
    return result
  }, [text])

  return <div className={className}>{nodes}</div>
}
