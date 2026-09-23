import { registerAs } from '@nestjs/config';
import { join } from 'path';

export const DEFAULT_PORT = 8080;
export const DEFAULT_HOST = '127.0.0.1';

export type CorsOrigin = boolean | string | string[];

export interface AppSettings {
  port: number;
  host: string;
  sqlitePath: string;
  corsOrigin: CorsOrigin | false;
  requestLogging: boolean;
}

export function defaultSqlitePath(): string {
  return join(process.cwd(), 'data', 'events.sqlite');
}

export function parseCorsOrigin(raw: string | undefined): CorsOrigin | false {
  if (raw === undefined || raw === '' || raw === 'false') {
    return false;
  }
  if (raw === '*') {
    return true;
  }
  const origins = raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  if (origins.length === 0) {
    return false;
  }
  return origins.length === 1 ? origins[0]! : origins;
}

export function loadAppSettings(
  env: NodeJS.ProcessEnv = process.env,
): AppSettings {
  const port = Number.parseInt(env.PORT ?? String(DEFAULT_PORT), 10);
  return {
    port: Number.isNaN(port) ? DEFAULT_PORT : port,
    host: env.HOST ?? DEFAULT_HOST,
    sqlitePath: env.SQLITE_PATH ?? defaultSqlitePath(),
    corsOrigin: parseCorsOrigin(env.CORS_ORIGIN),
    requestLogging: env.REQUEST_LOGGING !== 'false',
  };
}

export default registerAs('app', (): AppSettings => loadAppSettings());
