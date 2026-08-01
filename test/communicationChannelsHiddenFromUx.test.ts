import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function readSource(relativePath: string): string {
  return readFileSync(resolve(__dirname, relativePath), 'utf8')
}

describe('Canales de comunicación fuera de la experiencia principal', () => {
  it('no aparece como enlace visible en Configuración', () => {
    const settingsPageSource = readSource('../src/pages/Settings/SettingsPage.tsx')

    expect(settingsPageSource).not.toContain('Canales de comunicación')
    expect(settingsPageSource).not.toContain('communication-channels')
  })

  it('no aparece en Más ni en la navegación principal', () => {
    const morePageSource = readSource('../src/pages/More/MorePage.tsx')
    const appLayoutSource = readSource('../src/app/AppLayout.tsx')

    for (const source of [morePageSource, appLayoutSource]) {
      expect(source).not.toContain('Canales de comunicación')
      expect(source).not.toContain('communication-channels')
      expect(source.toLowerCase()).not.toContain('whatsapp')
    }
  })

  it('no aparece en Inicio ni en sus accesos rápidos', () => {
    const homePageSource = readSource('../src/pages/Home/HomePage.tsx')

    expect(homePageSource).not.toContain('communication-channels')
    expect(homePageSource.toLowerCase()).not.toContain('whatsapp')
  })

  it('la ruta pública queda protegida detrás de DevOnlyGuard, no eliminada ni expuesta', () => {
    const routesSource = readSource('../src/routes/index.tsx')

    expect(routesSource).toContain('path="settings/communication-channels"')
    expect(routesSource).toMatch(
      /path="settings\/communication-channels"\s+element=\{<DevOnlyGuard><CommunicationChannelsPage \/><\/DevOnlyGuard>\}/,
    )
  })

  it('el texto promocional de licencia ya no promete "canales de comunicación"', () => {
    const licensePageSource = readSource('../src/pages/Settings/SettingsLicensePage.tsx')

    expect(licensePageSource).not.toContain('canales de comunicación')
  })

  it('no hay referencias visibles a WhatsApp/Meta/Evolution fuera de páginas de desarrollo o del propio canal', () => {
    const filesToCheck = [
      '../src/pages/Home/HomePage.tsx',
      '../src/pages/More/MorePage.tsx',
      '../src/app/AppLayout.tsx',
      '../src/pages/Settings/SettingsPage.tsx',
      '../src/pages/Movements/MovementsPage.tsx',
      '../src/pages/Agenda/AgendaPage.tsx',
      '../src/pages/Conversation/ConversationPage.tsx',
    ]

    for (const file of filesToCheck) {
      const source = readSource(file).toLowerCase()
      expect(source).not.toContain('whatsapp')
      expect(source).not.toContain('evolution api')
      expect(source).not.toContain('meta cloud')
    }
  })
})
