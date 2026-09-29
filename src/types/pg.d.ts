declare module "pg" {
  type QueryResult<T = Record<string, unknown>> = { rows: T[] };

  export class Pool {
    constructor(config?: {
      connectionString?: string;
      max?: number;
      connectionTimeoutMillis?: number;
      idleTimeoutMillis?: number;
    });
    query<T = Record<string, unknown>>(
      text: string,
      values?: unknown[],
    ): Promise<QueryResult<T>>;
    connect(): Promise<PoolClient>;
  }

  export class PoolClient {
    query<T = Record<string, unknown>>(
      text: string,
      values?: unknown[],
    ): Promise<QueryResult<T>>;
    release(): void;
  }
}
