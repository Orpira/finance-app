// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import type { CopilotNotification } from '../../notifications/types'

const service = {
  listNotifications: vi.fn(),
  markSeen: vi.fn(async () => {}),
  markRead: vi.fn(async () => {}),
  dismiss: vi.fn(async () => {}),
  markActed: vi.fn(async () => {}),
}
const notifyNotificationsChanged = vi.fn()

vi.mock('../../notifications/notificationService', () => ({
  getNotificationService: () => service,
  notifyNotificationsChanged: () => notifyNotificationsChanged(),
}))

const { NotificationCenterPage } = await import('./NotificationCenterPage')

function notification(overrides: Partial<CopilotNotification> = {}): CopilotNotification {
  return {
    id: 'n1',
    type: 'SEASON_GOAL_ACHIEVED',
    priority: 'P2',
    source: 'goal',
    title: 'Meta de temporada alcanzada',
    message: 'Has alcanzado la Meta de temporada de Verano.',
    dedupKey: 'season-goal-achieved:1',
    createdAt: '2026-08-30T10:00:00.000Z',
    status: 'new',
    privacy: 'generic',
    ...overrides,
  }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('NotificationCenterPage', () => {
  it('muestra el estado vacío cuando no hay notificaciones', async () => {
    service.listNotifications.mockResolvedValue([])

    render(
      <MemoryRouter>
        <NotificationCenterPage />
      </MemoryRouter>,
    )

    await screen.findByText('No tienes notificaciones por ahora.')
  })

  it('marca como vista una notificación nueva al entrar a la página', async () => {
    service.listNotifications.mockResolvedValue([notification({ status: 'new' })])

    render(
      <MemoryRouter>
        <NotificationCenterPage />
      </MemoryRouter>,
    )

    await screen.findByText('Meta de temporada alcanzada')
    await waitFor(() => expect(service.markSeen).toHaveBeenCalledWith('n1'))
    expect(notifyNotificationsChanged).toHaveBeenCalled()
  })

  it('descartar llama a dismiss y refresca la lista', async () => {
    service.listNotifications
      .mockResolvedValueOnce([notification({ status: 'read' })])
      .mockResolvedValueOnce([notification({ status: 'read' })])
      .mockResolvedValueOnce([notification({ status: 'dismissed' })])

    render(
      <MemoryRouter>
        <NotificationCenterPage />
      </MemoryRouter>,
    )

    await screen.findByText('Meta de temporada alcanzada')
    fireEvent.click(screen.getByLabelText('Descartar notificación'))

    await waitFor(() => expect(service.dismiss).toHaveBeenCalledWith('n1'))
    await screen.findByText('No tienes notificaciones por ahora.')
  })

  it('marcar como leída llama a markRead', async () => {
    service.listNotifications.mockResolvedValue([notification({ status: 'seen' })])

    render(
      <MemoryRouter>
        <NotificationCenterPage />
      </MemoryRouter>,
    )

    fireEvent.click(await screen.findByText('Marcar como leída'))

    await waitFor(() => expect(service.markRead).toHaveBeenCalledWith('n1'))
  })

  it('ejecutar la acción llama a markActed y navega al destino', async () => {
    service.listNotifications.mockResolvedValue([
      notification({
        status: 'seen',
        action: { label: 'Ver temporada', destination: '/temporadas/1' },
      }),
    ])

    render(
      <MemoryRouter>
        <NotificationCenterPage />
      </MemoryRouter>,
    )

    fireEvent.click(await screen.findByText('Ver temporada'))

    await waitFor(() => expect(service.markActed).toHaveBeenCalledWith('n1'))
    expect(notifyNotificationsChanged).toHaveBeenCalled()
  })
})
