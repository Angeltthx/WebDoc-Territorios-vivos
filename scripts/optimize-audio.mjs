// Recorta y normaliza los sonidos de ../Contenido para la web (public/media/audio).
// Uso: npm run media:audio
// - chachita/<id>.mp3: las voces de Chachita para la portada y las transiciones.
// - ola-1/2/3.mp3: el tramo de cada grabación donde la ola crece y rompe, con entrada y salida suaves.
// Los audios no se versionan en git: se generan localmente a partir de los originales.
import ffmpeg from 'ffmpeg-static';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync } from 'node:fs';
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
