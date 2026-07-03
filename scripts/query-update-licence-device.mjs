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
    update license_devices
    set user_code = 'PB-USER-462bf8fc-e779-45b9-8775-d8c11757f2b0'
    where device_code = 'PB-9DB2-FBCE-EA10'
  `;
  schema.forEach(col => console.log(`  ${col.column_name}: ${col.data_type}`));
  
  console.log('\n✅ Query - Licence Devices:');
  const result = await sql`
    update license_devices
    set user_code = 'PB-USER-462bf8fc-e779-45b9-8775-d8c11757f2b0'
    where device_code = 'PB-9DB2-FBCE-EA10';
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
