// STATUS: implemented, W7 激励视频广告位集中配置（占位 ID，提审前必须替换为真实广告位）
// API: adUnitId(scene) / isAdConfigured(scene), see docs/plan/11-IAA广告系统.md

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

export const AD_SCENES: readonly string[] = Object.keys(AD_UNITS);
