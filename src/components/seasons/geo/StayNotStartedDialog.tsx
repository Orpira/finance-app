import { MapPin, PlayCircle, Unlink } from 'lucide-react'
import { useRef } from 'react'

import type { SeasonStay } from '../../../types/seasonStay'
import { DialogFrame } from '../../dialogs/DialogFrame'
import { formatStayPeriod } from './stayPresentation'

export type StayChoice = 'activate' | 'detach' | 'cancel'

export function StayNotStartedDialog({ stay, onChoose }: { stay: SeasonStay; onChoose: (choice: StayChoice) => void }) {
  const activateRef = useRef<HTMLButtonElement>(null)
  const buttonClassName = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2'
  return (
    <DialogFrame
      actions={(
        <>
          <button className={`${buttonClassName} border border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200`} onClick={() => onChoose('cancel')} type="button">
            Ahora no
          </button>
          <button className={`${buttonClassName} border border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100`} onClick={() => onChoose('detach')} type="button">
            <Unlink aria-hidden="true" className="size-4" /> Finalizar sin estancia
          </button>
          <button className={`${buttonClassName} bg-emerald-700 text-white hover:bg-emerald-800 focus:ring-emerald-500`} onClick={() => onChoose('activate')} ref={activateRef} type="button">
            <PlayCircle aria-hidden="true" className="size-4" /> Activar y finalizar
          </button>
        </>
      )}
      icon={<MapPin className="size-6" aria-hidden="true" />}
      iconClassName="bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
      initialFocusRef={activateRef}
      message={`La cita está vinculada a ${stay.city} (${formatStayPeriod(stay)}), que todavía no ha comenzado.\n\n«Activar y finalizar» empieza esa estancia ahora (la estancia actual, si hay una, termina en este momento) y registra el servicio.\n«Finalizar sin estancia» registra el servicio sin asociarlo a ninguna estancia.`}
      onCancel={() => onChoose('cancel')}
      open
      title="La estancia aún no ha comenzado"
    />
  )
}
