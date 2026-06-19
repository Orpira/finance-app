import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.financeapp.app',
  appName: 'Private Balance',
  webDir: 'dist',
  bundledWebRuntime: false,
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_launcher_foreground',
      iconColor: '#047857',
      sound: 'appointment_alarm.ogg',
      presentationOptions: ['badge', 'sound', 'banner', 'list'],
    },
  },
}

export default config
