import { MigrationInterface, QueryRunner } from 'typeorm';

const TABLES = ['sale_event', 'tax_payment_event', 'sale_amendment'] as const;

export class InitialTaxLedger1710000000000 implements MigrationInterface {
  name = 'InitialTaxLedger1710000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sale_event" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "createdAt" datetime NOT NULL,
        "updatedAt" datetime NOT NULL,
        "deletedAt" datetime,
        "metadata" text,
        "date" varchar NOT NULL,
        "dateEpoch" integer NOT NULL,
        "invoiceId" varchar NOT NULL,
        "items" text NOT NULL
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tax_payment_event" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "createdAt" datetime NOT NULL,
        "updatedAt" datetime NOT NULL,
        "deletedAt" datetime,
        "metadata" text,
        "date" varchar NOT NULL,
        "dateEpoch" integer NOT NULL,
        "amount" integer NOT NULL
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sale_amendment" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "createdAt" datetime NOT NULL,
        "updatedAt" datetime NOT NULL,
        "deletedAt" datetime,
        "metadata" text,
        "date" varchar NOT NULL,
        "dateEpoch" integer NOT NULL,
        "invoiceId" varchar NOT NULL,
        "itemId" varchar NOT NULL,
        "cost" integer NOT NULL,
        "taxRate" float NOT NULL
      )
    `);

    for (const table of TABLES) {
      await ensureDateEpoch(queryRunner, table);
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "IDX_${table}_dateEpoch" ON "${table}" ("dateEpoch")`,
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_sale_amendment_dateEpoch"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "sale_amendment"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tax_payment_event_dateEpoch"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "tax_payment_event"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_sale_event_dateEpoch"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sale_event"`);
  }
}

async function ensureDateEpoch(
  queryRunner: QueryRunner,
  table: string,
): Promise<void> {
  const columns = (await queryRunner.query(
    `PRAGMA table_info("${table}")`,
  )) as { name: string }[];
  const hasDateEpoch = columns.some((column) => column.name === 'dateEpoch');
  if (!hasDateEpoch) {
    await queryRunner.query(
      `ALTER TABLE "${table}" ADD COLUMN "dateEpoch" integer NOT NULL DEFAULT 0`,
    );
  }

  const rows = (await queryRunner.query(
    `SELECT "id", "date" FROM "${table}" WHERE "dateEpoch" = 0`,
  )) as { id: number; date: string }[];
  for (const row of rows) {
    const epoch = Date.parse(row.date);
    if (Number.isNaN(epoch)) {
      continue;
    }
    await queryRunner.query(
      `UPDATE "${table}" SET "dateEpoch" = ? WHERE "id" = ?`,
      [epoch, row.id],
    );
  }
}
