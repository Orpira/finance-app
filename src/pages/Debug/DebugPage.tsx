import { useState } from 'react'

import { PageHeader } from '../../components/layout/PageHeader'
import { backfillCountries } from '../../database/migrations/backfillCountry'

export default function DebugPage() {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<{ servicesUpdated: number; expensesUpdated: number } | null>(null)

  async function handleRun() {
    setRunning(true)
    try {
      const res = await backfillCountries()
      setResult(res)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err)
      setResult({ servicesUpdated: 0, expensesUpdated: 0 })
    } finally {
      setRunning(false)
    }
  }

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-4">
      <PageHeader
        backLabel="Inicio"
        backTo="/"
        eyebrow="Herramientas de mantenimiento"
        title="Debug / Migraciones"
      />

      <div className="flex gap-3">
        <button
          className="inline-flex items-center rounded-md bg-emerald-600 px-4 py-2 text-white"
          disabled={running}
          onClick={handleRun}
        >
          {running ? 'Ejecutando...' : 'Rellenar country en registros'}
        </button>
      </div>

      {result && (
        <div className="mt-4 rounded-md border border-slate-200 bg-white p-3">
          <p>Servicios actualizados: {result.servicesUpdated}</p>
          <p>Gastos actualizados: {result.expensesUpdated}</p>
        </div>
      )}
    </section>
  )
}
