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
  const result = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `;

  console.log('✅ Tablas en la base de datos:');
  result.forEach(row => console.log(`  - ${row.table_name}`));
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
