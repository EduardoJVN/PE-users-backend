import { defineConfig } from 'prisma/config';
import { PrismaPg } from '@prisma/adapter-pg';

export default defineConfig({
  migrate: {
    async adapter(env) {
      // DIRECT_URL bypasses PgBouncer — required for migrations
      return new PrismaPg({ connectionString: env['DIRECT_URL'] as string });
    },
  },
});
