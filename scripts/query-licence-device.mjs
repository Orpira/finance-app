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

try {
  // Primero mostrar la estructura de la tabla
  console.log('📋 Estructura de license_devices:');
  const schema = await sql`
    SELECT device_code, user_code, status, created_at
    FROM license_devices
    ORDER BY created_at DESC;
  `;
  schema.forEach(col => console.log(`  ${col.column_name}: ${col.data_type}`));
  
  console.log('\n✅ Query - Licence Devices:');
  const result = await sql`
    SELECT
  device_code, user_code, status, created_at
FROM license_devices
ORDER BY created_at DESC;
  `;

  if (result.length === 0) {
    console.log('⚠️  No hay dispositivos con licencia.');
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
