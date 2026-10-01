// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const configureOnboardingUsageMode = vi.fn()

vi.mock('../src/services/onboardingService', () => ({
  configureOnboardingUsageMode,
}))

const { UsageStep } = await import('../src/components/onboarding/steps/UsageStep')

afterEach(cleanup)

describe('UsageStep', () => {
  beforeEach(() => {
    configureOnboardingUsageMode.mockReset()
    configureOnboardingUsageMode.mockResolvedValue(undefined)
  })

  it('muestra solo los dos espacios y mantiene Continuar deshabilitado al inicio', () => {
    render(<UsageStep stepNumber={2} totalSteps={5} onNext={() => undefined} />)

    expect(screen.getByRole('heading', { name: '¿Qué quieres gestionar primero?' })).toBeTruthy()
    expect(screen.getByText('Elige el espacio con el que quieres comenzar.')).toBeTruthy()
    expect(screen.getByText('Podrás activar el otro espacio más adelante sin perder tus datos.')).toBeTruthy()
    expect(screen.getAllByRole('radio')).toHaveLength(2)
    expect(screen.queryByText('Profesional + Personal')).toBeNull()
    expect((screen.getByRole('button', { name: 'Continuar' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('selecciona la tarjeta completa, anuncia el estado y espera a Continuar', async () => {
    const onNext = vi.fn()
    render(<UsageStep stepNumber={2} totalSteps={5} onNext={onNext} />)

    const personal = screen.getByRole('radio', { name: /Mis finanzas personales/ })
    fireEvent.click(personal)

    expect(personal.getAttribute('aria-checked')).toBe('true')
    expect(personal.getAttribute('aria-selected')).toBe('true')
    expect(configureOnboardingUsageMode).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    await waitFor(() => expect(configureOnboardingUsageMode).toHaveBeenCalledWith('basic'))
    expect(onNext).toHaveBeenCalledWith(4)
  })

  it('permite elegir Profesional sin ofrecer Híbrido', async () => {
    const onNext = vi.fn()
    render(<UsageStep stepNumber={2} totalSteps={7} onNext={onNext} />)

    fireEvent.click(screen.getByRole('radio', { name: /Mi actividad profesional/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))

    await waitFor(() => expect(configureOnboardingUsageMode).toHaveBeenCalledWith('professional'))
    expect(onNext).toHaveBeenCalledWith(2)
  })
})
