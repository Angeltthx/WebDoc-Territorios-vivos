// Crea las tablas de las historias en la base de datos (Neon). Se puede correr cuantas veces se quiera.
// Uso: npm run db:setup   (lee DATABASE_URL de .env.local: `vercel env pull .env.local --yes`)
import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';

try {
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {
  // sin .env.local: se usa el entorno
}
if (!process.env.DATABASE_URL) {
  console.error('Falta DATABASE_URL. Conecta Neon al proyecto y corre: vercel env pull .env.local --yes');
  process.exit(1);
}
// El esquema vive junto a la API (api/_lib/db.ts); aquí se lee el mismo texto para no repetirlo.
const source = readFileSync('api/_lib/db.ts', 'utf8');
const block = source.slice(source.indexOf('export const SCHEMA = ['), source.indexOf('];', source.indexOf('export const SCHEMA = [')));
const statements = [...block.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
const sql = neon(process.env.DATABASE_URL);
for (const s of statements) {
  await sql.query(s);
  console.log('✓', s.split('\n')[0].trim().slice(0, 70));
}
console.log('Listo.');
