// STATUS: implemented, W10-2 激励视频广告位集中配置（7 个场景全在此文件）
// API: adUnitId(scene) / isAdConfigured(scene), see docs/plan/11-IAA广告系统.md
// 提审前必须替换：把 AD_UNITS 的 7 个值逐个换成流量主后台创建的真实广告位 ID。
// 占位期间的既有保护：`isAdConfigured()` 判假 → `net/Ad.ts` 直接返回 AD_UNAVAILABLE 不碰 wx 接口，
// `net/AdGateway.ts` 对未配置场景不发奖、不消耗当日次数（占位时不降级发奖）。
// 不要为了「让广告看起来能跑」填一个假 ID：占位 ID 调真实接口只会报错，且会绕过上面的保护。

/** 微信后台创建激励视频广告位后，把下面的占位值逐个替换；业务层不得硬编码广告位 ID。 */
export const AD_UNIT_PLACEHOLDER = 'AD_UNIT_PLACEHOLDER';

const AD_UNITS: Readonly<Record<string, string>> = {
  extra_check: AD_UNIT_PLACEHOLDER,
  extra_inspection: AD_UNIT_PLACEHOLDER,
  accelerate: AD_UNIT_PLACEHOLDER,
  double_reward: AD_UNIT_PLACEHOLDER,
  free_slot: AD_UNIT_PLACEHOLDER,
  extra_medicine: AD_UNIT_PLACEHOLDER,
  extra_bed: AD_UNIT_PLACEHOLDER,
};

/** 场景 → 广告位 ID；未登记的场景返回空串，由 AdClient 视为不可用。 */
export function adUnitId(scene: string): string {
  return AD_UNITS[scene] ?? '';
}

export function isAdConfigured(scene: string): boolean {
  const id = adUnitId(scene);
  return id.length > 0 && id !== AD_UNIT_PLACEHOLDER;
}

/**
 * 已配置真实广告位时，加载失败是否按一次奖励降级发放。
 * 占位 ID 永远不降级，避免提审前“没看广告也发奖”；需要关闭降级时改为 false。
 */
export const AD_DEGRADE_ENABLED = true;

export const AD_SCENES: readonly string[] = Object.keys(AD_UNITS);
