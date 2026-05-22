import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConnectionStatus } from './ConnectionStatus';

describe('ConnectionStatus', () => {
  it('renderiza o chip com o rótulo inicial "Online"', () => {
    render(<ConnectionStatus />);
    // Estado inicial do esqueleto (§3.4): "online".
    expect(screen.getByText('Online')).toBeDefined();
    // Anúncio acessível para leitores de tela.
    expect(screen.getByRole('status')).toBeDefined();
  });
});
