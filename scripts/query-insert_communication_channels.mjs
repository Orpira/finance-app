import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

config({ path: '.env.local' });
config({ path: '.env' });

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  console.error('❌ DATABASE_URL no está definido');
  process.exit(1);
}

const sql = neon(databaseUrl);

try {
  console.log('📋 Insert en communication_channels:');

  const schema = await sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = ${'communication_channels'}
    ORDER BY ordinal_position
  `;

  console.log('Esquema detectado:');
  schema.forEach((col) => console.log(`  ${col.column_name}: ${col.data_type}`));

  console.log('\n✅ Query - Insert Instanciado:');
  await sql`
    INSERT INTO communication_channels (
      user_code,
      provider,
      instance_name,
      phone_number,
      status,
      provider_metadata,
      last_seen_at,
      updated_at
    )
    VALUES (
      ${'PB-USER-23e4cf4c-3478-4b2e-8621-7985195fb570'},
      ${'whatsapp'},
      ${'pb-PB-DEVICE-d11bf13e-4723-4066-80d9-605fcc24de35'},
      ${'34643684541'},
      ${'connected'},
      ${'{"source":"manual-sync-after-evolution-connect"}'}::jsonb,
      NOW(),
      NOW()
    )
    ON CONFLICT (user_code, provider, instance_name)
    DO UPDATE SET
      phone_number = EXCLUDED.phone_number,
      status = EXCLUDED.status,
      provider_metadata = EXCLUDED.provider_metadata,
      last_seen_at = NOW(),
      updated_at = NOW()
  `;

  console.log('Canal WhatsApp conectado registrado en Neon');
} catch (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}
