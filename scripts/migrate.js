import fs from 'fs';
import path from 'path';
import url from 'url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

async function main() {
  const migrationsDir = path.resolve(__dirname, '..', 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true
  });

  try {
    for (const fileName of files) {
      const file = path.resolve(migrationsDir, fileName);
      const sql = fs.readFileSync(file, 'utf8');
      const statements = sql
        .split(/;\s*\n/)
        .map((s) => s.trim())
        .filter(Boolean);

      // eslint-disable-next-line no-console
      console.log(`> Applying migration: ${fileName}`);
      for (const stmt of statements) {
        // eslint-disable-next-line no-console
        console.log('  - Executing:', stmt.substring(0, 80).replace(/\n/g, ' '), '...');
        try {
          await conn.query(stmt);
        } catch (e) {
          // Allow reruns: ignore common idempotent errors
          const ignorable = new Set([
            'ER_DB_CREATE_EXISTS', // 1007 database exists
            'ER_TABLE_EXISTS_ERROR', // 1050 table exists
            'ER_DUP_KEYNAME', // 1061 duplicate index
            'ER_DUP_FIELDNAME' // 1060 duplicate column
          ]);
          if (ignorable.has(e.code)) {
            // eslint-disable-next-line no-console
            console.warn('! Ignored:', e.code, e.sqlMessage || e.message);
            continue;
          }
          throw e;
        }
      }
    }

    // eslint-disable-next-line no-console
    console.log('✅ All migrations applied');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});




