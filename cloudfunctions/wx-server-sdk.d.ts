// STATUS: scaffold, API frozen by architect on 2026-10-29
// 仅声明云函数实际用到的最小接口；官方类型可用后整体替换。

declare module 'wx-server-sdk' {
  export const DYNAMIC_CURRENT_ENV: string;

  export interface WxContext {
    OPENID?: string;
    APPID?: string;
    UNIONID?: string;
  }

  export interface QueryResult<T> {
    data: T[];
  }

  export interface UpdateResult {
    stats: { updated: number };
  }

  export interface Query<T> {
    where(condition: Record<string, unknown>): Query<T>;
    orderBy(field: string, direction: 'asc' | 'desc'): Query<T>;
    skip(count: number): Query<T>;
    limit(count: number): Query<T>;
    get(): Promise<QueryResult<T>>;
    count(): Promise<{ total: number }>;
    update(options: { data: Record<string, unknown> }): Promise<UpdateResult>;
  }

  export interface RemoveResult {
    stats: { removed: number };
  }

  export interface DocumentRef<T> {
    get(): Promise<{ data: T | null }>;
    set(options: { data: Record<string, unknown> }): Promise<UpdateResult>;
    update(options: { data: Record<string, unknown> }): Promise<UpdateResult>;
    remove(): Promise<RemoveResult>;
  }

  export interface Collection<T> extends Query<T> {
    doc(id: string): DocumentRef<T>;
    add(options: { data: Record<string, unknown> }): Promise<{ _id: string }>;
  }

  export interface TransactionDocumentRef<T> {
    get(): Promise<{ data: T | null }>;
    set(options: { data: Record<string, unknown> }): Promise<void>;
    update(options: { data: Record<string, unknown> }): Promise<void>;
  }

  export interface Transaction {
    collection<T = Record<string, unknown>>(name: string): {
      doc(id: string): TransactionDocumentRef<T>;
    };
  }

  export interface Command {
    gt(value: unknown): unknown;
    gte(value: unknown): unknown;
    lt(value: unknown): unknown;
    inc(value: number): unknown;
  }

  export interface Database {
    collection<T = Record<string, unknown>>(name: string): Collection<T>;
    command: Command;
    runTransaction<R>(handler: (transaction: Transaction) => Promise<R>): Promise<R>;
  }

  export function init(options?: { env?: string }): void;
  export function getWXContext(): WxContext;
  export function database(options?: { throwOnNotFound?: boolean }): Database;
}
