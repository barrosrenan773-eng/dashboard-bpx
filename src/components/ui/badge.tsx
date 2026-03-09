import { cn } from '@/lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'success' | 'danger' | 'warning' | 'neutral'
  className?: string
}

export function Badge({ children, variant = 'neutral', className }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
      {
        'bg-emerald-500/10 text-emerald-400': variant === 'success',
        'bg-red-500/10 text-red-400': variant === 'danger',
        'bg-yellow-500/10 text-yellow-400': variant === 'warning',
        'bg-zinc-700 text-zinc-300': variant === 'neutral',
      },
      className
    )}>
      {children}
    </span>
  )
}
