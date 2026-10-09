// Copia los modelos animados de la fauna (ballena, tortuga, cangrejo, pava y rana) desde el proyecto hermano de
// realidad aumentada (../../webar), ya optimizados allá (Draco + texturas WebP), a public/media/modelos/.
// Copia también el decodificador de Draco de three a public/draco/, que GLTFLoader necesita para abrirlos.
//
// Los modelos son material de la diseñadora: como el resto de la multimedia, NO se versionan (public/media/ y
// public/draco/ están en .gitignore). Se publican desde este equipo con la CLI de Vercel.
//
// Uso: node scripts/map-models.mjs [carpeta-de-modelos]   (por defecto ../../webar/public/models)
import { copyFile, mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const SOURCE = path.resolve(process.argv[2] ?? '../../webar/public/models');
const MODELS = ['Ballena_Ani.glb', 'Tortuga_Ani.glb', 'Cangrejo_Ani.glb', 'Pava_Ani.glb', 'Rana_Ani.glb'];
const OUT = path.resolve('public/media/modelos');
const DRACO_SRC = path.resolve('node_modules/three/examples/jsm/libs/draco/gltf');
const DRACO_OUT = path.resolve('public/draco');

await mkdir(OUT, { recursive: true });
for (const name of MODELS) {
  const from = path.join(SOURCE, name);
  try {
    await copyFile(from, path.join(OUT, name));
    console.log(`${name}  ${((await stat(from)).size / 1024).toFixed(0)} KB`);
  } catch {
    console.warn(`Falta ${from}: el mapa usará la figura dibujada con código para ese animal.`);
  }
}

await mkdir(DRACO_OUT, { recursive: true });
for (const name of await readdir(DRACO_SRC)) await copyFile(path.join(DRACO_SRC, name), path.join(DRACO_OUT, name));
console.log(`Decodificador Draco → ${path.relative(process.cwd(), DRACO_OUT)}`);
