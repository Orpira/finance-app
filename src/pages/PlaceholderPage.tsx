interface PlaceholderPageProps {
  title: string
}

export function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <section className="flex min-h-[60dvh] flex-col justify-center gap-2">
      <p className="text-sm font-medium text-emerald-700">{title}</p>
      <h1 className="text-2xl font-semibold text-slate-950">
        {title}
      </h1>
    </section>
  )
}
