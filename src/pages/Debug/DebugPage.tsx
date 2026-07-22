import { useState } from 'react'
import { Link } from 'react-router-dom'

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
    } catch {
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
        title="Debug"
      />

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">AI Execution Inspector</h2>
        <p className="mt-2 text-sm text-slate-600">
          Observa una ejecución completa del pipeline de IA mediante snapshots de solo lectura.
        </p>
        <Link
          className="mt-4 inline-flex min-h-10 items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          to="/debug/ai-execution-inspector"
        >
          Abrir inspector
        </Link>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Migraciones</h2>
        <p className="mt-2 text-sm text-slate-600">
          Herramientas de mantenimiento manual para datos locales.
        </p>

        <div className="mt-4 flex gap-3">
          <button
            className="inline-flex items-center rounded-md bg-emerald-600 px-4 py-2 text-white"
            disabled={running}
            onClick={handleRun}
          >
            {running ? 'Ejecutando...' : 'Rellenar country en registros'}
          </button>
        </div>

        {result && (
          <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
            <p>Servicios actualizados: {result.servicesUpdated}</p>
            <p>Gastos actualizados: {result.expensesUpdated}</p>
          </div>
        )}
      </div>
    </section>
  )
}
