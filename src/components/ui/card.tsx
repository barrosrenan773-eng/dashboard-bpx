import { cn } from '@/lib/utils'

interface CardProps {
  children: React.ReactNode
  className?: string
}

export function Card({ children, className }: CardProps) {
  return (
    <div className={cn('bg-zinc-900 border border-zinc-800 rounded-xl p-4', className)}>
      {children}
    </div>
  )
}

export function CardHeader({ children, className }: CardProps) {
  return (
    <div className={cn('mb-3', className)}>
      {children}
    </div>
  )
}

export function CardTitle({ children, className }: CardProps) {
  return (
    <h3 className={cn('text-xs font-medium text-zinc-400 uppercase tracking-wider', className)}>
      {children}
    </h3>
  )
}

export function CardValue({ children, className }: CardProps) {
  return (
    <p className={cn('text-2xl font-bold text-white mt-1', className)}>
      {children}
    </p>
  )
}
