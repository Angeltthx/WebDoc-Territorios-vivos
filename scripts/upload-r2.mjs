// Sube los videos pesados a Cloudflare R2 (historias, 360, transiciones y portada), con la misma ruta que en la web:
// public/media/historias/... → <bucket>/media/historias/...
// Uso: npm run media:r2            (sube solo lo nuevo o lo que cambió de tamaño)
//      npm run media:r2 -- --check  (solo dice qué subiría)
// Lee las claves de .env.r2 (copia de .env.r2.example; no va en git ni en Vercel).
// También deja configurado el CORS del bucket, para que el reproductor (hls.js) y el 360 puedan leer los videos.
import { S3Client, ListObjectsV2Command, PutBucketCorsCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { createReadStream, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const FOLDERS = ['historias', '360', 'transiciones', 'video'];
const ORIGINS = ['https://web-tau-sable-23.vercel.app', 'http://localhost:3000', 'http://localhost:5173'];
const TYPES = {
  '.m3u8': 'application/vnd.apple.mpegurl', '.ts': 'video/mp2t', '.mp4': 'video/mp4', '.webp': 'image/webp', '.jpg': 'image/jpeg',
};
const check = process.argv.includes('--check');

const env = {};
for (const line of readFileSync('.env.r2', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, '');
}
for (const k of ['R2_ACCOUNT_ID', 'R2_BUCKET', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']) {
  if (!env[k]) throw new Error(`Falta ${k} en .env.r2`);
}
// Orígenes extra (p. ej. el dominio propio): R2_ORIGINS=https://territoriosvivos.co,https://www.territoriosvivos.co
if (env.R2_ORIGINS) ORIGINS.push(...env.R2_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean));

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
});
const Bucket = env.R2_BUCKET;

/** Lo que ya está en el bucket: clave → tamaño. */
async function remote() {
  const out = new Map();
  let ContinuationToken;
  do {
    const r = await s3.send(new ListObjectsV2Command({ Bucket, Prefix: 'media/', ContinuationToken }));
    for (const o of r.Contents ?? []) out.set(o.Key, o.Size);
    ContinuationToken = r.IsTruncated ? r.NextContinuationToken : undefined;
  } while (ContinuationToken);
  return out;
}

function* walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}

const have = await remote();
const todo = [];
for (const folder of FOLDERS) {
  const root = path.resolve('public', 'media', folder);
  for (const file of walk(root)) {
    const Key = path.relative(path.resolve('public'), file).split(path.sep).join('/');
    const size = statSync(file).size;
    if (have.get(Key) !== size) todo.push({ file, Key, size });
  }
}
const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;
console.log(`${todo.length} archivos por subir (${mb(todo.reduce((a, t) => a + t.size, 0))}); ${have.size} ya están en el bucket.`);
if (check) process.exit(0);

await s3.send(new PutBucketCorsCommand({
  Bucket,
  CORSConfiguration: { CORSRules: [{ AllowedOrigins: ORIGINS, AllowedMethods: ['GET', 'HEAD'], AllowedHeaders: ['*'], MaxAgeSeconds: 86400 }] },
}));
console.log(`CORS listo para: ${ORIGINS.join(', ')}`);

// Varias subidas a la vez; las listas de reproducción (.m3u8) al final, para no publicar una lista con pedazos que faltan.
todo.sort((a, b) => Number(a.Key.endsWith('.m3u8')) - Number(b.Key.endsWith('.m3u8')));
let done = 0;
let bytes = 0;
const total = todo.reduce((a, t) => a + t.size, 0);
const queue = [...todo];
async function worker() {
  for (let t = queue.shift(); t; t = queue.shift()) {
    await new Upload({
      client: s3,
      params: {
        Bucket, Key: t.Key, Body: createReadStream(t.file),
        ContentType: TYPES[path.extname(t.file).toLowerCase()] ?? 'application/octet-stream',
        // Los nombres cambian con cada versión (carpetas con fecha o ?v=), así que se pueden guardar en caché un año.
        CacheControl: 'public, max-age=31536000, immutable',
      },
    }).done();
    done++;
    bytes += t.size;
    if (done % 25 === 0 || done === todo.length) console.log(`${done}/${todo.length} · ${mb(bytes)} de ${mb(total)}`);
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
console.log('Listo.');
