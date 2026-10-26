import { useCallback, useRef, useState, type ReactNode } from 'react'

import {
  completeAppointmentAsIncome,
  type CompleteAppointmentOptions,
} from '../../../services/appointmentCompletionService'
import { getAppointmentById } from '../../../services/appointmentService'
import { getSeasonStayById, switchActiveSeasonStay } from '../../../services/seasonStayService'
import type { SeasonStay } from '../../../types/seasonStay'
import type { AppSettings } from '../../../types/settings'
import { useDialog } from '../../dialogs/useDialog'
import { RETRYABLE_COMPLETION_CODES, describeSeasonGeoError, getErrorCode } from './seasonGeoMessages'
import { currentTimeZone } from './stayPresentation'
import { StayNotStartedDialog, type StayChoice } from './StayNotStartedDialog'

export type AppointmentCompletionOutcome = 'completed' | 'already_completed' | 'cancelled' | 'failed'

const MAX_ATTEMPTS = 4

/**
 * Único flujo de UI para "Servicio realizado" (PB-GEO-002 Etapa 3).
 *
 * - Solo llama a completeAppointmentAsIncome; nunca a las rutas antiguas de
 *   reclamación o creación de ingreso.
 * - `already_completed` es un éxito idempotente.
 * - STAY_NOT_STARTED ofrece activar la estancia y reintentar, o finalizar
 *   sin estancia con motivo obligatorio (plannedStayResolution: detach).
 * - APPOINTMENT_PRECONDITION_CHANGED no persistió nada: se ofrece reintentar,
 *   y el reintento vuelve a leer datos frescos.
 * - La cita no se marca como completada en pantalla hasta que el servicio
 *   confirma; el llamador recarga después de un resultado de éxito.
 */
export function useAppointmentCompletion() {
  const { alert, confirm, prompt } = useDialog()
  const [stayDialog, setStayDialog] = useState<{ stay: SeasonStay } | null>(null)
  const stayChoiceResolver = useRef<((choice: StayChoice) => void) | null>(null)

  const askStayChoice = useCallback((stay: SeasonStay) => new Promise<StayChoice>((resolve) => {
    stayChoiceResolver.current = resolve
    setStayDialog({ stay })
  }), [])

  const resolveStayChoice = useCallback((choice: StayChoice) => {
    stayChoiceResolver.current?.(choice)
    stayChoiceResolver.current = null
    setStayDialog(null)
  }, [])

  const complete = useCallback(async (
    appointmentId: number,
    settings: AppSettings,
  ): Promise<AppointmentCompletionOutcome> => {
    let options: CompleteAppointmentOptions = {}

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      try {
        const result = await completeAppointmentAsIncome(appointmentId, settings, new Date(), options)
        if (result.status === 'completed' && result.postCommitWarnings.includes('REMINDER_CANCELLATION_FAILED')) {
          await alert({
            type: 'warning',
            title: 'Servicio registrado',
            message: 'El ingreso se guardó correctamente, pero no se pudieron cancelar los recordatorios de la cita. Revísalos en la configuración de notificaciones.',
          })
        }
        return result.status
      } catch (error) {
        const code = getErrorCode(error)

        if (code === 'STAY_NOT_STARTED') {
          const appointment = await getAppointmentById(appointmentId)
          const stay = appointment?.seasonStayId ? await getSeasonStayById(appointment.seasonStayId) : undefined
          if (!stay) {
            await alert({ type: 'error', title: 'No se pudo finalizar la cita', message: describeSeasonGeoError(error) })
            return 'failed'
          }
          const choice = await askStayChoice(stay)
          if (choice === 'cancel') return 'cancelled'
          if (choice === 'activate') {
            try {
              await switchActiveSeasonStay({
                earningPeriodId: stay.earningPeriodId,
                next: { kind: 'existing', seasonStayId: stay.id! },
                effectiveAt: new Date().toISOString(),
                timeZone: currentTimeZone(),
              })
            } catch (activationError) {
              await alert({
                type: 'error',
                title: 'No se pudo activar la estancia',
                message: `${describeSeasonGeoError(activationError)} La cita sigue pendiente.`,
              })
              return 'failed'
            }
            options = {}
            continue
          }
          const reason = await prompt({
            title: 'Finalizar sin estancia',
            message: `La cita se desvinculará de la estancia prevista en ${stay.city}. Conservará su ciudad, país y destino. Indica el motivo.`,
            placeholder: 'Motivo de la desvinculación',
            confirmLabel: 'Finalizar sin estancia',
            validate: (value) => value.trim() ? undefined : 'El motivo es obligatorio.',
          })
          if (reason === null) return 'cancelled'
          options = { plannedStayResolution: { action: 'detach', reason: reason.trim() } }
          continue
        }

        if (code && RETRYABLE_COMPLETION_CODES.has(code)) {
          const retry = await confirm({
            title: 'Los datos cambiaron',
            message: describeSeasonGeoError(error),
            confirmLabel: 'Reintentar',
          })
          if (!retry) return 'cancelled'
          continue
        }

        await alert({
          type: 'error',
          title: 'No se pudo finalizar la cita',
          message: describeSeasonGeoError(error),
        })
        return 'failed'
      }
    }

    await alert({
      type: 'error',
      title: 'No se pudo finalizar la cita',
      message: 'Se agotaron los reintentos. La cita sigue pendiente; vuelve a intentarlo en unos segundos.',
    })
    return 'failed'
  }, [alert, askStayChoice, confirm, prompt])

  const dialog: ReactNode = stayDialog ? (
    <StayNotStartedDialog onChoose={resolveStayChoice} stay={stayDialog.stay} />
  ) : null

  return { complete, dialog }
}
