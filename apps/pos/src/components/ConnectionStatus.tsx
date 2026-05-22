import { useEffect, useState } from 'react';

/*
 * ConnectionStatus — design-system.md §3.4.
 *
 * IMPORTANTE: este esqueleto NÃO detecta nem gerencia conectividade.
 * A camada Local-First é dona dessa responsabilidade (RNF-3 / ADR-Q1).
 * Aqui apenas alternamos os três estados a cada 4s, para verificação visual
 * do chip enquanto a integração real não existe.
 *
 * Estado `print-issue` (§3.4) fica para quando a fila de impressão real
 * for plugada; manter fora do ciclo evita comunicar erro fake.
 */

export type ConnectionState = 'online' | 'syncing' | 'offline';

const STATES: ConnectionState[] = ['online', 'syncing', 'offline'];
const CYCLE_MS = 4000;

interface StateMeta {
  label: string;
  dotColor: string;
  surface: string;
  pulse: boolean;
}

const META: Record<ConnectionState, StateMeta> = {
  online: {
    label: 'Online',
    dotColor: 'var(--color-success)',
    surface: 'var(--color-success-surface)',
    pulse: false,
  },
  syncing: {
    label: 'Sincronizando…',
    dotColor: 'var(--color-warning)',
    surface: 'var(--color-warning-surface)',
    pulse: true,
  },
  offline: {
    // Tom: "operando local", não "sem conexão" — comunica continuidade (P5).
    label: 'Offline · operando local',
    dotColor: 'var(--color-offline)',
    surface: 'var(--color-offline-surface)',
    pulse: false,
  },
};

export function ConnectionStatus(): JSX.Element {
  const [state, setState] = useState<ConnectionState>('online');

  useEffect(() => {
    const id = setInterval(() => {
      setState((prev) => {
        const next = STATES[(STATES.indexOf(prev) + 1) % STATES.length];
        return next ?? 'online';
      });
    }, CYCLE_MS);
    return () => clearInterval(id);
  }, []);

  const meta = META[state];

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Estado da conexão: ${meta.label}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-sm)',
        padding: 'var(--space-sm) var(--space-md)',
        backgroundColor: meta.surface,
        color: 'var(--color-text-primary)',
        borderRadius: 'var(--radius-full)',
        fontSize: 'var(--font-caption-size)',
        fontWeight: 'var(--font-caption-weight)',
        lineHeight: 'var(--font-caption-line-height)',
        border: '1px solid var(--color-border-subtle)',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: 'inline-block',
          width: 10,
          height: 10,
          borderRadius: 'var(--radius-full)',
          backgroundColor: meta.dotColor,
          animation: meta.pulse
            ? `pulse var(--motion-pulse-duration) var(--motion-pulse-easing) infinite`
            : undefined,
        }}
      />
      <span>{meta.label}</span>
    </div>
  );
}
