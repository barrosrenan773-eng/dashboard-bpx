'use client'

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'
import type { DailyData } from '@/types'

interface RevenueChartProps {
  data: DailyData[]
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-3 shadow-xl">
        <p className="text-zinc-400 text-xs mb-2">{label}</p>
        {payload.map((entry: any) => (
          <div key={entry.name} className="flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
            <span className="text-zinc-300">{entry.name}:</span>
            <span className="text-white font-medium">
              {typeof entry.value === 'number' && entry.value > 100
                ? formatCurrency(entry.value)
                : entry.value}
            </span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

export function RevenueChart({ data }: RevenueChartProps) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: '#71717a', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#71717a', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }}
          formatter={(value) => <span style={{ color: '#a1a1aa' }}>{value}</span>}
        />
        <Bar dataKey="objetivo" name="Objetivo" fill="#3f3f46" radius={[3, 3, 0, 0]} />
        <Bar dataKey="receita" name="Receita Feita" fill="#10b981" radius={[3, 3, 0, 0]} />
        <Line
          type="monotone"
          dataKey="lucro"
          name="Lucro"
          stroke="#6366f1"
          strokeWidth={2}
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
