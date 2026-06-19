interface SensitiveAmountProps {
  hidden: boolean
  value: string
}

export function SensitiveAmount({ hidden, value }: SensitiveAmountProps) {
  return <>{hidden ? '****' : value}</>
}
