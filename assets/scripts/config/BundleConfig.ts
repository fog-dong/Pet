// STATUS: implemented, W16 P0 分包归属与加载超时（唯一口径，业务不再各写各的）
// 分包归属依据 00 §5 包体预算：cases / art / ui 走小游戏分包，主包只放脚本与首屏必要资源。

export const CASES_BUNDLE = 'cases';
export const ART_BUNDLE = 'art';
export const UI_BUNDLE = 'ui';

/** 首屏分包加载预算：超时后改用内置兜底，避免低端机卡在启动页。 */
export const BUNDLE_TIMEOUT_MS = 2500;
