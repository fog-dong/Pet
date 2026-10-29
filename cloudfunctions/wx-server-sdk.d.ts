// STATUS: scaffold, API frozen by architect on 2026-10-29
// Minimal type surface for wx-server-sdk; replace with official types when available.

declare module 'wx-server-sdk' {
  export const DYNAMIC_CURRENT_ENV: string;

  export interface WxContext {
    OPENID?: string;
    APPID?: string;
    UNIONID?: string;
  }

  export function init(options?: { env?: string }): void;
  export function getWXContext(): WxContext;
  export function database(): unknown;
}
