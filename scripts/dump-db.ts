import { createRequire } from 'module';
import { existsSync, readFileSync } from 'fs';
import { defaultSqlitePath } from '../src/config/app.config';

const load = createRequire(__filename);

interface QueryExecResult {
  columns: string[];
  values: (number | string | Uint8Array | null)[][];
}

interface SqlDatabase {
  exec(sql: string): QueryExecResult[];
  close(): void;
}

interface SqlJsStatic {
  Database: new (data: Buffer) => SqlDatabase;
}

type InitSqlJs = () => Promise<SqlJsStatic>;

const initSqlJs = load('sql.js') as InitSqlJs;

const TABLES = ['sale_event', 'tax_payment_event', 'sale_amendment'] as const;

function databasePath(): string {
  return process.env.SQLITE_PATH ?? defaultSqlitePath();
}

function rows(db: SqlDatabase, table: string): Record<string, unknown>[] {
  const [result] = db.exec(`SELECT * FROM "${table}"`);
  if (!result) {
    return [];
  }
  return result.values.map((row) =>
    Object.fromEntries(
      result.columns.map((column, index) => [column, row[index]]),
    ),
  );
}

function parseJson(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

async function main(): Promise<void> {
  const path = databasePath();
  if (!existsSync(path)) {
    console.error(
      `No database at ${path}. Run pnpm start:dev and ingest an event first.`,
    );
    process.exitCode = 1;
    return;
  }

  const SQL = await initSqlJs();
  const db = new SQL.Database(readFileSync(path));
  try {
    for (const table of TABLES) {
      const data = rows(db, table).map((row) =>
        Object.fromEntries(
          Object.entries(row).map(([key, value]) => [key, parseJson(value)]),
        ),
      );
      console.log(`\n${table}`);
      if (data.length === 0) {
        console.log('(no rows)');
      } else {
        console.log(JSON.stringify(data, null, 2));
      }
    }
  } finally {
    db.close();
  }
}

void main();
