import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface KPICardProps {
  title: string
  value: string
  subtitle?: string
  trend?: number
  trendLabel?: string
  highlight?: 'success' | 'danger' | 'warning' | 'default'
  size?: 'sm' | 'md' | 'lg'
}

export function KPICard({
  title,
  value,
  subtitle,
  trend,
  trendLabel,
  highlight = 'default',
  size = 'md',
}: KPICardProps) {
  const TrendIcon = trend === undefined ? Minus : trend >= 0 ? TrendingUp : TrendingDown
  const trendPositive = trend !== undefined && trend >= 0

  return (
    <div className={cn(
      'bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col gap-2',
      highlight === 'success' && 'border-emerald-500/30 bg-emerald-500/5',
      highlight === 'danger' && 'border-red-500/30 bg-red-500/5',
      highlight === 'warning' && 'border-yellow-500/30 bg-yellow-500/5',
    )}>
      <p className="text-zinc-400 text-xs font-medium uppercase tracking-wider">{title}</p>

      <p className={cn(
        'font-bold leading-tight',
        size === 'sm' && 'text-xl',
        size === 'md' && 'text-2xl',
        size === 'lg' && 'text-3xl',
        highlight === 'success' && 'text-emerald-400',
        highlight === 'danger' && 'text-red-400',
        highlight === 'warning' && 'text-yellow-400',
        highlight === 'default' && 'text-white',
      )}>
        {value}
      </p>

      {(trend !== undefined || subtitle) && (
        <div className="flex items-center gap-2">
          {trend !== undefined && (
            <span className={cn(
              'flex items-center gap-1 text-xs font-medium',
              trendPositive ? 'text-emerald-400' : 'text-red-400'
            )}>
              <TrendIcon className="w-3 h-3" />
              {trend > 0 ? '+' : ''}{trend?.toFixed(1)}%
            </span>
          )}
          {subtitle && (
            <span className="text-zinc-500 text-xs">{subtitle}</span>
          )}
          {trendLabel && (
            <span className="text-zinc-500 text-xs">{trendLabel}</span>
          )}
        </div>
      )}
    </div>
  )
}
