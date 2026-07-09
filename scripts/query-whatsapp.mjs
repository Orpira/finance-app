import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

config({ path: '.env.local' });
config({ path: '.env' });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL no está definido');
  process.exit(1);
}

const sql = neon(databaseUrl);
const deviceCode = process.argv[2]?.trim();

if (!deviceCode) {
  console.error('❌ Debes indicar deviceCode. Uso: node scripts/query-whatsapp.mjs <PB-DEVICE-...>');
  process.exit(1);
}

try {
  // Primero mostrar la estructura de la tabla
  console.log('📋 Estructura de communication_channels:');
  const schema = await sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'communication_channels'
    ORDER BY ordinal_position;
  `;
  schema.forEach(col => console.log(`  ${col.column_name}: ${col.data_type}`));
  
  console.log(`\n✅ Query contextual - WhatsApp conectado para ${deviceCode}:`);
  const result = await sql`
    SELECT
      cc.instance_name,
      cc.phone_number,
      cc.status,
      cc.provider,
      cc.preferences
    FROM license_devices ld
    JOIN communication_channels cc
      ON cc.user_code = ld.user_code
    WHERE ld.device_code = ${deviceCode}
      AND cc.provider = 'whatsapp'
      AND cc.status = 'connected'
    ORDER BY cc.updated_at DESC
    LIMIT 1;
  `;

  if (result.length === 0) {
    console.log('⚠️  No hay canal WhatsApp conectado para este dispositivo.');
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
