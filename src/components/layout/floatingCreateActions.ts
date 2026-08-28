import { CalendarPlus, Plus, ReceiptText, TrendingUp } from 'lucide-react'

import type { UsageMode } from '../../types/settings'
import { usesProfessionalAgenda } from '../../utils/usageMode'

export interface FloatingCreateAction {
  icon: typeof Plus
  label: string
  path: string
}

const BASE_CREATE_ACTIONS: readonly FloatingCreateAction[] = [
  { icon: TrendingUp, label: 'Nuevo ingreso', path: '/income/nuevo' },
  { icon: ReceiptText, label: 'Nuevo gasto', path: '/expenses/nuevo' },
]

const APPOINTMENT_ACTION: FloatingCreateAction = {
  icon: CalendarPlus,
  label: 'Nueva cita',
  path: '/agenda/nueva',
}

export function getFloatingCreateActions(
  usageMode: UsageMode,
): readonly FloatingCreateAction[] {
  return usesProfessionalAgenda({ usageMode })
    ? [...BASE_CREATE_ACTIONS, APPOINTMENT_ACTION]
    : BASE_CREATE_ACTIONS
}