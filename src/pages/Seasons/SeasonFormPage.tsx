import { Save } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { PageHeader } from '../../components/layout/PageHeader'
import { closeActiveEarningPeriod, createEarningPeriod, getActiveEarningPeriod, getEarningPeriodById } from '../../services/earningPeriodService'
import { listCityOptions } from '../../services/locationService'
import { getSettings } from '../../services/settingsService'
import type { CountryCode, CurrencyCode } from '../../types/settings'
import { countries, fallbackCityOptions, getCityOption, getCountryCurrency, type CityOption } from '../../utils/countries'
import { getTodayInputDate } from '../../utils/currency'

export function SeasonFormPage() {
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
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([getSettings(), listCityOptions(), basedOn ? getEarningPeriodById(basedOn) : undefined]).then(([settings, options, base]) => {
      setCities(options)
      setCity(base?.city ?? settings.city)
      setCountry((base?.countryCode ?? settings.country) as CountryCode)
      setCurrency(base?.baseCurrency ?? getCountryCurrency((base?.countryCode ?? settings.country) as CountryCode) ?? settings.defaultCurrency)
      setPercentage(base?.percentage ?? settings.incomePercentage)
      if (base) setName(`Nueva ${base.name}`)
    })
  }, [basedOn])

  function changeCity(value: string) {
    setCity(value)
    const option = getCityOption(value, cities)
    if (option) {
      setCountry(option.country)
      setCurrency(getCountryCurrency(option.country) ?? currency)
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const active = await getActiveEarningPeriod()
      if (active) {
        const confirmed = window.confirm('Ya existe una temporada activa.\n\nPara crear una nueva temporada debes cerrar la temporada actual.\n¿Deseas cerrarla ahora y crear una nueva?')
        if (!confirmed) { setSaving(false); return }
        await closeActiveEarningPeriod()
      }
      const period = await createEarningPeriod({ name, city, country, countryCode: country, baseCurrency: currency, earningPercentage: percentage, startDate, notes })
      navigate(`/temporadas/${period.id}`, { replace: true })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo crear la temporada.')
      setSaving(false)
    }
  }

  return <section className="mx-auto flex w-full max-w-2xl flex-col gap-6">
    <PageHeader backLabel="Temporadas" backTo="/temporadas" eyebrow="Temporadas" title="Nueva temporada" />
    <form className="grid gap-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900" onSubmit={submit}>
      <label className="grid gap-2"><span className="text-sm font-medium">Nombre</span><input className="h-11 rounded-md border border-slate-300 px-3" onChange={(e) => setName(e.target.value)} required value={name} /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2"><span className="text-sm font-medium">Ciudad</span><input className="h-11 rounded-md border border-slate-300 px-3" list="season-cities" onChange={(e) => changeCity(e.target.value)} required value={city} /><datalist id="season-cities">{cities.map((item) => <option key={`${item.country}:${item.value}`} value={item.value} />)}</datalist></label>
        <label className="grid gap-2"><span className="text-sm font-medium">País</span><select className="h-11 rounded-md border border-slate-300 px-3" onChange={(e) => { const code = e.target.value as CountryCode; setCountry(code); setCurrency(getCountryCurrency(code) ?? currency) }} value={country}>{countries.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label className="grid gap-2"><span className="text-sm font-medium">Moneda base</span><input className="h-11 rounded-md border border-slate-300 bg-slate-50 px-3" readOnly value={currency} /></label>
        <label className="grid gap-2"><span className="text-sm font-medium">Porcentaje de ganancia</span><input className="h-11 rounded-md border border-slate-300 px-3" max={100} min={0} onChange={(e) => setPercentage(Number(e.target.value))} required type="number" value={percentage} /></label>
        <label className="grid gap-2"><span className="text-sm font-medium">Fecha de inicio</span><input className="h-11 rounded-md border border-slate-300 px-3" onChange={(e) => setStartDate(e.target.value)} required type="date" value={startDate} /></label>
      </div>
      <label className="grid gap-2"><span className="text-sm font-medium">Observaciones</span><textarea className="min-h-24 rounded-md border border-slate-300 p-3" onChange={(e) => setNotes(e.target.value)} value={notes} /></label>
      {error && <p className="rounded-md bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}
      <button className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={saving} type="submit"><Save className="size-4" /> {saving ? 'Creando...' : 'Crear temporada'}</button>
    </form>
  </section>
}

export default SeasonFormPage
