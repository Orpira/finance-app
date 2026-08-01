import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'

/** Herramientas internas de desarrollador (inspector/playground de IA, migraciones): nunca deben quedar alcanzables desde una build de producción. */
export function DevOnlyGuard({ children }: { children: ReactNode }) {
  if (!import.meta.env.DEV) {
    return <Navigate replace to="/" />
  }

  return children
}
