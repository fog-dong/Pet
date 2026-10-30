// STATUS: implemented, W8-5 隐私与协议文案入口（URL 为占位，提审前必须替换为真实 H5）
// 口径来源：docs/plan/15-性能优化发布与合规检查.md §6「隐私：最小采集、告知同意、可注销」

/** 协议文本版本；文案或采集范围变更后必须递增，触发重新弹窗。 */
export const LEGAL_VERSION = '1.0.0';

export interface LegalDoc {
  readonly id: string;
  readonly title: string;
  /** 占位为空串：发布流程替换为运营提供的真实 H5，禁止硬编码第三方地址。 */
  readonly url: string;
  readonly points: readonly string[];
}

export const LEGAL_DOCS: readonly LegalDoc[] = [
  {
    id: 'privacy',
    title: '隐私政策',
    url: '',
    points: [
      '登录时仅读取微信分配的唯一标识（openid），用于保存你的诊所进度与排行榜名次。',
      '存档内容：金币、爱心、病例进度、图鉴与领养记录、道具与床位。',
      '广告与埋点只记录事件名、场景、完成与否与时间戳，不采集手机号、位置、相册与通讯录。',
      '你可以在微信「设置-小程序与小游戏-权限」中撤回授权；注销后云端存档将被清除。',
    ],
  },
  {
    id: 'agreement',
    title: '用户协议',
    url: '',
    points: [
      '游戏为虚拟体验，病例与诊疗均为虚构内容，不构成任何真实医疗或兽医建议。',
      '禁止使用外挂或刷取排行榜；违规成绩可能被清除。',
      '虚拟物品与金币仅限本小游戏内使用，不支持转让与提现。',
    ],
  },
  {
    id: 'minors',
    title: '未成年人保护说明',
    url: '',
    points: [
      '本作不含暴力、恐怖与不良引导内容，宠物诊疗以照护与科普为主。',
      '未成年人需在监护人同意与陪同下使用；单日广告观看次数受服务端上限约束。',
      'iOS 端不提供虚拟商品支付，仅保留免费玩法。',
    ],
  },
];

/** 未勾选时同意按钮置灰，用同一句文案解释为什么点不动。 */
export const PRIVACY_CHECK_TEXT = '我已阅读并同意以上协议';
export const PRIVACY_DECLINE_TITLE = '你可以先看看协议内容';
export const PRIVACY_DECLINE_TEXT =
  '未同意隐私政策前无法进入诊所，游戏不会上传任何数据。你可以重新阅读协议，随时回来点「同意并进入」。';

/** 三个 URL 全部就位才算配置完成，用于提审前自检。 */
export function legalUrlsReady(): boolean {
  return LEGAL_DOCS.every((doc) => doc.url.startsWith('https://'));
}
