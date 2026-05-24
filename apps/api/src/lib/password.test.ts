import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';

describe('password', () => {
  it('verifica senha correta', async () => {
    const hash = await hashPassword('senha-correta-1234');
    expect(await verifyPassword('senha-correta-1234', hash)).toBe(true);
  });

  it('rejeita senha errada', async () => {
    const hash = await hashPassword('senha-correta-1234');
    expect(await verifyPassword('senha-errada', hash)).toBe(false);
  });

  it('gera hashes diferentes para a mesma senha (sal aleatório)', async () => {
    const a = await hashPassword('mesma-senha');
    const b = await hashPassword('mesma-senha');
    expect(a).not.toBe(b);
    expect(await verifyPassword('mesma-senha', a)).toBe(true);
    expect(await verifyPassword('mesma-senha', b)).toBe(true);
  });
});
