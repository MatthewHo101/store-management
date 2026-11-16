import { z } from 'zod';

const environment = z.object({
  DATABASE_URL: z.string().startsWith('postgres'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  BUSINESS_NAME: z.string().min(1).default('Ember Coffee'),
  CURRENCY: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .default('USD'),
});
export function config() {
  return environment.parse(process.env);
}
