// Recorta y normaliza los sonidos de ../Contenido para la web (public/media/audio).
// Uso: npm run media:audio
// - chachita/<id>.mp3: las voces de Chachita para la portada y las transiciones.
// - ola-1/2/3.mp3: el tramo de cada grabación donde la ola crece y rompe, con entrada y salida suaves.
// Los audios no se versionan en git: se generan localmente a partir de los originales.
import ffmpeg from 'ffmpeg-static';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';

const SRC = path.resolve('..', 'Contenido');
const OUT = path.resolve('public', 'media', 'audio');
mkdirSync(OUT, { recursive: true });

/** Tramos elegidos analizando el volumen de cada archivo (segundo de inicio y duración). */
const WAVES = [
  { file: 'sonidos de olas 1.mp3', start: 3.0, duration: 3.6 },
  { file: 'sonidos de olas 2.mp3', start: 16.8, duration: 4.2 },
  { file: 'sonidos de olas 3.mp3', start: 1.4, duration: 4.2 },
];

WAVES.forEach(({ file, start, duration }, i) => {
  const out = path.join(OUT, `ola-${i + 1}.mp3`);
  execFileSync(ffmpeg, [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-ss', String(start), '-t', String(duration), '-i', path.join(SRC, file),
    '-af', `afade=t=in:st=0:d=0.5,afade=t=out:st=${duration - 1.4}:d=1.4,loudnorm=I=-24:TP=-3:LRA=11`,
    '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '128k', out,
  ], { stdio: 'inherit' });
  console.log(path.basename(out));
});

// Voces de Chachita (../Contenido/Chachita) → public/media/audio/chachita/<id>.mp3, a volumen parejo.
// "transicion x" y "Audio transición Viche" son el mismo archivo: se publica una sola vez como "x".
const VOICES = {
  intro: 'Intro.mp4',
  'estacion-1': 'Audio transición estación 1.mp4',
  'estacion-3': 'Audio transición estación 3.mp4',
  x: 'transicion x.m4a',
  y: 'transición y_.m4a',
  z: 'Transición z.m4a',
};
const VOICE_SRC = path.join(SRC, 'Chachita');
const VOICE_OUT = path.join(OUT, 'chachita');
mkdirSync(VOICE_OUT, { recursive: true });
// Los nombres pueden venir con tildes descompuestas (NFD) desde el zip.
const onDisk = readdirSync(VOICE_SRC);
const find = (name) => onDisk.find((f) => f.normalize('NFC') === name.normalize('NFC'));

for (const [id, name] of Object.entries(VOICES)) {
  const file = find(name);
  if (!file) { console.warn(`falta ${name}`); continue; }
  const out = path.join(VOICE_OUT, `${id}.mp3`);
  execFileSync(ffmpeg, [
    '-hide_banner', '-loglevel', 'error', '-y', '-i', path.join(VOICE_SRC, file), '-vn',
    '-af', 'loudnorm=I=-18:TP=-2:LRA=11', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '112k', out,
  ], { stdio: 'inherit' });
  console.log(`chachita/${id}.mp3`);
}

// El mapa 3D (30/10/2026) → public/media/audio/mapa: el ambiente en bucle sin costura (el final se funde con el
// principio) y los sonidos sueltos de los animales. Grabaciones de BigSoundBank, CC0
// (../Contenido/sonidos-mapa-bigsoundbank-cc0), y las olas del cliente. Lo que falte se salta: en el mapa no suena.
const MAP_SRC = path.join(SRC, 'sonidos-mapa-bigsoundbank-cc0');
const MAP_OUT = path.join(OUT, 'mapa');
mkdirSync(MAP_OUT, { recursive: true });
const mapFile = (name) => [path.join(MAP_SRC, name), path.join(SRC, name)].find((f) => existsSync(f));
/** Bucle: del segundo `start`, `length` segundos, con `fade` segundos de fundido entre el final y el principio. */
const MAP_LOOPS = {
  selva: { file: 'bosque-3-2715.mp3', start: 0, length: 150, fade: 5, level: -26 },
  cigarras: { file: 'cigarras-3002.mp3', start: 0, length: 60, fade: 4, level: -30 },
  olas: { file: 'sonidos de olas 3.mp3', start: 0, length: 36, fade: 4, level: -28 },
};
/** Sueltos: un tramo con entrada y salida suaves. */
const MAP_SHOTS = {
  ranas: { file: 'ranas-1-997.mp3', start: 12, length: 5 },
  pajaro: { file: 'piha-griton-1762.mp3', start: 0, length: 4 },
  'chapuzon-1': { file: 'chapuzon-grande-1-1519.mp3', start: 0, length: 3 },
  'chapuzon-2': { file: 'chapuzon-grande-2-1520.mp3', start: 0, length: 3 },
  'chapuzon-chico': { file: 'chapuzon-pequeno-1-1529.mp3', start: 0, length: 2 },
};
const encode = ['-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '112k'];
for (const [id, { file, start, length, fade, level }] of Object.entries(MAP_LOOPS)) {
  const src = mapFile(file);
  if (!src) { console.warn(`mapa: falta ${file}`); continue; }
  // [cuerpo: start+fade…start+length] fundido con [cabeza: start…start+fade]: el archivo termina donde empieza.
  execFileSync(ffmpeg, [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-ss', String(start + fade), '-t', String(length - fade), '-i', src,
    '-ss', String(start), '-t', String(fade), '-i', src,
    '-filter_complex', `[0:a][1:a]acrossfade=d=${fade}:c1=tri:c2=tri,loudnorm=I=${level}:TP=-3:LRA=11`,
    ...encode, path.join(MAP_OUT, `${id}.mp3`),
  ], { stdio: 'inherit' });
  console.log(`mapa/${id}.mp3`);
}
for (const [id, { file, start, length }] of Object.entries(MAP_SHOTS)) {
  const src = mapFile(file);
  if (!src) { console.warn(`mapa: falta ${file}`); continue; }
  execFileSync(ffmpeg, [
    '-hide_banner', '-loglevel', 'error', '-y', '-ss', String(start), '-t', String(length), '-i', src,
    '-af', `afade=t=in:st=0:d=0.05,afade=t=out:st=${length - 0.8}:d=0.8,loudnorm=I=-20:TP=-2:LRA=11`,
    ...encode, path.join(MAP_OUT, `${id}.mp3`),
  ], { stdio: 'inherit' });
  console.log(`mapa/${id}.mp3`);
}

// Los cantos de Chachita (Contenido/drive-2026-10-30, 29/10/2026) → public/media/audio/cantos, para «Chachita canta».
// En Drive, el enlace que el cliente llamó «Llorilé» trae el archivo «2 Bonito Viento.wav».
const SONGS = { 'morenita-nuquisena': '1 Morenita Nuquiseña Ajustada.wav', llorile: '2 Bonito Viento.wav' };
const SONG_SRC = path.join(SRC, 'drive-2026-10-30');
const SONG_OUT = path.join(OUT, 'cantos');
mkdirSync(SONG_OUT, { recursive: true });
const songsOnDisk = existsSync(SONG_SRC) ? readdirSync(SONG_SRC) : [];
for (const [id, name] of Object.entries(SONGS)) {
  const file = songsOnDisk.find((f) => f.normalize('NFC') === name.normalize('NFC'));
  if (!file) { console.warn(`cantos: falta ${name}`); continue; }
  execFileSync(ffmpeg, [
    '-hide_banner', '-loglevel', 'error', '-y', '-i', path.join(SONG_SRC, file), '-vn',
    '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '160k', path.join(SONG_OUT, `${id}.mp3`),
  ], { stdio: 'inherit' });
  console.log(`cantos/${id}.mp3`);
}
