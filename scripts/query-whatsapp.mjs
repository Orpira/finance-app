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
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'communication_channels'
    ORDER BY ordinal_position;
  `;
  schema.forEach(col => console.log(`  ${col.column_name}: ${col.data_type}`));
  
  console.log('\n✅ Query - WhatsApp conectados:');
  const result = await sql`
    SELECT
      instance_name,
      phone_number,
      status,
      provider
    FROM communication_channels
    WHERE provider = 'whatsapp' AND status = 'connected'
    ORDER BY updated_at DESC
    LIMIT 1;
  `;

  if (result.length === 0) {
    console.log('⚠️  No hay canales WhatsApp conectados.');
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
