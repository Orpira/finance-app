import { webcrypto } from 'node:crypto'
import { writeFile } from 'node:fs/promises'

const [, , privateKeyPath = 'license-private-key.json', publicKeyPath = 'license-public-key.json'] =
  process.argv

const keyPair = await webcrypto.subtle.generateKey(
  { name: 'ECDSA', namedCurve: 'P-256' },
  true,
  ['sign', 'verify'],
)

const privateJwk = await webcrypto.subtle.exportKey('jwk', keyPair.privateKey)
const publicJwk = await webcrypto.subtle.exportKey('jwk', keyPair.publicKey)

await writeFile(privateKeyPath, `${JSON.stringify(privateJwk, null, 2)}\n`, {
  mode: 0o600,
})
await writeFile(publicKeyPath, `${JSON.stringify(publicJwk, null, 2)}\n`)

console.log(`Clave privada guardada en: ${privateKeyPath}`)
console.log(`Clave pública guardada en: ${publicKeyPath}`)
console.log('')
console.log('Copia la clave pública en src/services/signedLicenseService.ts.')
console.log('Mantén la clave privada fuera del repositorio y del APK.')
