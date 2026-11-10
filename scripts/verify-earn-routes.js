// STATUS: implemented, W27 P3-UI 模块三 资源不足获取指引纯函数回归（优先级 / 爱心不看感谢金 / 负数与小数收口 / 不指付费入口）
// 用法：node --experimental-strip-types --no-warnings --import ./scripts/ts-resolve.mjs scripts/verify-earn-routes.js
import { earnRoute } from '../assets/scripts/game/EarnRoutes.ts';

let failures = 0;

function check(title, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures += 1;
  }
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${title} → ${JSON.stringify(actual)}${ok ? '' : ' 期望 ' + JSON.stringify(expected)}`);
}

function includes(title, text, needle) {
  const ok = typeof text === 'string' && text.includes(needle);
  if (!ok) {
    failures += 1;
  }
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${title} → ${JSON.stringify(text)}${ok ? '' : ' 缺 ' + JSON.stringify(needle)}`);
}

// 一、当场能领的排第一：可领成就数直接写进文案，玩家不必再猜有几档。
const coinsFirst = earnRoute('coins', { claimable: 4, rehomeReady: 1 });
check('优先级 可领成就压过送养', coinsFirst.tab, 'achieve');
includes('文案 带上可领数', coinsFirst.text, '4 档');

// 二、没有可领成就、但送养到点：金币走小屋感谢金。
const coinsRehome = earnRoute('coins', { claimable: 0, rehomeReady: 1 });
check('金币 送养到点落小屋', coinsRehome.tab, 'habitat');
includes('金币 感谢金口径', coinsRehome.text, '感谢金');

// 三、爱心不能指给送养：感谢金只发金币，指过去玩家领完还是缺爱心。
const heartsRehome = earnRoute('hearts', { claimable: 0, rehomeReady: 1 });
check('爱心 不指送养', heartsRehome.tab, 'clinic');
includes('爱心 文案口径', heartsRehome.text, '爱心');

// 四、兜底回主产出线：两头都没得领时，指向诊疗接诊（金币与爱心都在结算里发）。
const fallback = earnRoute('hearts', { claimable: 0, rehomeReady: 0 });
check('兜底 落诊疗', fallback.tab, 'clinic');
includes('兜底 说明发到哪', fallback.text, '接诊病例结算就发');

// 五、脏输入收口：负数与小数不允许出现「-3 档」「1.5 档」这种文案。
check('收口 负数当零', earnRoute('coins', { claimable: -2, rehomeReady: -1 }).tab, 'clinic');
check('收口 小数向下取整', earnRoute('coins', { claimable: 4.7, rehomeReady: 0 }).tab, 'achieve');
includes('收口 文案无小数', earnRoute('coins', { claimable: 4.7, rehomeReady: 0 }).text, '4 档');

// 六、W28 P1-1 药剂：只有后院合成一条路，成就发的是金币和爱心，指过去领完还是没药。
const medicine = earnRoute('medicine', { claimable: 4, rehomeReady: 2 });
check('药剂 不看可领成就', medicine.tab, 'garden');
includes('药剂 文案指后院', medicine.text, '后院');
check('药剂 文案装得进 330 卡片', medicine.text.length <= 13, true);

// 七、红线：任何一条路线都不许把玩家支到广告或付费入口。
const all = [coinsFirst, coinsRehome, heartsRehome, fallback, medicine].map((route) => route.text).join('|');
for (const word of ['看广告', '充值', '购买', '支付']) {
  const ok = !all.includes(word);
  if (!ok) {
    failures += 1;
  }
  console.log(`${ok ? 'OK  ' : 'FAIL'} 红线 指引文案不含「${word}」`);
}

console.log(failures === 0 ? '\nALL PASS 获取指引 18 项' : `\n${failures} 项不符合预期`);
process.exit(failures === 0 ? 0 : 1);
