import { cn } from '@/lib/utils'
import { formatCurrency, formatPercent, formatNumber } from '@/lib/utils'
import type { CanalData } from '@/types'

interface CanalTableProps {
  data: CanalData[]
}

export function CanalTable({ data }: CanalTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800">
            {['Canal', 'Objetivo', 'Receita', 'Diferença', 'Conversão', 'Conv. Ideal', 'Vendas', 'Ticket', 'Sessões', 'ROAS', 'CAC'].map((h) => (
              <th key={h} className="text-left text-xs text-zinc-500 font-medium py-3 px-3 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/50">
          {data.map((row) => (
            <tr key={row.canal} className="hover:bg-zinc-800/30 transition-colors">
              <td className="py-3 px-3 text-white font-medium whitespace-nowrap">{row.canal}</td>
              <td className="py-3 px-3 text-zinc-300 whitespace-nowrap">{formatCurrency(row.objetivo)}</td>
              <td className={cn('py-3 px-3 whitespace-nowrap font-medium',
                row.receitaFeita >= row.objetivo ? 'text-emerald-400' : 'text-red-400'
              )}>
                {formatCurrency(row.receitaFeita)}
              </td>
              <td className={cn('py-3 px-3 whitespace-nowrap font-medium',
                row.diferenca >= 0 ? 'text-emerald-400' : 'text-red-400'
              )}>
                {row.diferenca >= 0 ? '+' : ''}{formatCurrency(row.diferenca)}
              </td>
              <td className={cn('py-3 px-3 whitespace-nowrap',
                row.conversao >= row.conversaoIdeal ? 'text-emerald-400' : 'text-red-400'
              )}>
                {formatPercent(row.conversao)}
              </td>
              <td className="py-3 px-3 text-zinc-400 whitespace-nowrap">{formatPercent(row.conversaoIdeal)}</td>
              <td className="py-3 px-3 text-zinc-300 whitespace-nowrap">{formatNumber(row.vendas)}</td>
              <td className={cn('py-3 px-3 whitespace-nowrap',
                row.ticket >= row.ticketIdeal ? 'text-emerald-400' : 'text-red-400'
              )}>
                {formatCurrency(row.ticket)}
              </td>
              <td className={cn('py-3 px-3 whitespace-nowrap',
                row.sessoes >= row.sessoesMeta ? 'text-emerald-400' : 'text-red-400'
              )}>
                {formatNumber(row.sessoes)}
              </td>
              <td className={cn('py-3 px-3 whitespace-nowrap font-medium',
                row.roasAtual >= row.roasIdeal ? 'text-emerald-400' : 'text-red-400'
              )}>
                {row.roasAtual.toFixed(2)}
              </td>
              <td className="py-3 px-3 text-zinc-300 whitespace-nowrap">{formatCurrency(row.cac)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
