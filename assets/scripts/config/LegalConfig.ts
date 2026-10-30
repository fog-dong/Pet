// STATUS: implemented, W10-2 提审材料文案与 URL 入口（协议 URL / 医疗免责 / 适龄 / 客服全在此文件，提审前只改这里）
// 口径来源：docs/plan/15-性能优化发布与合规检查.md §6「隐私：最小采集、告知同意、可注销」
// 提审前必须替换：三个协议 H5 与客服 URL 现在是 example.com 合法占位，只用于「改一处就能换」；
// 自检函数把占位域名判为「未配置」，所以占位状态下不会出现「点开打不开的协议」或误调客服接口。

/** 合法占位域名：真实 H5 就绪后整段替换，替换后 `legalUrlsReady()` / `customerServiceReady()` 自动翻真。 */
export const PLACEHOLDER_HOST = 'example.com';
/** 占位 URL 前缀；替换时把整段换成运营提供的真实 H5 域名即可。 */
export const PLACEHOLDER_URL_PREFIX = `https://${PLACEHOLDER_HOST}`;

/** 协议文本版本；文案或采集范围变更后必须递增，触发重新弹窗。 */
export const LEGAL_VERSION = '1.0.0';

export interface LegalDoc {
  readonly id: string;
  readonly title: string;
  /** 占位用 `PLACEHOLDER_HOST`：发布流程替换为运营提供的真实 H5，禁止硬编码第三方地址。 */
  readonly url: string;
  readonly points: readonly string[];
}

export const LEGAL_DOCS: readonly LegalDoc[] = [
  {
    id: 'privacy',
    title: '隐私政策',
    url: `${PLACEHOLDER_URL_PREFIX}/privacy`,
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
    url: `${PLACEHOLDER_URL_PREFIX}/agreement`,
    points: [
      '游戏为虚拟体验，病例与诊疗均为虚构内容，不构成任何真实医疗或兽医建议。',
      '禁止使用外挂或刷取排行榜；违规成绩可能被清除。',
      '虚拟物品与金币仅限本小游戏内使用，不支持转让与提现。',
    ],
  },
  {
    id: 'minors',
    title: '未成年人保护说明',
    url: `${PLACEHOLDER_URL_PREFIX}/minors`,
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

/** 游客模式说明：不同意也不退出游戏，只是关掉云端能力，本地单局照玩。 */
export const PRIVACY_GUEST_TEXT =
  '需要同意隐私政策才能使用云端存档和排行榜，你仍可以以游客模式体验基础病例。';

/** 常驻授权条目：未同意时是升级入口，已同意后变成只读入口（大厅与关于面板共用）。 */
export const PRIVACY_ENTRY_TODO = '同意隐私政策以启用云端存档和排行榜';
export const PRIVACY_ENTRY_DONE = '已同意，可查看隐私政策';

/** 补同意后的一次性提示：云环境未配置时按本地存档说明，避免误报已同步。 */
export const PRIVACY_UPGRADED_TEXT = '已同意隐私政策，云端存档与排行榜已启用。';
export const PRIVACY_UPGRADED_OFFLINE_TEXT = '已同意隐私政策；云环境未配置，暂时仍用本地存档。';
/** 游客当场升级时的过场文案：等 login + 本地补发结束后再落到上面两条。 */
export const PRIVACY_SYNCING_TEXT = '正在同步本地结算…';

/** 医疗虚构免责固定句：与《提审检查清单》§2 口径逐字一致，场景内不得硬编码。 */
export const MEDICAL_DISCLAIMER_TEXT =
  '本游戏为虚构的宠物医院模拟玩法，所有诊断、用药与治疗均为游戏设定，不构成任何医疗或兽医建议。';

/**
 * 游戏正式名称唯一数据源：必须与公众平台备案名逐字一致。
 * 启动页首图需同时展示「忠告 + 适龄 + 名称」，改名只改这一处并重建截图。
 */
export const GAME_NAME = '萌宠诊所日记';

/**
 * 适龄等级唯一数据源：必须与微信公众平台「适龄提示」设置同一数值。
 * 自绘行只复用此常量、不模仿平台图标样式，避免两个不同样式的标识造成混淆。
 */
export const AGE_RATING = '8+';

/** 适龄提示 + 健康游戏忠告全文：启动页底部常驻，提审口径按平台要求整体展示。 */
export const AGE_RATING_TEXT = `适龄提示：${AGE_RATING}`;
export const HEALTH_GAME_NOTICE_TEXT =
  '抵制不良游戏，拒绝盗版游戏。注意自我保护，谨防受骗上当。适度游戏益脑，沉迷游戏伤身。合理安排时间，享受健康生活。';

export interface CustomerServiceConfig {
  /** 占位用 `PLACEHOLDER_HOST`：运营在公众平台开通微信客服后填入官方下发的会话 URL。 */
  readonly url: string;
  /** 平台要求携带的来源场景描述。 */
  readonly scene: string;
  /** 未配置或调用失败时的兜底说明，保证不崩、不静默。 */
  readonly fallbackText: string;
}

export const CUSTOMER_SERVICE: CustomerServiceConfig = {
  url: `${PLACEHOLDER_URL_PREFIX}/customer-service`,
  scene: '宠物医院小游戏-关于面板',
  fallbackText: '客服系统配置中，可通过公众号留言反馈。',
};

/** 占位值一律按「未配置」处理，避免提审前误以为链路已通。 */
function isRealUrl(url: string): boolean {
  return url.startsWith('https://') && !url.includes(PLACEHOLDER_HOST);
}

/** 客服会话是否已配置真实 URL（提审前自检用）。 */
export function customerServiceReady(): boolean {
  return isRealUrl(CUSTOMER_SERVICE.url);
}

/** 三个 URL 全部就位才算配置完成，用于提审前自检。 */
export function legalUrlsReady(): boolean {
  return LEGAL_DOCS.every((doc) => isRealUrl(doc.url));
}
