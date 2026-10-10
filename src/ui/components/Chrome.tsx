import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { stations } from '../../content/journey';
import type { Tabs } from '../../content/pages';
import { menu, social, type SocialNetwork } from '../../content/site';
import type { Transition } from '../../domain/types';
import { Illustration } from './Media';

/** Navegación del recorrido disponible para cualquier componente. */
export const JourneyNav = createContext<{ scrollToPage: (id: string) => void; scrollToIndex: (i: number) => void }>({
  scrollToPage: () => {},
  scrollToIndex: () => {},
});
export const useJourneyNav = () => useContext(JourneyNav);

/** Primera página de cada estación. */
export const STATION_PAGE: Record<string, string> = {
  chori: 'chori-pensamiento',
  atrato: 'atrato-pensamiento',
  nuqui: 'nuqui-pensamiento',
  pangui: 'pangui-marea-alta',
};

export function Chip({ children }: { children: ReactNode }) {
  return <span className="chip">{children}</span>;
}

export function TopBar({ label, right, plain }: { label: ReactNode; right?: ReactNode; plain?: boolean }) {
  return (
    <div className="topbar">
      {plain ? <span className="chip chip--plain">{label}</span> : <Chip>{label}</Chip>}
      <div className="topbar__right">{right}</div>
    </div>
  );
}

export function GuideButton({ onOpen, children = 'Mapa · guía' }: { onOpen: () => void; children?: ReactNode }) {
  return (
    <button type="button" className="ghost-link" onClick={onOpen}>
      <span aria-hidden="true">◇</span> {children}
    </button>
  );
}

export function ChachitaTag({ plain }: { plain?: boolean }) {
  if (plain) return <span className="ghost-link">Chachita</span>;
  return (
    <span className="pill">
      <svg width="14" height="8" viewBox="0 0 14 8" aria-hidden="true">
        <path d="M1 2c2 3 4 3 6 0s4-3 6 0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      Chachita
    </span>
  );
}

/** Pestañas de la estación. Cada una desplaza el recorrido hasta su página. */
export function PageTabs({ tabs }: { tabs: Tabs }) {
  const { scrollToPage } = useJourneyNav();
  return (
    <nav className="tabs" aria-label="Secciones de la estación">
      {tabs.items.map((t) => {
        const active = t.label === tabs.active;
        const cls = `tab${active ? ' is-active' : ''}${t.warm ? ' tab--warm' : ''}`;
        return t.to ? (
          <button key={t.label} type="button" className={cls} aria-current={active ? 'page' : undefined} onClick={() => scrollToPage(t.to!)}>
            {t.label}
          </button>
        ) : (
          <span key={t.label} className={`${cls} tab--off`}>{t.label}</span>
        );
      })}
    </nav>
  );
}

export function Arrow({ dir }: { dir: 'left' | 'right' | 'up' | 'down' }) {
  const d = { left: 'M11 3 5 9l6 6', right: 'M7 3l6 6-6 6', up: 'M3 11l6-6 6 6', down: 'M3 7l6 6 6-6' }[dir];
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TransitionSymbol({ kind }: { kind: Transition['symbol'] }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg className="t-symbol" width="64" height="40" viewBox="0 0 64 40" aria-hidden="true">
      {kind === 'wave' && <path {...common} d="M6 16c4-6 10-6 13 0M22 16c3 10 17 10 20 0M45 16c3-6 9-6 13 0" />}
      {kind === 'rain' && (
        <g {...common}>
          <path d="M16 20a16 12 0 0 1 32 0Z" fill="currentColor" stroke="none" />
          <path d="M32 20v12c0 3-5 3-5 0" />
        </g>
      )}
      {kind === 'meet' && <path {...common} d="M18 8v24l14-12Zm28 0v24L32 20Z" />}
      {kind === 'sea' && <path {...common} d="M12 12c4-4 8-4 12 0s8 4 12 0 8-4 12 0M12 20c4-4 8-4 12 0s8 4 12 0 8-4 12 0M12 28c4-4 8-4 12 0s8 4 12 0 8-4 12 0" />}
    </svg>
  );
}

function useDialog(open: boolean) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return ref;
}

/** Guía de estaciones (reemplaza al mapa 3D durante esta entrega). */
export function StationGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useDialog(open);
  const { scrollToPage } = useJourneyNav();
  return (
    <dialog ref={ref} className="guide" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()} aria-labelledby="guide-title">
      <div className="guide__inner">
        <div className="guide__head">
          <div>
            <p className="eyebrow">Guía del recorrido</p>
            <h2 id="guide-title">Del río al mar</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar guía">✕</button>
        </div>
        <ol className="guide__list">
          {stations.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="guide__item"
                onClick={() => { onClose(); scrollToPage(STATION_PAGE[s.id]); }}
                style={{ ['--accent' as string]: s.accent }}
              >
                <Illustration id={s.illustration} className="guide__art" />
                <span className="guide__num">Estación {s.number}</span>
                <strong>{s.name}</strong>
                <span className="guide__place">{s.place}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </dialog>
  );
}

/** Menú principal: botón fijo arriba a la derecha y panel a pantalla completa. */
export function SiteMenu({ open, onOpen, onClose }: { open: boolean; onOpen: () => void; onClose: () => void }) {
  const ref = useDialog(open);
  const { scrollToPage } = useJourneyNav();
  return (
    <>
      <button type="button" className="menu-btn" onClick={onOpen} aria-label="Abrir menú" aria-haspopup="dialog">
        <span /><span /><span />
      </button>
      <dialog ref={ref} className="menu" onClose={onClose} aria-label="Menú">
        <button type="button" className="icon-btn menu__close" onClick={onClose} aria-label="Cerrar menú">✕</button>
        <nav className="menu__nav">
          <p className="menu__brand">Territorios <em>Vivos</em></p>
          <ul>
            {menu.map((item, i) => (
              <li key={item.label} style={{ animationDelay: `${0.05 * i}s` }}>
                {item.to ? (
                  <button type="button" onClick={() => { onClose(); scrollToPage(item.to!); }}>{item.label}</button>
                ) : (
                  <span className="menu__soon" aria-disabled="true">
                    {item.label} <small>Próximamente</small>
                  </span>
                )}
              </li>
            ))}
          </ul>
          <SocialLinks className="menu__social" />
        </nav>
      </dialog>
    </>
  );
}

const ICONS: Record<SocialNetwork, ReactNode> = {
  youtube: (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="currentColor" d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12 31 31 0 0 0 1 16.8a3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8ZM9.7 15.1V8.9l5.8 3.1-5.8 3.1Z" />
    </svg>
  ),
  instagram: (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.4" cy="6.6" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
  tiktok: (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="currentColor" d="M16.6 2h-3.3v13.2a2.9 2.9 0 1 1-2.9-2.9c.3 0 .6 0 .9.1V9a6.3 6.3 0 1 0 5.3 6.2V8.6a8 8 0 0 0 4.6 1.5V6.8a4.7 4.7 0 0 1-4.6-4.8Z" />
    </svg>
  ),
};

/** Íconos de redes sociales. Sin dirección confirmada, el ícono se muestra sin enlace. */
export function SocialLinks({ className = '' }: { className?: string }) {
  return (
    <ul className={`social ${className}`} aria-label="Redes sociales">
      {social.map((s) => (
        <li key={s.network}>
          {s.url ? (
            <a href={s.url} target="_blank" rel="noopener noreferrer" aria-label={s.label} title={s.label}>{ICONS[s.network]}</a>
          ) : (
            <span aria-label={`${s.label} (enlace pendiente)`} title={`${s.label} · enlace pendiente`}>{ICONS[s.network]}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
