export interface TutorialStepConfig {
  id: string
  title: string
  description: string
  targetKeys: readonly string[]
}

export const TUTORIAL_STEPS: readonly TutorialStepConfig[] = [
  {
    id: 'income',
    title: 'Registra un ingreso',
    description: 'Desde aquí accedes a tus ingresos y puedes añadir uno nuevo.',
    targetKeys: ['nav-income'],
  },
  {
    id: 'expense',
    title: 'Registra un egreso',
    description: 'Desde aquí accedes a tus egresos y puedes añadir uno nuevo.',
    targetKeys: ['nav-expenses'],
  },
  {
    id: 'agenda-reports',
    title: 'Agenda y reportes',
    description: 'Desde aquí accedes a tu agenda o a tus reportes.',
    targetKeys: ['nav-agenda', 'nav-reports'],
  },
]
