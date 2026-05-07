'use client'

import { useState, KeyboardEvent } from 'react'
import { Input } from '@/components/ui/input'

interface TagInputProps {
  tags: string[]
  onChange: (tags: string[]) => void
}

export function TagInput({ tags, onChange }: TagInputProps) {
  const [inputValue, setInputValue] = useState('')

  function addTag(raw: string) {
    const tag = raw.trim().toLowerCase().replace(/\s+/g, '-')
    if (!tag || tags.includes(tag) || tags.length >= 20) return
    onChange([...tags, tag])
    setInputValue('')
  }

  function removeTag(tag: string) {
    onChange(tags.filter(t => t !== tag))
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(inputValue)
    }
    if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags[tags.length - 1])
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 min-h-[1.75rem]">
        {tags.map(tag => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
            style={{
              background: 'oklch(0.375 0.132 288 / 0.12)',
              color: 'oklch(0.375 0.132 288)',
              border: '1px solid oklch(0.375 0.132 288 / 0.25)',
            }}
          >
            #{tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="hover:opacity-70 transition-opacity leading-none"
              aria-label={`Remover tag ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <Input
        value={inputValue}
        onChange={e => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { if (inputValue.trim()) addTag(inputValue) }}
        placeholder="Adicionar tag (Enter ou vírgula)"
        className="text-sm"
        disabled={tags.length >= 20}
      />
      <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
        {tags.length}/20 tags · Enter ou vírgula para adicionar · Backspace para remover a última
      </p>
    </div>
  )
}
