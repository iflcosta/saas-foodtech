/**
 * Rotas de autenticação — `api-contracts.md` §2.
 *
 * POST /v1/auth/login — único endpoint público de auth no MVP.
 *
 * Modelagem do email:
 *  - Schema permite mesmo email em tenants distintos (`UNIQUE(tenant_id, email)`).
 *  - O contrato (§2) usa apenas email+senha, sem slug de tenant.
 *  - V1.0: tratamos email como globalmente único. Se houver colisão entre tenants
 *    (dado órfão ou seed inconsistente), respondemos 401 — nunca adivinhamos.
 *  - Resposta uniforme em todos os erros (sem distinguir "email inexistente"
 *    de "senha errada") para não vazar enumeração.
 */
import type { DbClient } from '@saas-foodtech/db';
import { users } from '@saas-foodtech/db';
import { loginInputSchema } from '@saas-foodtech/shared';
import { eq } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';

interface AuthRoutesOpts {
  db: DbClient;
  // Janela curta — ADR-Q7 / RNF-5. PWA renova ao reconectar.
  tokenExpiresIn?: string;
}

const INVALID_CREDS = {
  error: {
    code: 'unauthenticated' as const,
    message: 'Credenciais inválidas.',
  },
};

export const authRoutes: FastifyPluginAsync<AuthRoutesOpts> = async (
  app,
  opts,
) => {
  const expiresIn = opts.tokenExpiresIn ?? '8h';

  app.post('/v1/auth/login', async (req, reply) => {
    const parsed = loginInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(422).send({
        error: {
          code: 'validation_error',
          message: 'Payload inválido.',
          details: parsed.error.issues.map((issue) => ({
            field: issue.path.join('.') || '(root)',
            issue: issue.message,
          })),
        },
      });
    }

    const { email, password } = parsed.data;

    // LIMIT 2 → detecta colisão sem custo extra.
    const matches = await opts.db
      .select({
        id: users.id,
        tenantId: users.tenantId,
        name: users.name,
        role: users.role,
        passwordHash: users.passwordHash,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(2);

    if (matches.length !== 1) {
      return reply.code(401).send(INVALID_CREDS);
    }
    const user = matches[0]!;

    const { verifyPassword } = await import('../lib/password.js');
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      return reply.code(401).send(INVALID_CREDS);
    }

    // Claims canônicas em jwtClaimsSchema (snake_case por convenção JWT).
    const token = app.jwt.sign(
      {
        sub: user.id,
        tenant_id: user.tenantId,
        role: user.role,
      },
      { expiresIn },
    );

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        tenant_id: user.tenantId,
      },
    };
  });
};
