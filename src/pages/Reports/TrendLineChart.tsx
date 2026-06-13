import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { CurrencyCode } from '../../types/settings'
import { formatCurrency } from '../../utils/currency'

interface TrendLineChartPoint {
  date: string
  gastos: number
  ingresos: number
  label: string
}

interface TrendLineChartProps {
  data: TrendLineChartPoint[]
  primaryCurrency: CurrencyCode
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat('es-ES', {
    maximumFractionDigits: 1,
    notation: 'compact',
  }).format(value)
}

export function TrendLineChart({ data, primaryCurrency }: TrendLineChartProps) {
  return (
    <ResponsiveContainer height="100%" width="100%">
      <LineChart
        data={data}
        margin={{ bottom: 8, left: 0, right: 8, top: 8 }}
      >
        <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" />
        <XAxis
          dataKey="label"
          minTickGap={24}
          stroke="#64748b"
          tick={{ fill: '#64748b', fontSize: 12 }}
          tickLine={false}
        />
        <YAxis
          stroke="#64748b"
          tick={{ fill: '#64748b', fontSize: 12 }}
          tickFormatter={(value) => formatCompactNumber(Number(value))}
          tickLine={false}
          width={48}
        />
        <Tooltip
          formatter={(value, name) => [
            formatCurrency(Number(value), primaryCurrency),
            name === 'ingresos' ? 'Ingresos' : 'Gastos',
          ]}
          labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ''}
        />
        <Legend />
        <Line
          activeDot={{ r: 5 }}
          dataKey="ingresos"
          dot={false}
          name="Ingresos"
          stroke="#047857"
          strokeWidth={3}
          type="monotone"
        />
        <Line
          activeDot={{ r: 5 }}
          dataKey="gastos"
          dot={false}
          name="Gastos"
          stroke="#dc2626"
          strokeWidth={3}
          type="monotone"
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

export default TrendLineChart
