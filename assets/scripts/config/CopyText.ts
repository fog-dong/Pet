// STATUS: implemented, W16 P0 玩家可见文案集中表（合规文案不在本表，见 LegalConfig / PrivacyDialog）

export const COPY = {
  bootLoading: '正在打扫诊室…',
  lobbyStart: '街头寻访',
  lobbyNoCase: '病案柜还没整理好，稍后再试一次吧~',
  gachaTitle: '街 头 寻 访',
  gachaSubtitle: '街角的纸箱里，好像有动静…',
  gachaReady: '花点金币或看段广告，去街角找找看~',
  gachaSearch: '点一点纸箱，看看是谁在里头~',
  gachaPay: '寻访一次 · {cost} 金币',
  gachaNoCoins: '金币不够啦，还差 {n} 枚~',
  gachaNoCoinsShort: '金币不足（需 {cost}）',
  gachaAd: '看广告 · 免费寻访一次',
  gachaAdLoading: '广告小助手正在赶来…',
  gachaAdUnavailable: '广告小助手暂时不在，先花 {cost} 金币寻访吧~',
  gachaNew: '新朋友！它正等着你检查身体。',
  gachaDuplicate: '又遇见这个熟悉的小家伙，它留下了谢礼。',
  gachaNewTag: '图鉴已记录 · 第一次遇见',
  gachaReward: '+{coins} 金币　+{hearts} 爱心',
  gachaIntake: '立即接诊',
  gachaAgain: '再寻访一次',
  gachaBack: '先回大厅',
  gachaMissing: '寻访名单还没送到，稍后再试一次吧~',
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
  habitatResting: '毛孩子们还在休息，晚点再来看看吧',
  habitatClaimed: '成功领取 {hours} 小时离线收益，获得 {coins} 金币',
  habitatClaimOffline: '云端还没接通，离线收益稍后再领~',
  habitatClaimFailed: '网络不太稳，离线收益没领到，待会儿再试一次~',
} as const;

/** 仅替换 `{name}` 占位，不做模板引擎。 */
export function fillCopy(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
