import { Save } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { PageHeader } from '../../components/layout/PageHeader'
import { closeActiveEarningPeriodAndCreate, createEarningPeriod, getActiveEarningPeriod, getEarningPeriodById, type CreateSeasonInput } from '../../services/earningPeriodService'
import { listCityOptions } from '../../services/locationService'
import { describeSeasonGeoError } from '../../components/seasons/geo/seasonGeoMessages'
import { currentTimeZone } from '../../components/seasons/geo/stayPresentation'
import { getSettings } from '../../services/settingsService'
import type { CountryCode, CurrencyCode } from '../../types/settings'
import { countries, fallbackCityOptions, getCountryCurrency, type CityOption } from '../../utils/countries'
import { getTodayInputDate } from '../../utils/currency'
import { useDialog } from '../../components/dialogs/useDialog'

function defaultPlannedEndDate() {
  const date = new Date()
  date.setMonth(date.getMonth() + 3)
  return date.toLocaleDateString('en-CA')
}

export function SeasonFormPage() {
  const { confirm } = useDialog()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const basedOn = Number(params.get('basedOn')) || undefined
  const [cities, setCities] = useState<CityOption[]>(fallbackCityOptions)
  const [name, setName] = useState(`Temporada ${new Date().toLocaleDateString('es-ES')}`)
  const [city, setCity] = useState('')
  const [country, setCountry] = useState<CountryCode>('ES')
  const [currency, setCurrency] = useState<CurrencyCode>('EUR')
  const [percentage, setPercentage] = useState(50)
  const [startDate, setStartDate] = useState(getTodayInputDate())
  const [plannedEndDate, setPlannedEndDate] = useState(defaultPlannedEndDate)
  const [economicGoal, setEconomicGoal] = useState('')
  const [notes, setNotes] = useState('')
  const [firstStayStart, setFirstStayStart] = useState('')
  const [firstStayEnd, setFirstStayEnd] = useState('')
  const [startStayNow, setStartStayNow] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([getSettings(), listCityOptions(), basedOn ? getEarningPeriodById(basedOn) : undefined]).then(([settings, options, base]) => {
      setCities(options)
      // La primera ciudad es opcional: no se precarga desde settings.city.
      setCountry((base?.countryCode ?? settings.country) as CountryCode)
      setCurrency(base?.baseCurrency ?? getCountryCurrency((base?.countryCode ?? settings.country) as CountryCode) ?? settings.defaultCurrency)
      setPercentage(base?.percentage ?? settings.incomePercentage)
      if (base) {
        setName(`Nueva ${base.name}`)
        setPlannedEndDate(base.plannedEndDate?.slice(0, 10) ?? defaultPlannedEndDate())
        setEconomicGoal(base.economicGoal ? String(base.economicGoal) : '')
      }
    })
  }, [basedOn])

  const canStartNow = startDate <= getTodayInputDate()

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const active = await getActiveEarningPeriod()
      if (active) {
        const confirmed = await confirm({
          title: 'Cerrar temporada activa',
          message: 'Ya existe una temporada activa.\n\nPara crear una nueva temporada debes cerrar la temporada actual.\n¿Deseas cerrarla ahora y crear una nueva?',
          confirmLabel: 'Cerrar y continuar',
          confirmTone: 'warning',
        })
        if (!confirmed) { setSaving(false); return }
      }
      const firstCity = city.trim()
      const startsNow = Boolean(firstCity && canStartNow && startStayNow)
      const input: CreateSeasonInput = {
        name,
        country,
        countryCode: country,
        baseCurrency: currency,
        earningPercentage: percentage,
        startDate,
        plannedEndDate,
        economicGoal: Number(economicGoal),
        notes,
        firstStay: firstCity
          ? {
              city: firstCity,
              plannedStartDate: firstStayStart || undefined,
              plannedEndDate: firstStayEnd || undefined,
              actualStartAt: startsNow ? new Date().toISOString() : undefined,
              timeZone: startsNow ? currentTimeZone() : undefined,
            }
          : undefined,
      }
      const period = active
        ? await closeActiveEarningPeriodAndCreate(input)
        : await createEarningPeriod(input)
      navigate(`/temporadas/${period.id}`, { replace: true })
    } catch (reason) {
      setError(describeSeasonGeoError(reason, 'No se pudo crear la temporada.'))
      setSaving(false)
    }
  }

  return <section className="mx-auto flex w-full max-w-2xl flex-col gap-6">
    <PageHeader backLabel="Temporadas" backTo="/temporadas" eyebrow="Temporadas" title="Nueva temporada" />
    <form className="grid gap-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900" onSubmit={submit}>
      <label className="grid gap-2"><span className="text-sm font-medium">Nombre</span><input className="h-11 rounded-md border border-slate-300 px-3" onChange={(e) => setName(e.target.value)} required value={name} /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2"><span className="text-sm font-medium">País</span><select className="h-11 rounded-md border border-slate-300 px-3" onChange={(e) => { const code = e.target.value as CountryCode; setCountry(code); setCurrency(getCountryCurrency(code) ?? currency) }} value={country}>{countries.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label className="grid gap-2"><span className="text-sm font-medium">Moneda base</span><input className="h-11 rounded-md border border-slate-300 bg-slate-50 px-3" readOnly value={currency} /></label>
        <label className="grid gap-2"><span className="text-sm font-medium">Porcentaje de ganancia</span><input className="h-11 rounded-md border border-slate-300 px-3" max={100} min={0} onChange={(e) => setPercentage(Number(e.target.value))} required type="number" value={percentage} /></label>
        <label className="grid gap-2"><span className="text-sm font-medium">Inicio de temporada</span><input className="h-11 rounded-md border border-slate-300 px-3" onChange={(e) => setStartDate(e.target.value)} required type="date" value={startDate} /></label>
        <label className="grid gap-2"><span className="text-sm font-medium">Finalización prevista</span><input className="h-11 rounded-md border border-slate-300 px-3" min={startDate} onChange={(e) => setPlannedEndDate(e.target.value)} required type="date" value={plannedEndDate} /></label>
        <label className="grid gap-2"><span className="text-sm font-medium">Meta económica</span><input className="h-11 rounded-md border border-slate-300 px-3" min="0.01" onChange={(e) => setEconomicGoal(e.target.value)} required step="0.01" type="number" value={economicGoal} /></label>
      </div>
      <p className="text-sm text-slate-500">La fecha prevista no cierra la temporada automáticamente. País y moneda no cambian durante la temporada; otro país requiere una temporada nueva.</p>
      <fieldset className="grid gap-4 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
        <legend className="px-1 text-sm font-semibold">Primera ciudad (opcional)</legend>
        <p className="text-sm text-slate-500">Si aún no la conoces, déjala vacía y añádela después desde el itinerario.</p>
        <label className="grid gap-2"><span className="text-sm font-medium">Ciudad</span><input className="h-11 rounded-md border border-slate-300 px-3" list="season-cities" onChange={(e) => setCity(e.target.value)} value={city} /><datalist id="season-cities">{cities.filter((item) => item.country === country).map((item) => <option key={`${item.country}:${item.value}`} value={item.value} />)}</datalist></label>
        {city.trim() && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2"><span className="text-sm font-medium">Llegada prevista (opcional)</span><input className="h-11 rounded-md border border-slate-300 px-3" min={startDate} onChange={(e) => setFirstStayStart(e.target.value)} type="date" value={firstStayStart} /></label>
              <label className="grid gap-2"><span className="text-sm font-medium">Salida prevista (opcional)</span><input className="h-11 rounded-md border border-slate-300 px-3" max={plannedEndDate || undefined} min={firstStayStart || startDate} onChange={(e) => setFirstStayEnd(e.target.value)} type="date" value={firstStayEnd} /></label>
            </div>
            {canStartNow && (
              <label className="flex items-start gap-2 text-sm"><input checked={startStayNow} className="mt-1 size-4" onChange={(e) => setStartStayNow(e.target.checked)} type="checkbox" /><span>Ya estoy en esta ciudad: empezar la estancia ahora.</span></label>
            )}
          </>
        )}
      </fieldset>
      <label className="grid gap-2"><span className="text-sm font-medium">Observaciones</span><textarea className="min-h-24 rounded-md border border-slate-300 p-3" onChange={(e) => setNotes(e.target.value)} value={notes} /></label>
      {error && <p className="rounded-md bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}
      <button className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={saving} type="submit"><Save className="size-4" /> {saving ? 'Creando...' : 'Crear temporada'}</button>
    </form>
  </section>
}

export default SeasonFormPage
