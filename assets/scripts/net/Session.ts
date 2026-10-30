// STATUS: implemented, W5 会话令牌（仅内存，不落盘）
// 说明：token 只用于领养/排行榜等需要会话的入口；单局不依赖 token。
let token = '';

export const Session = {
  get token(): string {
    return token;
  },
  get hasToken(): boolean {
    return token.length > 0;
  },
  set(value: string): void {
    token = typeof value === 'string' ? value : '';
  },
  clear(): void {
    token = '';
  },
};
