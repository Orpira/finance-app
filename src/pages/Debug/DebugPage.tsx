import { useState } from 'react'
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
    <section className="mx-auto max-w-3xl">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold">Debug / Migraciones</h1>
        <p className="text-sm text-slate-500">Herramientas de mantenimiento</p>
      </header>

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
