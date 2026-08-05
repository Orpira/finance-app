import { readFileSync } from 'node:fs'

import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { ActionableEmptyState } from '../src/components/ActionableEmptyState'
import { getFinancialListEmptyReason } from '../src/utils/financialListEmptyState'
import { InsightEmptyView } from '../src/pages/Insights/InsightStateViews'
import { PendingIncomeEmptyState } from '../src/pages/Income/IncomePendingReportPage'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

describe('Sprint A final - estados vacíos accionables (SA-012)', () => {
  it('prioriza temporada, primer registro y filtros en ese orden', () => {
    expect(getFinancialListEmptyReason({
      hasActiveSeason: false,
      requiresActiveSeason: true,
      totalRecords: 0,
    })).toBe('no-active-season')
    expect(getFinancialListEmptyReason({
      hasActiveSeason: true,
      requiresActiveSeason: true,
      totalRecords: 0,
    })).toBe('no-records')
    expect(getFinancialListEmptyReason({
      hasActiveSeason: true,
      requiresActiveSeason: true,
      totalRecords: 3,
    })).toBe('no-filter-results')
  })

  it('explica cómo comenzar y enlaza a una acción existente', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <ActionableEmptyState
          action={{ label: 'Registrar ingreso', to: '/income/nuevo' }}
          description="Añade tu primer ingreso para comenzar a construir el historial financiero."
          title="Aún no hay ingresos"
        />
      </MemoryRouter>,
    )

    expect(markup).toContain('Aún no hay ingresos')
    expect(markup).toContain('Añade tu primer ingreso')
    expect(markup).toContain('href="/income/nuevo"')
    expect(markup).toContain('Registrar ingreso')
  })

  it('permite limpiar filtros cuando existen datos sin coincidencias', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <ActionableEmptyState
          action={{ label: 'Limpiar filtros', onClick: () => undefined }}
          description="Prueba con otros criterios para volver a ver tus registros."
          title="Ningún movimiento coincide con los filtros"
        />
      </MemoryRouter>,
    )

    expect(markup).toContain('Ningún movimiento coincide con los filtros')
    expect(markup).toContain('Prueba con otros criterios')
    expect(markup).toContain('<button')
    expect(markup).toContain('Limpiar filtros')
  })

  it('guía el estado vacío de Análisis hacia la creación de datos', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <InsightEmptyView />
      </MemoryRouter>,
    )

    expect(markup).toContain('Aún no hay suficientes datos financieros')
    expect(markup).toContain('href="/income/nuevo"')
    expect(markup).toContain('Registrar ingreso')
    expect(markup).not.toContain('Reintentar')
  })

  it('permite actualizar Análisis cuando hay datos pero ninguna recomendación', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <InsightEmptyView hasData onReload={() => undefined} />
      </MemoryRouter>,
    )

    expect(markup).toContain('No hay recomendaciones por ahora')
    expect(markup).toContain('Tus datos financieros están disponibles')
    expect(markup).toContain('<button')
    expect(markup).toContain('Actualizar análisis')
    expect(markup).not.toContain('href="/income/nuevo"')
  })

  it('lleva al historial cuando no quedan ingresos pendientes de reportar', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <PendingIncomeEmptyState />
      </MemoryRouter>,
    )

    expect(markup).toContain('Todo está al día')
    expect(markup).toContain('No hay ingresos pendientes de reportar')
    expect(markup).toContain('href="/income"')
    expect(markup).toContain('Ver todos los ingresos')
    expect(markup).not.toContain('reportStatus=unreviewed')
  })

  it('mantiene acciones concretas en todas las pantallas mínimas auditadas', () => {
    const home = read('../src/pages/Home/HomePage.tsx')
    const movements = read('../src/pages/Movements/MovementsPage.tsx')
    const incomes = read('../src/pages/Income/IncomeListPage.tsx')
    const expenses = read('../src/pages/Expenses/ExpenseListPage.tsx')
    const agenda = read('../src/pages/Agenda/AgendaPage.tsx')
    const reports = read('../src/pages/Reports/ReportsPage.tsx')
    const reportPreview = read('../src/pages/Reports/ReportPreviewPage.tsx')
    const conversation = read('../src/pages/Conversation/ConversationPage.tsx')
    const messageList = read('../src/pages/Conversation/MessageList.tsx')
    const composer = read('../src/pages/Conversation/MessageComposer.tsx')
    const more = read('../src/pages/More/MorePage.tsx')

    expect(home).toContain('Acciones sugeridas')
    expect(home).toContain('Usa Registrar ingreso o Registrar gasto')
    expect(movements).toContain('Limpiar filtros')
    expect(incomes).toContain('Registrar ingreso')
    expect(expenses).toContain('Registrar egreso')
    expect(agenda).toContain('No hay citas para esta fecha')
    expect(agenda).toContain('Crear cita')
    expect(reports).toContain('Elige el contenido y revisa la vista previa')
    expect(reports).toContain('Confirmar y generar')
    expect(reportPreview).toContain('Volver a reportes')
    expect(messageList).toContain('Escribe tu primer mensaje')
    expect(conversation).toContain('<MessageComposer')
    expect(composer).toContain('Sugerencias rápidas')
    expect(more).toContain('Otras opciones')
    expect(more).toContain('Copia de seguridad')
  })
})