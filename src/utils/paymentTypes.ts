export const paymentTypes = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'revolut', label: 'Revolut' },
  { value: 'bizum', label: 'Bizum' },
  { value: 'other', label: 'Otro' },
]

export function getPaymentTypeLabel(paymentType?: string) {
  if (!paymentType) {
    return 'Sin tipo de pago'
  }

  return (
    paymentTypes.find((option) => option.value === paymentType)?.label ??
    paymentType
  )
}
