import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import 'dotenv/config';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('--- Iniciando Seed con SQL Nativo ---'); // eslint-disable-line

  // Usamos una transacción para asegurarnos de que todo se inserte o nada
  await prisma.$transaction(async (tx) => {
    // 1. Limpiar tablas (opcional, por si quieres re-ejecutarlo)
    // TRUNCATE elimina los datos y reinicia contadores de ID
    await tx.$executeRawUnsafe(
      `TRUNCATE TABLE "user_roles", "user_status", "register_types" RESTART IDENTITY CASCADE;`,
    );

    // 2. Insertar Roles de Usuario con IDs fijos
    await tx.$executeRawUnsafe(`
      INSERT INTO "user_roles" (id, name, created_at, updated_at) VALUES
      (1, 'VIEWER', NOW(), NOW()),
    `);

    // 3. Insertar Estados de Usuario
    await tx.$executeRawUnsafe(`
      INSERT INTO "user_status" (id, name, created_at, updated_at) VALUES
      (1, 'PENDING', NOW(), NOW()),
      (2, 'ACTIVE', NOW(), NOW()),
      (3, 'SUSPENDED', NOW(), NOW());
    `);

    // 4. Insertar Tipos de Registro
    await tx.$executeRawUnsafe(`
      INSERT INTO "register_types" (id, name, created_at, updated_at) VALUES
      (1, 'EMAIL', NOW(), NOW()),
      (2, 'GOOGLE', NOW(), NOW()),  
      (3, 'FACEBOOK', NOW(), NOW());
`);

    // 5. Roles de Miembros de Empresa (Pivot Table Roles)
    await tx.$executeRawUnsafe(`
      INSERT INTO "company_member_roles" (id, name, created_at, updated_at) VALUES
      (1, 'OWNER', NOW(), NOW()),
      (3, 'EDITOR', NOW(), NOW()),
      (4, 'VIEWER', NOW(), NOW());
    `);

    console.log('✅ Catálogos insertados con IDs fijos.'); // eslint-disable-line
  });
}

main()
  .then(async () => await prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
