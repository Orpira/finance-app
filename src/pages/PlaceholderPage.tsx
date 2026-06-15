import { PageHeader } from '../components/layout/PageHeader'

interface PlaceholderPageProps {
  title: string
}

export function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <section className="flex min-h-[60dvh] flex-col gap-2">
      <PageHeader backLabel="Inicio" backTo="/" eyebrow={title} title={title} />
    </section>
  )
}
