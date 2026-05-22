import { ConnectionStatus } from './components/ConnectionStatus';

/*
 * Shell da Triagem do PDV — design-system.md §4.1.
 * Esqueleto: barra superior fixa com título placeholder + ConnectionStatus,
 * área principal exibindo apenas o estado vazio. Sem dados, sem grade real.
 */

export function App(): JSX.Element {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--color-bg-base)',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-md)',
          padding: 'var(--space-md) var(--space-lg)',
          backgroundColor: 'var(--color-bg-surface)',
          borderBottom: '1px solid var(--color-border-subtle)',
          boxShadow: 'var(--elevation-card)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 'var(--font-title-size)',
            fontWeight: 'var(--font-title-weight)',
            lineHeight: 'var(--font-title-line-height)',
            color: 'var(--color-text-primary)',
          }}
        >
          Triagem do PDV
        </h1>
        <ConnectionStatus />
      </header>

      <main
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--space-2xl) var(--space-lg)',
        }}
      >
        {/* §4.1 — Estado vazio: comunica calma, não ausência de função (P5). */}
        <section
          aria-label="Estado vazio da triagem"
          style={{
            maxWidth: 480,
            textAlign: 'center',
            padding: 'var(--space-2xl) var(--space-xl)',
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--elevation-card)',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 'var(--font-body-lg-size)',
              fontWeight: 'var(--font-body-lg-weight)',
              lineHeight: 'var(--font-body-lg-line-height)',
              color: 'var(--color-text-primary)',
            }}
          >
            Nenhum pedido aberto. Tudo certo por aqui.
          </p>
        </section>
      </main>
    </div>
  );
}
