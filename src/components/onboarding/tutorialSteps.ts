export interface TutorialStepConfig {
  id: string
  title: string
  description: string
  targetKeys: readonly string[]
}

export const TUTORIAL_STEPS: readonly TutorialStepConfig[] = [
  {
    id: 'movements',
    title: 'Registra tus movimientos',
    description: 'Desde aquí accedes a tus ingresos y egresos, y puedes añadir uno nuevo.',
    targetKeys: ['nav-movements'],
  },
  {
    id: 'agenda-reports',
    title: 'Agenda y reportes',
    description: 'Desde aquí accedes a tu agenda o a tus reportes.',
    targetKeys: ['nav-agenda', 'nav-reports'],
  },
  {
    id: 'assistant',
    title: 'Consulta al Asistente',
    description: 'Pregunta en lenguaje natural por tus ingresos, gastos o citas, sin salir de la app.',
    targetKeys: ['nav-asistente'],
  },
]
