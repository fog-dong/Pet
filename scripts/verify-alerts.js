// STATUS: implemented, W27 P3-UI 模块三 红点信号纯函数回归（成熟判据 / 审核到点 / 不亮档位 / 负数收口）
// 用法：node --experimental-strip-types --no-warnings --import ./scripts/ts-resolve.mjs scripts/verify-alerts.js
import {
  NEED_CARE,
  countGardenReady,
  countRehomeReady,
  lobbyAlerts,
} from '../assets/scripts/game/LobbyAlerts.ts';

let failures = 0;

function check(title, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures += 1;
  }
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${title} → ${JSON.stringify(actual)}${ok ? '' : ' 期望 ' + JSON.stringify(expected)}`);
}

const T = 1_000_000;
const plot = (cropId, readyAt) => ({ cropId, readyAt });

// 一、后院：空地不计；到点（含恰好等于 now）计入；未到期不计。
check('后院 空地块', countGardenReady([plot('', 0), plot('', T - 1)], T), 0);
check('后院 恰好到点', countGardenReady([plot('mint', T)], T), 1);
check('后院 还在长', countGardenReady([plot('mint', T + 1)], T), 0);
check('后院 混合三块', countGardenReady([plot('mint', T - 5), plot('basil', T + 5), plot('', 0)], T), 1);
check('后院 零地块', countGardenReady([], T), 0);

// 二、送养：没提交永远 0；到点才算 1（同时间只允许一只，因此上限就是 1）。
check('送养 无审核件', countRehomeReady(null, T), 0);
check('送养 未到点', countRehomeReady({ readyAt: T + 60_000 }, T), 0);
check('送养 恰好到点', countRehomeReady({ readyAt: T }, T), 1);
check('送养 逾期未领', countRehomeReady({ readyAt: T - 60_000 }, T), 1);

// 三、TAB 落位：诊疗没有累积待收对象，任何输入都不许亮。
check('落位 全零', lobbyAlerts({ claimable: 0, gardenReady: 0, rehomeReady: 0 }), {
  clinic: 0,
  garden: 0,
  habitat: 0,
  achieve: 0,
});
check('落位 三项都有', lobbyAlerts({ claimable: 3, gardenReady: 2, rehomeReady: 1 }), {
  clinic: 0,
  garden: 2,
  habitat: 1,
  achieve: 3,
});
check('落位 诊疗不亮', lobbyAlerts({ claimable: 9, gardenReady: 9, rehomeReady: 9 }).clinic, 0);
check('落位 负数收口', lobbyAlerts({ claimable: -4, gardenReady: -2, rehomeReady: -1 }), {
  clinic: 0,
  garden: 0,
  habitat: 0,
  achieve: 0,
});

// 四、照护线：与小屋坞内「待照顾」共用同一档，只用于文案，不进红点。
check('照护线 数值', NEED_CARE, 30);

console.log(failures === 0 ? '\nALL PASS 红点信号 14 项' : `\n${failures} 项不符合预期`);
process.exit(failures === 0 ? 0 : 1);
