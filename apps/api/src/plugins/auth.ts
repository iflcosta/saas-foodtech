/**
 * Plugin de autenticação JWT + contexto de tenant — RNF-1 / ADR-Q7.
 *
 * Decora a instância Fastify com:
 *  - `app.authenticate`    — pre-handler que valida o JWT e popula `req.auth`.
 *  - `app.requireRole(min)` — pre-handler chainable que exige papel mínimo (RBAC).
 *
 * Após `authenticate`, o `tenant_id` vive em `req.auth.tenantId` e é a ÚNICA
 * fonte de tenant aceita pelas rotas autenticadas. Payloads jamais carregam
 * `tenant_id` — `api-contracts.md` §1.
 */
import jwtPlugin from '@fastify/jwt';
import type {
  FastifyReply,
  FastifyRequest,
  preHandlerHookHandler,
} from 'fastify';
import fp from 'fastify-plugin';
import { jwtClaimsSchema, type UserRole } from '@saas-foodtech/shared';

declare module 'fastify' {
  interface FastifyRequest {
    auth?: { userId: string; tenantId: string; role: UserRole };
  }
  interface FastifyInstance {
    authenticate: preHandlerHookHandler;
    requireRole: (minRole: UserRole) => preHandlerHookHandler;
  }
}

const ROLE_RANK: Record<UserRole, number> = {
  operator: 1,
  manager: 2,
  owner: 3,
};

interface AuthPluginOpts {
  jwtSecret: string;
}

const sendUnauthenticated = (reply: FastifyReply, message: string) =>
  reply.code(401).send({
    error: { code: 'unauthenticated', message },
  });

const sendForbidden = (reply: FastifyReply, message: string) =>
  reply.code(403).send({
    error: { code: 'forbidden', message },
  });

export const authPlugin = fp<AuthPluginOpts>(
  async (app, opts) => {
    await app.register(jwtPlugin, { secret: opts.jwtSecret });

    app.decorate(
      'authenticate',
      async (req: FastifyRequest, reply: FastifyReply) => {
        let raw: unknown;
        try {
          raw = await req.jwtVerify();
        } catch {
          return sendUnauthenticated(
            reply,
            'Token ausente, inválido ou expirado.',
          );
        }

        const parsed = jwtClaimsSchema.safeParse(raw);
        if (!parsed.success) {
          return sendUnauthenticated(reply, 'Claims do token inválidos.');
        }

        const { sub, tenant_id, role } = parsed.data;
        req.auth = { userId: sub, tenantId: tenant_id, role };
      },
    );

    app.decorate(
      'requireRole',
      (minRole: UserRole): preHandlerHookHandler =>
        async (req: FastifyRequest, reply: FastifyReply) => {
          if (!req.auth) {
            return sendUnauthenticated(reply, 'Autenticação necessária.');
          }
          if (ROLE_RANK[req.auth.role] < ROLE_RANK[minRole]) {
            return sendForbidden(reply, 'Papel insuficiente para esta rota.');
          }
        },
    );
  },
  { name: 'auth-plugin' },
);
