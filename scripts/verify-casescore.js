// STATUS: implemented, W20-4 模块三 单局评分口径回归（纯函数，不开浏览器）
// 覆盖《W20-核心体验测试用例》M10/M11/M17/M18 里那些「页面上看不出来、错了却直接改钱和门槛」的判定。
// 用法：node --experimental-strip-types --no-warnings scripts/verify-casescore.js
import {
  affectionGain,
  judgeTreatment,
  medicineMatches,
  recoverySeconds,
  recoveryStars,
  rewardAmounts,
  totalStars,
  treatmentStars,
  treatmentThreshold,
} from '../assets/scripts/game/CaseScore.ts';

let failures = 0;

function check(title, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures += 1;
  }
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${title} → ${JSON.stringify(actual)}${ok ? '' : ' 期望 ' + JSON.stringify(expected)}`);
}

const CORRECT = { medicine: '消炎药', bed: '住院', time: '加速' };
const plan = (medicines, bed = CORRECT.bed, time = CORRECT.time) => ({ medicines, bed, time });

console.log('[1] 危急度治疗门槛（05 §3：危重 3/3，普通/紧急 2/3）');
check('treatmentThreshold critical', treatmentThreshold('critical'), 3);
check('treatmentThreshold urgent', treatmentThreshold('urgent'), 2);
check('treatmentThreshold normal', treatmentThreshold('normal'), 2);
check('危重 2/3 判失败（星级 0，不进康复）', treatmentStars(judgeTreatment(plan(['消炎药'], '住院', '正常'), CORRECT), 'critical'), 0);
check('危重 3/3 才给 3 星', treatmentStars(judgeTreatment(plan(['消炎药']), CORRECT), 'critical'), 3);
check('普通 2/3 过门槛给 2 星', treatmentStars(judgeTreatment(plan(['益生菌'], '门诊', '加速'), { medicine: '益生菌', bed: '门诊', time: '正常' }), 'normal'), 2);
check('普通 1/3 仍判失败', treatmentStars(judgeTreatment(plan(['益生菌'], '住院', '加速'), { medicine: '益生菌', bed: '门诊', time: '正常' }), 'normal'), 0);

console.log('\n[2] 药品多选口径（多选≠更高分，用错药 0 分）');
check('只选对症药', medicineMatches(['消炎药'], '消炎药'), true);
check('对症药 + 辅助药 → 0 分', medicineMatches(['消炎药', '止痛药'], '消炎药'), false);
check('漏选', medicineMatches([], '消炎药'), false);
check('选错药', medicineMatches(['强心药'], '消炎药'), false);
check('药对 + 床错 + 时间错 = 1 分', judgeTreatment(plan(['消炎药'], '门诊', '正常'), CORRECT), 1);

console.log('\n[3] 星级 → 奖励（首通金币 ×1.5、爱心不乘）');
check('3 星首通 450 金币', rewardAmounts({ coins: 450, hearts: 3 }, 3, true), { coins: 675, hearts: 3 });
check('3 星二刷 450 金币', rewardAmounts({ coins: 450, hearts: 3 }, 3, false), { coins: 450, hearts: 3 });
check('2 星首通 200→240（0.8×1.5）', rewardAmounts({ coins: 200, hearts: 1 }, 2, true), { coins: 240, hearts: 1 });
check('0 星不铸币', rewardAmounts({ coins: 450, hearts: 3 }, 0, true), { coins: 0, hearts: 0 });
check('康复时长：加速 12 / 正常 20 / 观察 26', [recoverySeconds('加速'), recoverySeconds('正常'), recoverySeconds('观察')], [12, 20, 26]);
check('未知时长回落到 20 秒', recoverySeconds('随便填'), 20);
check('康复星级 0.5 档 3 星', recoveryStars(6000, 12000), 3);
check('康复星级 0.8 档 2 星', recoveryStars(10000, 12000), 2);
check('康复星级超时 1 星', recoveryStars(20000, 12000), 1);

console.log('\n[4] 总星与领养门槛的可达性（06 §2.1 满分 45、门槛 35）');
check('诊断 3 + 治疗 3 = 3 星', totalStars(3, 3, 2), 3);
check('诊断 2 + 治疗 2 + 康复 2 = 2 星', totalStars(2, 2, 2), 2);
check('治疗 0 分不给星', totalStars(3, 0, 3), 0);
check('全对 + 对症 + 护理 = 45（满值）', affectionGain(3, 3, true, true), 45);
check('诊断 3 + 治疗 3 + 对症（不护理）= 40 ≥ 35 可领养', affectionGain(3, 3, true, false) >= 35, true);
check('只做完诊断 1 星 + 治疗 0 分 = 5 < 35 不能领养', affectionGain(1, 0, false, false) < 35, true);
check('最差路径不为负', affectionGain(0, 0, false, false), 0);

console.log(`\n结果：${failures === 0 ? 'CaseScore 口径全部通过' : failures + ' 项失败'}`);
process.exitCode = failures ? 1 : 0;
