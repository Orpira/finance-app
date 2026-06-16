const DRIVE_APPDATA_SCOPE = 'https://www.googleapis.com/auth/drive.appdata'
const TOKEN_STORAGE_KEY = 'private-balance:google-drive-token'
const DEVICE_CODE_URL = 'https://oauth2.googleapis.com/device/code'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files'
const DRIVE_UPLOAD_URL =
  'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart'

interface StoredGoogleToken {
  accessToken: string
  expiresAt: number
}

interface DeviceCodeResponse {
  device_code: string
  expires_in: number
  interval?: number
  user_code: string
  verification_url?: string
  verification_uri?: string
}

interface TokenResponse {
  access_token?: string
  error?: string
  error_description?: string
  expires_in?: number
}

export interface DriveBackupFile {
  createdTime: string
  id: string
  name: string
}

export interface EncryptedBackupUpload {
  content: string
  filename: string
  generatedAt: string
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds)
  })
}

function getStoredToken() {
  const storedToken = window.localStorage.getItem(TOKEN_STORAGE_KEY)

  if (!storedToken) {
    return null
  }

  try {
    return JSON.parse(storedToken) as StoredGoogleToken
  } catch {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY)
    return null
  }
}

function storeToken(tokenResponse: TokenResponse) {
  if (!tokenResponse.access_token || !tokenResponse.expires_in) {
    throw new Error('Google no devolvió un token válido.')
  }

  const storedToken: StoredGoogleToken = {
    accessToken: tokenResponse.access_token,
    expiresAt: Date.now() + tokenResponse.expires_in * 1000,
  }

  window.localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(storedToken))

  return storedToken
}

function assertOnline() {
  if (!navigator.onLine) {
    throw new Error('Sin conexión a internet. Intenta nuevamente cuando haya red.')
  }
}

function assertClientId(clientId: string) {
  if (!clientId.trim()) {
    throw new Error('Configura el Client ID de Google OAuth.')
  }
}

async function requestDeviceCode(clientId: string) {
  const response = await fetch(DEVICE_CODE_URL, {
    body: new URLSearchParams({
      client_id: clientId,
      scope: DRIVE_APPDATA_SCOPE,
    }),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    method: 'POST',
  })

  if (!response.ok) {
    throw new Error(`Google rechazó el inicio de sesión (${response.status}).`)
  }

  return (await response.json()) as DeviceCodeResponse
}

async function pollToken(clientId: string, deviceCode: DeviceCodeResponse) {
  const startedAt = Date.now()
  const expiresAt = startedAt + deviceCode.expires_in * 1000
  let intervalMs = (deviceCode.interval ?? 5) * 1000

  while (Date.now() < expiresAt) {
    await sleep(intervalMs)

    const response = await fetch(TOKEN_URL, {
      body: new URLSearchParams({
        client_id: clientId,
        device_code: deviceCode.device_code,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      method: 'POST',
    })
    const tokenResponse = (await response.json()) as TokenResponse

    if (tokenResponse.access_token) {
      return storeToken(tokenResponse)
    }

    if (tokenResponse.error === 'authorization_pending') {
      continue
    }

    if (tokenResponse.error === 'slow_down') {
      intervalMs += 5_000
      continue
    }

    if (tokenResponse.error === 'access_denied') {
      throw new Error('Inicio de sesión cancelado o permiso denegado.')
    }

    throw new Error(
      tokenResponse.error_description ??
        tokenResponse.error ??
        'No se pudo completar el inicio de sesión con Google.',
    )
  }

  throw new Error('El código de conexión con Google expiró.')
}

async function authorizedFetch(input: RequestInfo | URL, init?: RequestInit) {
  const accessToken = getGoogleAccessToken()

  if (!accessToken) {
    throw new Error('Google Drive no está conectado o el token expiró.')
  }

  return fetch(input, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${accessToken}`,
    },
  })
}

function buildMultipartBody(upload: EncryptedBackupUpload) {
  const boundary = `private-balance-${Date.now()}`
  const metadata = {
    name: upload.filename,
    parents: ['appDataFolder'],
  }
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    'Content-Type: application/octet-stream',
    '',
    upload.content,
    `--${boundary}--`,
    '',
  ].join('\r\n')

  return {
    body,
    contentType: `multipart/related; boundary=${boundary}`,
  }
}

export async function connectGoogleDrive(clientId: string) {
  assertOnline()
  assertClientId(clientId)

  const deviceCode = await requestDeviceCode(clientId.trim())
  const verificationUrl =
    deviceCode.verification_url ?? deviceCode.verification_uri

  if (verificationUrl) {
    window.open(verificationUrl, '_blank', 'noopener,noreferrer')
  }

  const token = await pollToken(clientId.trim(), deviceCode)

  return {
    expiresAt: token.expiresAt,
    scope: DRIVE_APPDATA_SCOPE,
    userCode: deviceCode.user_code,
    verificationUrl,
  }
}

export function disconnectGoogleDrive() {
  window.localStorage.removeItem(TOKEN_STORAGE_KEY)
}

export function getGoogleAccessToken() {
  const storedToken = getStoredToken()

  if (!storedToken) {
    return null
  }

  if (storedToken.expiresAt <= Date.now() + 60_000) {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY)
    return null
  }

  return storedToken.accessToken
}

export function isGoogleDriveConnected() {
  return Boolean(getGoogleAccessToken())
}

export async function uploadBackupToAppFolder(upload: EncryptedBackupUpload) {
  assertOnline()

  const multipart = buildMultipartBody(upload)
  const response = await authorizedFetch(DRIVE_UPLOAD_URL, {
    body: multipart.body,
    headers: {
      'Content-Type': multipart.contentType,
    },
    method: 'POST',
  })

  if (!response.ok) {
    throw new Error(`Google Drive respondió con error HTTP ${response.status}.`)
  }

  return (await response.json()) as DriveBackupFile
}

export async function listBackupsFromAppFolder() {
  assertOnline()

  const params = new URLSearchParams({
    fields: 'files(id,name,createdTime)',
    orderBy: 'createdTime desc',
    pageSize: '20',
    q: "name contains 'private-balance-backup-' and trashed = false",
    spaces: 'appDataFolder',
  })
  const response = await authorizedFetch(`${DRIVE_FILES_URL}?${params}`)

  if (!response.ok) {
    throw new Error(`No se pudieron listar backups (${response.status}).`)
  }

  const data = (await response.json()) as { files?: DriveBackupFile[] }

  return data.files ?? []
}

export async function downloadLatestBackupFromAppFolder() {
  const backups = await listBackupsFromAppFolder()
  const latestBackup = backups[0]

  if (!latestBackup) {
    throw new Error('No existen backups en Google Drive App Folder.')
  }

  const response = await authorizedFetch(
    `${DRIVE_FILES_URL}/${latestBackup.id}?alt=media`,
  )

  if (!response.ok) {
    throw new Error(`No se pudo descargar el backup (${response.status}).`)
  }

  return {
    content: await response.text(),
    file: latestBackup,
  }
}
