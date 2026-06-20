const LICENSE_PREFIX = "PB";
const CHECKSUM_SALT = "PRIVATE-BALANCE-OFFLINE-V1";

const licenseTypeTokens = {
  demo: "DEMO",
  monthly: "MONTHLY",
  annual: "ANNUAL",
  lifetime: "LIFETIME",
};

function simpleHash(value) {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

function checksum(payload) {
  return simpleHash(`${payload}|${CHECKSUM_SALT}`)
    .toString(36)
    .toUpperCase()
    .padStart(4, "0")
    .slice(-4);
}

function normalizeExpirationDate(expirationDate) {
  const compactDate = expirationDate.replaceAll("-", "");

  if (!/^\d{8}$/.test(compactDate)) {
    throw new Error("La fecha debe tener formato YYYY-MM-DD.");
  }

  return compactDate;
}

function getDeviceHashFragment(deviceCode) {
  return simpleHash(deviceCode.trim().toUpperCase())
    .toString(16)
    .toUpperCase()
    .padStart(8, "0")
    .slice(-8);
}

function generateActivationCode(deviceCode, licenseType, expirationDate = "") {
  const typeToken = licenseTypeTokens[licenseType];

  if (!typeToken) {
    throw new Error("Tipo de licencia inválido: demo, monthly, annual, lifetime");
  }

  const expirationToken =
    licenseType === "lifetime"
      ? "00000000"
      : normalizeExpirationDate(expirationDate);

  const deviceHash = getDeviceHashFragment(deviceCode);

  const payload = [
    LICENSE_PREFIX,
    typeToken,
    expirationToken,
    deviceHash,
  ].join("-");

  return `${payload}-${checksum(payload)}`;
}

const [, , deviceCode, licenseType, expirationDate] = process.argv;

if (!deviceCode || !licenseType) {
  console.log(`
Uso:
node scripts/generate-license.mjs DEVICE_CODE TIPO_LICENCIA FECHA_EXPIRACION

Ejemplos:
node scripts/generate-license.mjs PB-ADD9-3950-A802 demo 2026-07-31
node scripts/generate-license.mjs PB-ADD9-3950-A802 monthly 2026-07-31
node scripts/generate-license.mjs PB-ADD9-3950-A802 annual 2027-06-20
node scripts/generate-license.mjs PB-ADD9-3950-A802 lifetime
`);
  process.exit(1);
}

try {
  const code = generateActivationCode(deviceCode, licenseType, expirationDate);

  console.log("\nCódigo de activación:");
  console.log(code);
  console.log("");
} catch (error) {
  console.error("\nError:");
  console.error(error.message);
  process.exit(1);
}