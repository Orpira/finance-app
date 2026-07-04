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
  console.log('📋 Estructura de communication_channels:');
  const schema = await sql`
    update communication_channels
    set phone_number = '34692091389'
    where instance_name = 'pb-PB-DEVICE-d11bf13e-4723-4066-80d9-605fcc24de35'
  `;
  schema.forEach(col => console.log(`  ${col.column_name}: ${col.data_type}`));
  
  console.log('\n✅ Query - Licence Devices:');
  const result = await sql`
    update communication_channels
    set phone_number = '34692091389'
    where instance_name = 'pb-PB-DEVICE-d11bf13e-4723-4066-80d9-605fcc24de35';
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
