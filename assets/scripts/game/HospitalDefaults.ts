// STATUS: implemented, W25 P2-D 医院常量（从 Hospital 抽出，压住 150 行红线；数值口径不变）
/** 每种药首次遇到时补 3 个（05 文档 §9 初值）；每日补给在 P2 任务系统里做。 */
export const DEFAULT_MEDICINE_STOCK = 3;
/** 领养位基础数量，扩建或广告/好友可加成。 */
export const ADOPTION_BASE_SLOTS = 3;
/**
 * 领养好感门槛（06 §3.1 的 120 按单局折算为 35）：一局满分 45（诊断 15 + 治疗 20 + 对症 5 + 护理 5），
 * 低于满分就要靠分享/助力补 5，或再遇到同一只宠物累积。
 */
export const AFFECTION_THRESHOLD = 35;
