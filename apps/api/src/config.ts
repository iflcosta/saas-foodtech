/**
 * Configuração de ambiente — validada por Zod na fronteira do processo.
 *
 * Falha cedo: se uma variável obrigatória estiver ausente/inválida, o processo
 * morre no boot com mensagem clara, ao invés de explodir tarde em runtime.
 */
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL obrigatória')
    .refine((v) => v.startsWith('postgres://') || v.startsWith('postgresql://'), {
      message: 'DATABASE_URL deve ser uma conexão postgres://',
    }),
  // 32 bytes (256 bits) é o piso recomendado para HS256.
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET precisa de ao menos 32 caracteres'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.') || '(env)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Configuração de ambiente inválida:\n${issues}`);
  }
  return result.data;
}
