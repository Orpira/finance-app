import { useEffect, useState, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'

import { getCurrentLicense } from '../../services/licenseService'
import type { LicenseType } from '../../types/license'

export function LicenseTypeGuard({
  blocked,
  children,
}: {
  blocked: LicenseType[]
  children: ReactNode
}) {
  const [licenseType, setLicenseType] = useState<LicenseType | null>()

  useEffect(() => {
    getCurrentLicense().then((license) => setLicenseType(license?.licenseType ?? null))
  }, [])

  if (licenseType === undefined) {
    return (
      <section className="flex min-h-[60dvh] items-center justify-center text-sm text-slate-500">
        Cargando...
      </section>
    )
  }

  if (licenseType !== null && blocked.includes(licenseType)) {
    return <Navigate replace to="/" />
  }

  return children
}
