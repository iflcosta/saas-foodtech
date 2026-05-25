/**
 * Setup compartilhado de integração — cria um tenant + manager + operator,
 * monta o app Fastify e devolve tokens prontos. Cada chamada gera um `tag`
 * único para namespacing dos slugs / e-mails (`Date.now().toString(36)`).
 *
 * NUNCA usado pela aplicação — só por testes. Cleanup deleta o tenant; FK
 * com `ON DELETE CASCADE` no schema remove tudo derivado.
 */
import { createClient, tenants, users, type DbClient } from '@saas-foodtech/db';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { hashPassword } from '../lib/password.js';
import { build } from '../server.js';

export const TEST_JWT_SECRET =
  'integration-test-secret-with-at-least-32-chars!';

export interface TestContext {
  app: FastifyInstance;
  db: DbClient;
  tenantId: string;
  tenantSlug: string;
  managerToken: string;
  operatorToken: string;
  tag: string;
}

export async function createTestContext(databaseUrl: string): Promise<TestContext> {
  const db = createClient(databaseUrl);
  const tag = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const tenantSlug = `t-${tag}`;

  const [tenant] = await db
    .insert(tenants)
    .values({
      name: `Test ${tag}`,
      slug: tenantSlug,
      phoneWhatsapp: '+5511900000000',
    })
    .returning({ id: tenants.id });
  const tenantId = tenant!.id;

  const passwordHash = await hashPassword('test-password');

  const [manager] = await db
    .insert(users)
    .values({
      tenantId,
      name: `Manager ${tag}`,
      email: `manager-${tag}@test.local`,
      passwordHash,
      role: 'manager',
    })
    .returning({ id: users.id });

  const [operator] = await db
    .insert(users)
    .values({
      tenantId,
      name: `Operator ${tag}`,
      email: `operator-${tag}@test.local`,
      passwordHash,
      role: 'operator',
    })
    .returning({ id: users.id });

  const app = await build({ db, jwtSecret: TEST_JWT_SECRET, logger: false, rateLimitDisabled: true });

  const managerToken = app.jwt.sign(
    { sub: manager!.id, tenant_id: tenantId, role: 'manager' },
    { expiresIn: '8h' },
  );
  const operatorToken = app.jwt.sign(
    { sub: operator!.id, tenant_id: tenantId, role: 'operator' },
    { expiresIn: '8h' },
  );

  return {
    app,
    db,
    tenantId,
    tenantSlug,
    managerToken,
    operatorToken,
    tag,
  };
}

export async function destroyTestContext(ctx: TestContext): Promise<void> {
  if (ctx.tenantId) {
    await ctx.db.delete(tenants).where(eq(tenants.id, ctx.tenantId));
  }
  await ctx.app.close();
}

export const authHeaders = (token: string) => ({
  authorization: `Bearer ${token}`,
});
