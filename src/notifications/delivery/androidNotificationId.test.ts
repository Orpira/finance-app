import { describe, expect, it } from 'vitest'

import { toAndroidNotificationId } from './androidNotificationId'

describe('toAndroidNotificationId', () => {
  it('es determinista para el mismo id', () => {
    const id = 'notif-1730000000000-abc123'
    expect(toAndroidNotificationId(id)).toBe(toAndroidNotificationId(id))
  })

  it('produce ids distintos para ids distintos (sin colisión en una muestra razonable)', () => {
    const ids = Array.from({ length: 200 }, (_, index) => `notif-${index}-${index * 7}`)
    const nativeIds = new Set(ids.map(toAndroidNotificationId))
    expect(nativeIds.size).toBe(ids.length)
  })

  it('siempre devuelve un entero positivo', () => {
    const nativeId = toAndroidNotificationId('cualquier-id')
    expect(Number.isInteger(nativeId)).toBe(true)
    expect(nativeId).toBeGreaterThan(0)
  })
})
