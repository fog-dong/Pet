// STATUS: implemented, W16 P0 玩家可见文案集中表（合规文案不在本表，见 LegalConfig / PrivacyDialog）

export const COPY = {
  bootLoading: '正在打扫诊室…',
  lobbyStart: '迎接新病患',
  lobbyNoCase: '病案柜还没整理好，稍后再试一次吧~',
  lobbyGuestCodex: '游客模式下排行榜暂不可用，在「隐私与协议」中同意后即可开启。',
  caseIntroStart: '开始检查',
  resultTitle: '今日救助',
  resultSuccess: '{pet} 又能摇尾巴了',
  resultFail: '这次没帮上忙，休息一下再来',
  resultFirstClear: '第一次救助成功，额外奖励！',
  resultNext: '下一位病患',
  recoveryHome: '带它回家',
  codexEmpty: '图鉴还在整理中~',
  weakNetwork: '📡 信号有点弱，这局记录已经存好啦，稍后会自动同步~',
  pendingSync: '还有 {n} 份病历在路上，马上就到~',
  adUnavailable: '广告小助手暂时不在，先走免费的方式吧~',
} as const;

/** 仅替换 `{name}` 占位，不做模板引擎。 */
export function fillCopy(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
