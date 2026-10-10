// Tutorial de «Tu historia»: la primera vez que alguien entra, cuatro pasos cortos le cuentan para qué es este
// espacio y qué puede hacer en él. Se puede saltar, y volver a ver con «¿Cómo funciona?».

import { useEffect, useState } from 'react';

export const TUTORIAL_SEEN = 'historia-tutorial-visto';

const STEPS = [
  {
    title: 'Este espacio es tuyo',
    text: 'El mapa del Chocó se va llenando con lo que vive su gente. Aquí puedes dejar lo tuyo: un recuerdo, una receta, un canto, algo que te pasó.',
    icon: 'space',
  },
  {
    title: 'Cuéntala a tu manera',
    text: 'Escríbela, o grábala con tu voz si prefieres contarla. Puedes sumar fotos o un video.',
    icon: 'voice',
  },
  {
    title: 'Ponla en su lugar',
    text: 'Dinos dónde pasó: el municipio y el sitio. Allí aparecerá en el mapa, con una figurita según de qué trata.',
    icon: 'pin',
  },
  {
    title: 'La cuidamos contigo',
    text: 'Antes de publicarla, el equipo de Territorios Vivos la lee. Tu contacto nunca se muestra.',
    icon: 'care',
  },
] as const;

function Icon({ name }: { name: (typeof STEPS)[number]['icon'] }) {
  const c = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg className="tutorial__icon" viewBox="0 0 64 64" aria-hidden="true">
      {name === 'space' && <><rect {...c} x="12" y="12" width="40" height="40" rx="3" strokeDasharray="3 4" /><path {...c} d="M24 40c4-6 8-6 12-1s6 4 8 0" /><circle {...c} cx="27" cy="26" r="3" /></>}
      {name === 'voice' && <><rect {...c} x="26" y="10" width="12" height="24" rx="6" /><path {...c} d="M18 28a14 14 0 0 0 28 0M32 42v10M24 52h16" /></>}
      {name === 'pin' && <><path {...c} d="M32 54s14-14 14-26a14 14 0 0 0-28 0c0 12 14 26 14 26z" /><circle {...c} cx="32" cy="28" r="5" /><path {...c} d="M12 56h40" strokeDasharray="2 4" /></>}
      {name === 'care' && <><path {...c} d="M32 52S12 40 12 26a10 10 0 0 1 20-3 10 10 0 0 1 20 3c0 14-20 26-20 26z" /><path {...c} d="M25 30l5 5 9-10" /></>}
    </svg>
  );
}

export function StoryTutorial({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const last = i === STEPS.length - 1;
  const done = () => {
    try {
      localStorage.setItem(TUTORIAL_SEEN, '1');
    } catch {
      // sin almacenamiento: se volverá a mostrar la próxima vez
    }
    onDone();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setI((n) => Math.min(n + 1, STEPS.length - 1));
      if (e.key === 'ArrowLeft') setI((n) => Math.max(n - 1, 0));
      if (e.key === 'Escape') done();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  const s = STEPS[i];
  return (
    <div className="tutorial" role="dialog" aria-modal="true" aria-labelledby="tutorial-title">
      <button type="button" className="tutorial__skip" onClick={done}>Saltar</button>
      {/* `key` reinicia la animación de entrada en cada paso. */}
      <div className="tutorial__slide" key={i}>
        <Icon name={s.icon} />
        <p className="tutorial__count">{i + 1} / {STEPS.length}</p>
        <h3 id="tutorial-title" className="tutorial__title">{s.title}</h3>
        <p className="tutorial__text">{s.text}</p>
      </div>
      <div className="tutorial__nav">
        <div className="tutorial__dots" role="tablist" aria-label="Pasos">
          {STEPS.map((step, k) => (
            <button key={step.title} type="button" role="tab" aria-selected={k === i} aria-label={step.title} className={k === i ? 'is-on' : ''} onClick={() => setI(k)} />
          ))}
        </div>
        <div className="tutorial__buttons">
          {i > 0 && <button type="button" className="tutorial__back" onClick={() => setI(i - 1)}>Atrás</button>}
          <button type="button" className="tutorial__next" onClick={() => (last ? done() : setI(i + 1))}>
            {last ? 'Empezar' : 'Siguiente'}
          </button>
        </div>
      </div>
    </div>
  );
}
