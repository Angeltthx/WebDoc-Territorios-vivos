import { useState, type FormEvent } from 'react';

// Clave de acceso mientras el proyecto no se lanza (solo su huella SHA-256, para que no quede escrita en el código).
// Es una barrera liviana: quien la pasa una vez en un navegador no la vuelve a ver ahí.
const HASH = '9bcdae8ebc2a970a365103a52da830f3958f4f381fcfd544f7c0452ee09dba00';
const KEY = 'tv-acceso';

async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function isUnlocked() {
  try {
    return localStorage.getItem(KEY) === HASH;
  } catch {
    return false;
  }
}

export function Gate({ onUnlock }: { onUnlock: () => void }) {
  const [value, setValue] = useState('');
  const [wrong, setWrong] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if ((await sha256(value.trim().toLowerCase())) !== HASH) {
      setWrong(true);
      return;
    }
    try {
      localStorage.setItem(KEY, HASH);
    } catch {
      // Sin almacenamiento la clave vale solo para esta visita.
    }
    onUnlock();
  }

  return (
    <main className="gate">
      <h1 className="wordmark">
        <span className="wordmark__top">Territorios</span>
        <span className="wordmark__bottom">Vivos</span>
        <span className="wordmark__sub">Relatos del Pacífico</span>
      </h1>
      <form className="gate__form" onSubmit={submit}>
        <label htmlFor="gate-clave" className="eyebrow">Acceso privado</label>
        <input
          id="gate-clave"
          type="password"
          autoComplete="current-password"
          autoFocus
          value={value}
          onChange={(e) => { setValue(e.target.value); setWrong(false); }}
          placeholder="Contraseña"
          aria-invalid={wrong}
        />
        <button type="submit">Entrar</button>
        <p className="gate__error" role="alert">{wrong ? 'Esa no es la contraseña.' : ''}</p>
      </form>
    </main>
  );
}
