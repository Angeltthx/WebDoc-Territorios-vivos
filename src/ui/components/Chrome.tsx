import { useEffect, useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { stations } from '../../content/journey';
import type { Tabs } from '../../content/pages';
import type { Transition } from '../../domain/types';
import { pagePath } from '../../application/journey';
import { Illustration } from './Media';

/** Página de entrada de cada estación dentro del PDF. */
export const STATION_PAGE: Record<string, number> = { chori: 2, atrato: 7, nuqui: 11, pangui: 15 };

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

/** Pestañas de la estación, como en el PDF. Cada una lleva a su página si existe. */
export function PageTabs({ tabs }: { tabs: Tabs }) {
  return (
    <nav className="tabs" aria-label="Secciones de la estación">
      {tabs.items.map((t) => {
        const active = t.label === tabs.active;
        const cls = `tab${active ? ' is-active' : ''}${t.warm ? ' tab--warm' : ''}`;
        return t.page ? (
          <Link key={t.label} to={pagePath(t.page)} className={cls} aria-current={active ? 'page' : undefined}>
            {t.label}
          </Link>
        ) : (
          <span key={t.label} className={`${cls} tab--off`}>{t.label}</span>
        );
      })}
    </nav>
  );
}

/** Flechas laterales para pasar de página. */
export function PageArrows({ page, total, onPrev, onNext }: { page: number; total: number; onPrev: () => void; onNext: () => void }) {
  return (
    <>
      {page > 1 && (
        <button type="button" className="page-arrow page-arrow--prev" onClick={onPrev} aria-label="Página anterior">
          <Arrow dir="left" />
        </button>
      )}
      {page < total && (
        <button type="button" className="page-arrow page-arrow--next" onClick={onNext} aria-label="Página siguiente">
          <Arrow dir="right" />
        </button>
      )}
    </>
  );
}

export function Arrow({ dir }: { dir: 'left' | 'right' | 'down' }) {
  const d = { left: 'M11 3 5 9l6 6', right: 'M7 3l6 6-6 6', down: 'M3 7l6 6 6-6' }[dir];
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

/** Guía de estaciones (reemplaza al mapa 3D durante esta entrega). */
export function StationGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
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
              <Link to={pagePath(STATION_PAGE[s.id])} className="guide__item" onClick={onClose} style={{ ['--accent' as string]: s.accent }}>
                <Illustration id={s.illustration} className="guide__art" />
                <span className="guide__num">Estación {s.number}</span>
                <strong>{s.name}</strong>
                <span className="guide__place">{s.place}</span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </dialog>
  );
}
