export interface AssistantDemoResponse {
  readonly kind: 'proposal' | 'answer'
  readonly assistant: string
  readonly details: readonly { readonly label: string; readonly value: string }[]
  readonly result: string
}

function normalizeDemoInput(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function extractAmount(normalizedValue: string, fallback: string): string {
  const match = normalizedValue.match(/(\d+(?:[,.]\d{1,2})?)\s*(?:eur|euro|euros|€)?/)
  return `${match?.[1]?.replace(',', '.') ?? fallback} EUR`
}

export function resolveAssistantDemoResponse(message: string): AssistantDemoResponse {
  const normalized = normalizeDemoInput(message)

  if (normalized.includes('cuanto') && /\b(gane|ingrese|dinero)\b/.test(normalized)) {
    return {
      kind: 'answer',
      assistant: 'Este es un resumen financiero simulado del mes.',
      details: [
        { label: 'Ingresos', value: '1.840 EUR' },
        { label: 'Gastos', value: '620 EUR' },
        { label: 'Balance', value: '1.220 EUR' },
        { label: 'Comparación', value: '+12 % frente al mes anterior' },
      ],
      result: 'Resumen consultado con datos ficticios.',
    }
  }

  if (/\b(recibi|cobre|gane|ingrese|me pagaron)\b/.test(normalized)) {
    return {
      kind: 'proposal',
      assistant: 'He preparado un nuevo ingreso.',
      details: [
        { label: 'Importe', value: extractAmount(normalized, '120') },
        { label: 'Categoría', value: 'Servicios' },
        { label: 'Fecha', value: 'Hoy' },
        { label: 'Estado', value: 'Sin reportar' },
      ],
      result: 'Ingreso registrado correctamente.',
    }
  }

  if (/\b(gaste|pague|compre)\b/.test(normalized)) {
    const category = /\b(gasolina|transporte|taxi|bus|metro)\b/.test(normalized)
      ? 'Transporte'
      : 'Gastos generales'

    return {
      kind: 'proposal',
      assistant: 'He preparado este gasto.',
      details: [
        { label: 'Importe', value: extractAmount(normalized, '30') },
        { label: 'Categoría', value: category },
        { label: 'Fecha', value: 'Hoy' },
      ],
      result: 'Gasto registrado correctamente.',
    }
  }

  if (/\b(cita|turno|agenda|reunion)\b/.test(normalized)) {
    const timeMatch = normalized.match(/(\d{1,2}:\d{2})/)

    return {
      kind: 'proposal',
      assistant: 'He preparado una nueva cita.',
      details: [
        { label: 'Fecha', value: normalized.includes('manana') ? 'Mañana' : 'Hoy' },
        { label: 'Hora', value: timeMatch?.[1] ?? '18:30' },
        { label: 'Recordatorio', value: '30 minutos antes' },
        { label: 'Ingreso esperado', value: 'Pendiente de definir' },
      ],
      result: 'Cita añadida a la agenda de demostración.',
    }
  }

  if (normalized.includes('sin report') || normalized.includes('pendiente')) {
    return {
      kind: 'answer',
      assistant: 'He encontrado ingresos simulados pendientes de reportar.',
      details: [
        { label: '120 EUR', value: 'Servicio de hoy' },
        { label: '85 EUR', value: 'Servicio del martes' },
        { label: 'Acción sugerida', value: 'Revisar y marcar como reportados' },
      ],
      result: 'Lista preparada sin consultar datos reales.',
    }
  }

  return {
    kind: 'answer',
    assistant: 'Puedo simular ingresos, gastos, citas y consultas financieras con frases de ejemplo.',
    details: [],
    result: 'Respuesta guiada generada solo con reglas locales de demostración.',
  }
}
