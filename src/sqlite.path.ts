import { mkdirSync } from 'fs';
import { dirname } from 'path';

export function ensureSqliteDirectory(database: string): void {
  if (database === ':memory:') {
    return;
  }
  mkdirSync(dirname(database), { recursive: true });
}
