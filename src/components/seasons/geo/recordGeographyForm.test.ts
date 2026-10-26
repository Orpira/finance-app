import { describe, expect, it } from 'vitest'

import type { TravelDestination } from '../../../types/travelDestination'
import {
  buildCreateGeographyPayload,
  buildUpdateGeographyPayload,
  createGeographyDraft,
  validateDestinationDraft,
} from './recordGeographyForm'

const toledo: TravelDestination = { kind: 'city', label: 'Toledo', city: 'Toledo', countryCode: 'ES', source: 'manual' }

describe('recordGeographyForm', () => {
  it('una creación sin estancia ni destino no envía campos geográficos', () => {
    expect(buildCreateGeographyPayload(createGeographyDraft(undefined, 'ES'))).toEqual({})
  })

  it('una creación con estancia y destino envía ambos, sin cityNormalized', () => {
    const draft = {
      ...createGeographyDraft(undefined, 'ES'),
      seasonStayId: 4,
      destinationEnabled: true,
      destination: { kind: 'city' as const, label: ' Toledo ', city: '', countryCode: 'ES' as const },
    }
    const payload = buildCreateGeographyPayload(draft)
    expect(payload.seasonStayId).toBe(4)
    expect(payload.travelDestination).toEqual({ kind: 'city', label: 'Toledo', city: 'Toledo', countryCode: 'ES', source: 'manual' })
    expect(payload.travelDestination).not.toHaveProperty('cityNormalized')
  })

  it('una edición sin cambios omite los campos (el servicio conserva lo persistido)', () => {
    const record = { seasonStayId: 4, travelDestination: toledo }
    expect(buildUpdateGeographyPayload(record, createGeographyDraft(record))).toEqual({})
  })

  it('quitar estancia o destino envía null', () => {
    const record = { seasonStayId: 4, travelDestination: toledo }
    const draft = { ...createGeographyDraft(record), seasonStayId: null, destinationEnabled: false }
    expect(buildUpdateGeographyPayload(record, draft)).toEqual({ seasonStayId: null, travelDestination: null })
  })

  it('cambiar de estancia envía el nuevo valor y conserva la instantánea salvo sincronización explícita', () => {
    const record = { seasonStayId: 4 }
    const changed = { ...createGeographyDraft(record), seasonStayId: 9 }
    expect(buildUpdateGeographyPayload(record, changed)).toEqual({ seasonStayId: 9 })
    expect(buildUpdateGeographyPayload(record, { ...changed, syncLocationFromStay: true }))
      .toEqual({ seasonStayId: 9, syncLocationFromStay: true })
  })

  it('no pide sincronizar ubicación si no hay estancia', () => {
    const draft = { ...createGeographyDraft(), syncLocationFromStay: true }
    expect(buildUpdateGeographyPayload({}, draft)).toEqual({})
  })

  it('un registro legacy sin geografía sigue sin enviar campos al editarse', () => {
    expect(buildUpdateGeographyPayload({}, createGeographyDraft({}))).toEqual({})
  })

  it('exige nombre en un destino activado', () => {
    const draft = { ...createGeographyDraft(), destinationEnabled: true }
    expect(validateDestinationDraft(draft)).toMatch(/destino puntual/)
    expect(validateDestinationDraft({ ...draft, destination: { ...draft.destination, label: 'Toledo' } })).toBeNull()
  })

  it('conserva el lugar y su ciudad al editar un destino de tipo lugar', () => {
    const place: TravelDestination = { kind: 'place', label: 'Hotel Sol', city: 'Lisboa', countryCode: 'PT', source: 'manual' }
    const draft = createGeographyDraft({ travelDestination: place })
    expect(draft.destination).toEqual({ kind: 'place', label: 'Hotel Sol', city: 'Lisboa', countryCode: 'PT' })
    expect(buildUpdateGeographyPayload({ travelDestination: place }, draft)).toEqual({})
  })
})
