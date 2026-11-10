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
  /** P2-A2 危重倒计时：红条只在本局诊断/治疗页出现，归零即转院。 */
  crisisRunning: '危重抢救 · 剩 {seconds}s',
  crisisPaused: '危重抢救 · 已暂停（回到游戏继续倒计时）',
  resultTransfer: '{pet} 病情恶化，已被转去上级医院',
  transferSummary: '退回 {refunded} 份药品，爱心 −{hearts}',
  /** P2-A3 口碑差评：只在真扣到分时追加，0 口碑的新医院不会被扣成负数。 */
  transferReputation: '口碑 −{reputation}',
  recoveryHome: '带它回家',
  codexEmpty: '图鉴还在整理中~',
  weakNetwork: '📡 信号有点弱，这局记录已经存好啦，稍后会自动同步~',
  pendingSync: '还有 {n} 份病历在路上，马上就到~',
  adUnavailable: '广告小助手暂时不在，先走免费的方式吧~',
  habitatResting: '毛孩子们还在休息，晚点再来看看吧',
  habitatClaimed: '成功领取 {hours} 小时离线收益，获得 {coins} 金币',
  habitatClaimOffline: '云端还没接通，离线收益稍后再领~',
  habitatClaimFailed: '网络不太稳，离线收益没领到，待会儿再试一次~',
  habitatThemeTitle: '装 修 小 屋',
  habitatThemeEntry: '装 修',
  habitatThemeUsing: '使用中',
  habitatThemeUse: '使 用',
  habitatThemeBuy: '{cost} 金币',
  /** W28 P1-3：买不起的档位在按钮上直接写差额，不用点了确认弹窗才知道钱不够。 */
  habitatThemeShort: '差 {cost} 金币',
  habitatThemeApplied: '小屋已换成「{name}」',
  habitatThemeConfirm: '买下「{name}」？',
  habitatThemeConfirmYes: '花 {cost} 金币买下',
  habitatThemeConfirmNo: '再想想',
  habitatThemeNoCoins: '金币不足（需 {cost}）',
  /** P2-B2 称号阶梯：按「三档全领满的成就组数」进一阶，索引 0 = 一组都没领满。 */
  achievementTitles: ['实习医生', '住院医师', '主治医师', '主任医师', '院长', '妙手名医', '华佗再世'],
  achievementTitle: '成 就 谱',
  /** 里程碑专名缺失时的回落档位名，见 MILESTONE_NAMES。 */
  achievementTierNames: ['一档', '二档', '三档'],
  achievementEntry: '称号 · {title}',
  achievementEntryBadge: '称号·{title} 可领{n}',
  achievementGroupsDone: '已领满 {done}/{total} 组',
  achievementProgress: '{value} / {need}',
  achievementNext: '下一档 {need} 次 · {reward}',
  achievementNextOnly: '下一档 {need} 次',
  achievementAllClaimed: '三档已领满',
  achievementClaim: '领 取',
  achievementClaimed: '已 领',
  achievementTierName: '{name} · {n}',
  achievementRewardCoins: '+{coins} 金币',
  achievementRewardHearts: '+{hearts} 爱心',
  achievementRewardTicket: '+{n} 张稀有券',
  achievementClaimToast: '领取成功：{reward}',
  achievementAlready: '这档奖励已经领过啦',
  achievementLockedToast: '还没达成，继续加油~',
  milestoneTitle: '达 成 成 就',
  milestoneGo: '去 领 取',
  milestoneLater: '稍 后 再 看',
  milestoneOk: '知 道 了',
  achievementClaimTitle: '领 取 成 功',
  milestoneHint: '新达成 {n} 个成就，奖励要点一下才入账~',
  /** P2-B2 盲盒券：券只从成就产出，用券时只在稀有与传说两档里抽。 */
  ticketEntry: '稀有券 ×{n}',
  gachaNoTicket: '稀有券不够啦，完成成就就能攒到~',
  gachaTicketHint: '用稀有券寻访：只可能遇见稀有或传说',
  /** 点宠物时随机一条，语气统一为「被照顾者的口头禅」，不用感叹号堆情绪。 */
  healBubbleLines: [
    '今天也要加油鸭~',
    '谢谢你带我回家',
    '摸摸头，我最喜欢你了',
    '有你在，我一点都不疼了',
    '尾巴摇成小风扇啦',
    '今天也是被宠爱的一天',
    '想和你一起晒太阳',
    '你身上有让人安心的味道',
    '我等你好久啦',
    '轻轻摸，我会乖乖的',
    '梦见我们一起去公园了',
    '这里就是我的家呀',
  ],
} as const;

/**
 * P3-UI 里程碑专名：替掉「一档 / 二档 / 三档」，每组三名按进度递进，读起来是身份而不是计数。
 * COPY 是 `as const`，按 groupId 索引需要显式类型标注，因此与 COPY 分开声明。
 * 组内只有三名：新增第四档的组会让 milestoneName 回落「N 档」，不会崩但会掉质感。
 */
export const MILESTONE_NAMES: Record<string, readonly string[]> = {
  medic: ['实习兽医', '初掌药柜', '妙手仁心'],
  grower: ['初翻泥土', '满畦新绿', '一方药田'],
  guardian: ['新手上手', '细致打理', '护理名家'],
  homework: ['临时铲屎官', '金牌领航员', '温暖中转站'],
  seeker: ['街角探路', '熟门熟路', '百事通'],
  repute: ['小有名气', '有口皆碑', '名医风范'],
};

/** 仅替换 `{name}` 占位，不做模板引擎。 */
export function fillCopy(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
