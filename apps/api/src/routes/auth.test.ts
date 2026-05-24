/**
 * Teste de integração da rota de login.
 *
 * Exige Postgres real. Roda apenas se `INTEGRATION_DATABASE_URL` estiver
 * definida — assim `npm test` em máquinas sem DB (CI atual, dev sem Docker)
 * pula a suíte sem falhar.
 *
 * Para rodar localmente:
 *   docker compose up -d postgres
 *   npm run db:push
 *   INTEGRATION_DATABASE_URL=postgres://postgres:postgres@localhost:5432/saas_foodtech \
 *     npm run test -w apps/api
 */
import { createClient, tenants, users, type DbClient } from '@saas-foodtech/db';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hashPassword } from '../lib/password.js';
import { build } from '../server.js';

const DATABASE_URL = process.env.INTEGRATION_DATABASE_URL;
const JWT_SECRET = 'integration-test-secret-with-at-least-32-chars!';

const runIntegration = Boolean(DATABASE_URL);

describe.skipIf(!runIntegration)(
  'POST /v1/auth/login (integração com Postgres real)',
  () => {
    let app: FastifyInstance;
    let db: DbClient;
    let tenantAId: string;
    let tenantBId: string;
    const passwordPlain = 'senha-de-teste-1234';
    let passwordHash: string;

    beforeAll(async () => {
      db = createClient(DATABASE_URL!);
      passwordHash = await hashPassword(passwordPlain);

      const tag = Date.now().toString(36);

      const [tA] = await db
        .insert(tenants)
        .values({
          name: `Test A ${tag}`,
          slug: `test-a-${tag}`,
          phoneWhatsapp: '+5511999999999',
        })
        .returning({ id: tenants.id });
      tenantAId = tA!.id;

      const [tB] = await db
        .insert(tenants)
        .values({
          name: `Test B ${tag}`,
          slug: `test-b-${tag}`,
          phoneWhatsapp: '+5511999999998',
        })
        .returning({ id: tenants.id });
      tenantBId = tB!.id;

      // Usuário exclusivo do tenant A → login normal.
      await db.insert(users).values({
        tenantId: tenantAId,
        name: 'Operador A',
        email: `op-a-${tag}@test.local`,
        passwordHash,
        role: 'operator',
      });

      // Mesmo email em A e B → colisão → login deve recusar.
      const sharedEmail = `shared-${tag}@test.local`;
      await db.insert(users).values({
        tenantId: tenantAId,
        name: 'Compartilhado A',
        email: sharedEmail,
        passwordHash,
        role: 'operator',
      });
      await db.insert(users).values({
        tenantId: tenantBId,
        name: 'Compartilhado B',
        email: sharedEmail,
        passwordHash,
        role: 'operator',
      });

      app = await build({ db, jwtSecret: JWT_SECRET, logger: false });

      // Guarda metadados para os testes via closures
      (app as unknown as { _tag: string })._tag = tag;
    });

    afterAll(async () => {
      // Limpa tenants — cascata remove os users.
      if (tenantAId) await db.delete(tenants).where(eq(tenants.id, tenantAId));
      if (tenantBId) await db.delete(tenants).where(eq(tenants.id, tenantBId));
      await app?.close();
    });

    it('200 com credenciais corretas, retorna token e dados do user', async () => {
      const tag = (app as unknown as { _tag: string })._tag;
      const res = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { email: `op-a-${tag}@test.local`, password: passwordPlain },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.token).toMatch(/^eyJ/); // header de JWT base64
      expect(body.user).toMatchObject({
        name: 'Operador A',
        role: 'operator',
        tenant_id: tenantAId,
      });

      // O token é verificável pela mesma instância
      const claims = app.jwt.verify(body.token) as {
        sub: string;
        tenant_id: string;
        role: string;
        exp: number;
      };
      expect(claims.tenant_id).toBe(tenantAId);
      expect(claims.role).toBe('operator');
      expect(claims.sub).toBe(body.user.id);
    });

    it('401 com senha errada', async () => {
      const tag = (app as unknown as { _tag: string })._tag;
      const res = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: {
          email: `op-a-${tag}@test.local`,
          password: 'senha-errada',
        },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().error.code).toBe('unauthenticated');
    });

    it('401 com email inexistente (mesma mensagem, evita enumeração)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: {
          email: 'nao-existe@test.local',
          password: passwordPlain,
        },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().error.code).toBe('unauthenticated');
    });

    it('401 quando o mesmo email existe em 2 tenants (recusa em vez de adivinhar)', async () => {
      const tag = (app as unknown as { _tag: string })._tag;
      const res = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: {
          email: `shared-${tag}@test.local`,
          password: passwordPlain,
        },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().error.code).toBe('unauthenticated');
    });

    it('422 quando o payload está mal-formado', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { email: 'nao-eh-email', password: '' },
      });
      expect(res.statusCode).toBe(422);
      expect(res.json().error.code).toBe('validation_error');
      expect(res.json().error.details.length).toBeGreaterThan(0);
    });

    it('422 quando o payload tem campo extra (loginInputSchema é strict)', async () => {
      const tag = (app as unknown as { _tag: string })._tag;
      const res = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: {
          email: `op-a-${tag}@test.local`,
          password: passwordPlain,
          tenant_id: 'tentativa-de-injecao',
        },
      });
      expect(res.statusCode).toBe(422);
      expect(res.json().error.code).toBe('validation_error');
    });
  },
);
