// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { IncomeAdditionalsSection } from './IncomeAdditionalsSection'

afterEach(cleanup)
it('muestra una alerta al rechazar la eliminación por fondos usados y conserva el adicional', async () => {
  const onDelete = vi.fn().mockRejectedValue(new Error('Obligaciones: faltan 7,30 € para quedar en cero.'))
  render(<IncomeAdditionalsSection additionals={[{ id: 1, amount: 20 }]} currency="EUR" defaultOpen onAdd={vi.fn()} onDelete={onDelete} />)
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar adicional' }))
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Obligaciones: faltan 7,30 € para quedar en cero.')
  expect(screen.getByRole('button', { name: 'Eliminar adicional' })).toBeTruthy()
  expect(onDelete).toHaveBeenCalledWith(1)
})
