'use client'

import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'

interface SelectProps {
  value?: string
  onChange?: (value: string) => void
  options: { label: string; value: string }[]
  placeholder?: string
  className?: string
}

export function Select({ value, onChange, options, placeholder = 'Selecionar', className }: SelectProps) {
  return (
    <div className={cn('relative', className)}>
      <select
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-full appearance-none bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2 pr-8 focus:outline-none focus:border-zinc-500 cursor-pointer"
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
    </div>
  )
}
