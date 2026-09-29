// Recorta y normaliza los sonidos de ../Contenido para la web (public/media/audio).
// Uso: npm run media:audio
// - ola-1/2/3.mp3: el tramo de cada grabación donde la ola crece y rompe, con entrada y salida suaves.
// Los audios no se versionan en git: se generan localmente a partir de los originales.
import ffmpeg from 'ffmpeg-static';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
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
