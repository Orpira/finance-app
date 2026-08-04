import { PageHeader } from '../../components/layout/PageHeader'

export function NotFoundPage() {
  return (
    <section className="flex min-h-[60dvh] flex-col gap-2">
      <PageHeader
        backLabel="Inicio"
        backTo="/"
        eyebrow="Error 404"
        title="Página no encontrada"
      />
      <p className="text-sm text-slate-600 dark:text-slate-300">
        La dirección a la que intentaste acceder no existe o ya no está disponible.
      </p>
    </section>
  )
}

export default NotFoundPage
