import { beforeEach, describe, expect, it, vi } from 'vitest'

const { sqlMock } = vi.hoisted(() => ({
  sqlMock: vi.fn(),
}))

vi.mock('@neondatabase/serverless', () => ({
  neon: () => sqlMock,
}))

import {
  CanonicalIdentityError,
  resolveCanonicalUserCode,
} from '../server/canonicalIdentity'

const DEVICE_CODE = 'PB-DEVICE-22222222-2222-4222-8222-222222222222'
const USER_CODE = 'PB-USER-11111111-1111-4111-8111-111111111111'
const OTHER_USER_CODE = 'PB-USER-99999999-9999-4999-8999-999999999999'
const DUMMY_DB_URL = 'postgresql://user:pass@localhost/db'

beforeEach(() => {
  process.env.DATABASE_URL = DUMMY_DB_URL
  sqlMock.mockReset()
})

describe('resolveCanonicalUserCode', () => {
  it('resuelve el único user_code activo del dispositivo', async () => {
    sqlMock.mockResolvedValue([{ user_code: USER_CODE }])

    await expect(resolveCanonicalUserCode(DEVICE_CODE)).resolves.toBe(USER_CODE)
  })

  it('acepta varias licencias solo cuando resuelven al mismo usuario', async () => {
    sqlMock.mockResolvedValue([
      { user_code: USER_CODE },
      { user_code: USER_CODE },
    ])

    await expect(resolveCanonicalUserCode(DEVICE_CODE)).resolves.toBe(USER_CODE)
  })

  it('falla cerrado cuando no hay filas activas', async () => {
    sqlMock.mockResolvedValue([])

    await expect(resolveCanonicalUserCode(DEVICE_CODE)).rejects.toBeInstanceOf(CanonicalIdentityError)
  })

  it('falla cerrado ante ambigüedad de usuarios para el mismo dispositivo', async () => {
    sqlMock.mockResolvedValue([
      { user_code: USER_CODE },
      { user_code: OTHER_USER_CODE },
    ])

    await expect(resolveCanonicalUserCode(DEVICE_CODE)).rejects.toBeInstanceOf(CanonicalIdentityError)
  })

  it('falla cerrado si DATABASE_URL no está configurada', async () => {
    const previous = process.env.DATABASE_URL
    delete process.env.DATABASE_URL

    try {
      await expect(resolveCanonicalUserCode(DEVICE_CODE)).rejects.toBeInstanceOf(CanonicalIdentityError)
    } finally {
      process.env.DATABASE_URL = previous
    }
    expect(sqlMock).not.toHaveBeenCalled()
  })

  it('falla cerrado ante error de base de datos en lugar de devolver null', async () => {
    sqlMock.mockRejectedValue(new Error('connection refused'))

    await expect(resolveCanonicalUserCode(DEVICE_CODE)).rejects.toBeInstanceOf(CanonicalIdentityError)
  })

  it('la consulta exige dispositivo activo, licencia activa, vigente y user_code presente', async () => {
    let queryText = ''
    sqlMock.mockImplementation((template: TemplateStringsArray) => {
      queryText = template.join(' ')
      return Promise.resolve([{ user_code: USER_CODE }])
    })

    await resolveCanonicalUserCode(DEVICE_CODE)

    expect(queryText).toContain('INNER JOIN licenses')
    expect(queryText).toContain("ld.status = 'active'")
    expect(queryText).toContain("l.status = 'active'")
    expect(queryText).toContain('ld.user_code IS NOT NULL')
    expect(queryText).toContain('BTRIM(ld.user_code)')
    expect(queryText).toContain('l.expires_at IS NULL OR l.expires_at > NOW()')
    expect(queryText).toContain('DISTINCT')
  })
})
