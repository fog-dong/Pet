// STATUS: scaffold, API frozen by architect on 2026-10-29
// 云函数运行时为 Node，但仓库不引入 @types/node；此处只声明实际用到的最小接口。

declare module 'crypto' {
  interface Hmac {
    update(data: string): Hmac;
    digest(encoding: 'hex'): string;
  }

  export function createHmac(algorithm: 'sha256', key: string): Hmac;
}
