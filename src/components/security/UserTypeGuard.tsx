import { useEffect, useState, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'

import { getSettings } from '../../services/settingsService'
import type { UserType } from '../../types/settings'

export function UserTypeGuard({
  allowed,
  children,
}: {
  allowed: UserType[]
  children: ReactNode
}) {
  const [userType, setUserType] = useState<UserType | null>(null)

  useEffect(() => {
    getSettings().then((settings) => setUserType(settings.userType))
  }, [])

  if (!userType) {
    return (
      <section className="flex min-h-[60dvh] items-center justify-center text-sm text-slate-500">
        Cargando...
      </section>
    )
  }

  if (!allowed.includes(userType)) {
    return <Navigate replace to="/" />
  }

  return children
}
