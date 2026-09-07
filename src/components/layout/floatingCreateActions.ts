import { ArrowLeftRight, CalendarPlus, Plus, ReceiptText, TrendingUp } from 'lucide-react'

import type { UsageMode } from '../../types/settings'
import { isBasicMode, usesProfessionalAgenda } from '../../utils/usageMode'

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

const TRANSFER_ACTION: FloatingCreateAction = {
  icon: ArrowLeftRight,
  label: 'Transferir dinero',
  path: '/transfers/nuevo',
}

export function getFloatingCreateActions(
  usageMode: UsageMode,
): readonly FloatingCreateAction[] {
  if (usesProfessionalAgenda({ usageMode })) {
    return [...BASE_CREATE_ACTIONS, APPOINTMENT_ACTION]
  }
  // Transferir dinero entre Wallets es exclusivo de Personal (spec §15/§16).
  return isBasicMode({ usageMode })
    ? [...BASE_CREATE_ACTIONS, TRANSFER_ACTION]
    : BASE_CREATE_ACTIONS
}