// STATUS: implemented, W7 病例会话 ID（UUID v4 形式，作为 syncCaseResult 幂等键）
function randomHex(length: number): string {
  let text = '';
  while (text.length < length) {
    text += Math.floor(Math.random() * 16).toString(16);
  }
  return text;
}

export function newSessionId(): string {
  const variant = (8 + Math.floor(Math.random() * 4)).toString(16);
  return `${randomHex(8)}-${randomHex(4)}-4${randomHex(3)}-${variant}${randomHex(3)}-${randomHex(12)}`;
}
