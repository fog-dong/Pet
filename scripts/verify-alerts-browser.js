// STATUS: implemented, W27 P3-UI 模块三 大厅红点验收（CDP 驱动 web-mobile 构建；只读本地存档，不碰线上）
// 覆盖：三枚 TAB 红点亮起与诊疗不亮、红点数字与坞内摘要/称号条一致、
// 领一档成就后成就红点减一、收一块成熟作物后后院红点熄灭、
// 送养未到点不亮与到点后重进即亮（墙钟事件由 30 秒定时兜住）。
// 前置：本地起 web-mobile 构建静态服务 + headless Chrome 开 CDP 端口。
// 用法：node scripts/verify-alerts-browser.js <CDP端口> <站点端口> <截图前缀>
'use strict';

const fs = require('fs');

const CDP_PORT = Number(process.argv[2] || 9455);
const PORT = Number(process.argv[3] || 8099);
const OUT = process.argv[4] || 'w27dot';
const SHOT_DIR = process.env.SHOT_DIR || 'build';
fs.mkdirSync(SHOT_DIR, { recursive: true });
const W = 720;
const H = 1280;
const SITE = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
function judge(id, title, pass, detail) {
  results.push({ id, title, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} [${id}] ${title}${detail ? ' → ' + detail : ''}`);
}

function report(forced) {
  const failed = results.filter((r) => !r.pass);
  console.log(`\n合计 ${results.length} 条判定，PASS ${results.length - failed.length} / FAIL ${failed.length}`);
  failed.forEach((f) => console.log(`  FAIL ${f.id} ${f.title} → ${f.detail}`));
  process.exitCode = failed.length || forced ? 1 : 0;
}

async function findTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page' && t.url.includes(String(PORT)));
      if (page && page.webSocketDebuggerUrl) return page;
    } catch (e) {
      // Chrome 还没起来：继续轮询。
    }
    await sleep(500);
  }
  throw new Error('CDP target not found');
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const pending = new Map();
    const handlers = new Map();
    let nextId = 1;
    ws.onopen = () =>
      resolve({
        call(method, params) {
          return new Promise((res, rej) => {
            const id = nextId++;
            pending.set(id, { res, rej });
            ws.send(JSON.stringify({ id, method, params: params || {} }));
          });
        },
        on(method, handler) {
          handlers.set(method, handler);
        },
        close: () => ws.close(),
      });
    ws.onerror = reject;
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method && handlers.has(msg.method)) handlers.get(msg.method)(msg.params);
      if (!msg.id || !pending.has(msg.id)) return;
      const { res, rej } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
    };
  });
}

const BOOT_SCRIPT = `(() => {
  const reply = (name) => {
    if (name === 'login') return { code: 0, msg: 'ok', data: { token: 'mock-token', isNewUser: false, serverTime: Date.now(), minVersion: '0.1.0' } };
    if (name === 'getConfig') return { code: 0, msg: 'ok', data: { version: 1, configs: {}, forceUpdate: false, minVersion: '0.1.0' } };
    return { code: 0, msg: 'ok', data: null, serverTime: Date.now() };
  };
  window.wx = {
    cloud: {
      init(opt) { window.__init = opt; },
      callFunction(opt) { return Promise.resolve({ result: reply(opt.name) }); },
    },
  };
})()`;

const FIND = `(nm) => { const find = (n) => { if (n.name === nm) return n; for (const c of n.children) { const r = find(c); if (r) return r; } return null; }; const s = cc.director.getScene(); return s ? find(s) : null; }`;
const SCENE = `(() => { const s = window.cc && cc.director.getScene(); return s ? s.name : 'none'; })()`;

/**
 * 种子：悬壶两档 + 口碑两档 + 躬耕一档 + 送家一档 = 可领 6（与成就验收脚本同一套口径）；
 * 后院两块地，plot0 薄荷已成熟、plot1 洋甘菊还在长 → 后院红点应为 1；
 * 送养审核 readyAt 由 boot(rehomeOffset) 注入：负值=已到点（小屋亮 1），正值=还在审（小屋不亮）。
 */
function seedSave(rehomeOffsetMs) {
  const now = Date.now();
  return JSON.stringify({
    coins: 1200,
    hearts: 4,
    petsSeen: ['pet_orange_cat'],
    petsAdopted: ['pet_orange_cat'],
    adoptedAt: { pet_orange_cat: '2026-11-01' },
    habitat: [
      {
        petId: 'pet_orange_cat',
        hunger: 70,
        cleanliness: 70,
        mood: 70,
        birthTimestamp: now - 86400000,
        lastDecayAt: now,
        soothedDay: '',
      },
    ],
    habitatLastClaimAt: now,
    bestStars: {},
    casesDone: 25,
    items: {},
    medicines: {},
    hospitalLevel: 1,
    bedsOccupied: 0,
    affection: { pet_orange_cat: 20 },
    slotBonus: 0,
    adDay: '',
    adCounts: {},
    pettedDay: '',
    pettedCount: 0,
    reputation: 320,
    counters: { gardenPlanted: 4, nailCare: 0, rehomeCount: 1, gachaDraws: 0 },
    achievementsClaimed: [],
    garden: [
      { index: 0, cropId: 'mint', plantedAt: now - 130 * 60000, readyAt: now - 60000, waterDay: '', waterCount: 0 },
      { index: 1, cropId: 'chamomile', plantedAt: now, readyAt: now + 150 * 60000, waterDay: '', waterCount: 0 },
    ],
    gardenStamp: 0,
    gardenQuota: { day: '', harvest: 0, craft: 0 },
    careQuota: { day: '', nail: 0, deworm: 0 },
    rehome: { rehomed: [], review: { petId: 'pet_orange_cat', readyAt: now + rehomeOffsetMs, rate: 0.9 } },
  });
}

(async () => {
  const cdp = await connect((await findTarget()).webSocketDebuggerUrl);
  await cdp.call('Page.enable');
  await cdp.call('Runtime.enable');
  await cdp.call('Network.enable');
  await cdp.call('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.call('Emulation.setDeviceMetricsOverride', {
    width: W,
    height: H,
    deviceScaleFactor: 2,
    mobile: true,
    screenWidth: W,
    screenHeight: H,
  });
  await cdp.call('Page.addScriptToEvaluateOnNewDocument', { source: BOOT_SCRIPT });

  const errors = [];
  cdp.on('Runtime.exceptionThrown', (p) => {
    const d = (p.exceptionDetails || {}).exception || {};
    errors.push(String(d.description || '?').slice(0, 200));
  });

  const ev = (expr) =>
    cdp.call('Runtime.evaluate', { expression: expr, returnByValue: true }).then((r) => {
      if (r.exceptionDetails) {
        const d = r.exceptionDetails.exception || {};
        throw new Error(`页内表达式报错：${String(d.description || r.exceptionDetails.text).split('\n')[0]}`);
      }
      return r.result ? r.result.value : undefined;
    });
  const has = (nm) => ev(`!!(${FIND})('${nm}')`);
  const waitFor = async (nm, ms = 25000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (await has(nm)) return true;
      await sleep(150);
    }
    return false;
  };
  const click = (nm) => ev(`(() => { const n = (${FIND})('${nm}'); if (!n) return 0; n.emit('click'); return 1; })()`);
  const label = (nm) => ev(`(() => { const n = (${FIND})('${nm}'); const c = n && n.getComponent('cc.Label'); return c ? c.string : null; })()`);
  const save = (path) => ev(`(() => { const s = JSON.parse(localStorage.getItem('pet_save_v1')); return ${path}; })()`);
  const shot = async (file) => {
    const img = await cdp.call('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`${SHOT_DIR}/${file}.png`, Buffer.from(img.data, 'base64'));
    console.log('shot', file);
  };
  /** 红点现场：是否可见 + 胶囊里的数字（1 件画圆点、刻意不写数字，所以 text 为空是预期）。 */
  const dot = (tab) =>
    ev(`(() => {
      const n = (${FIND})('TabDot_${tab}');
      if (!n) return null;
      const l = (${FIND})('TabDot_${tab}Num');
      const c = l && l.getComponent('cc.Label');
      return JSON.stringify({ live: n.activeInHierarchy === true, text: c ? c.string : null });
    })()`).then((s) => (s === null ? null : JSON.parse(s)));
  const dots = async () => ({
    clinic: await dot('clinic'),
    garden: await dot('garden'),
    habitat: await dot('habitat'),
    achieve: await dot('achieve'),
  });

  async function boot(rehomeOffsetMs) {
    await ev(`localStorage.setItem('pet_cloud_env_v1','mock-env-id');
      localStorage.setItem('pet_api_base_v1','off');
      localStorage.setItem('pet_save_v1', ${JSON.stringify(seedSave(rehomeOffsetMs))});
      localStorage.setItem('pet_privacy_v1', JSON.stringify({ privacyAccepted: true, acceptedVersion: '1.0.1', guestMode: false }));
      location.replace('${SITE}/index.html?qa=1');`);
    for (let i = 0; i < 160; i++) {
      await sleep(200);
      if ((await ev(SCENE)) === 'Lobby') break;
    }
    if ((await ev(SCENE)) !== 'Lobby') throw new Error(`未进入 Lobby（当前=${await ev(SCENE)}）`);
    await sleep(2600);
  }

  console.log('\n=== 1. 三枚红点亮起 + 诊疗不亮 ===');
  await boot(-60000);
  const first = await dots();
  judge(
    'R01',
    '后院红点亮且只有 1 件（画圆点、不写数字）',
    first.garden !== null && first.garden.live === true && first.garden.text === '',
    `现场=${JSON.stringify(first.garden)}`,
  );
  judge(
    'R02',
    '小屋红点亮（送养审核已到点，必须玩家手动领结果）',
    first.habitat !== null && first.habitat.live === true && first.habitat.text === '',
    `现场=${JSON.stringify(first.habitat)}`,
  );
  judge(
    'R03',
    '成就红点为胶囊并报可领数 6',
    first.achieve !== null && first.achieve.live === true && first.achieve.text === '6',
    `现场=${JSON.stringify(first.achieve)}`,
  );
  judge(
    'R04',
    '诊疗红点不亮（病例点了就走，没有累积待收，不做假红点）',
    first.clinic !== null && first.clinic.live === false,
    `现场=${JSON.stringify(first.clinic)}`,
  );

  /**
   * 当前可见的坞内摘要胶囊：四块 body 的胶囊同名（DockPillText_0_*），只能靠 activeInHierarchy
   * 区分——切到哪个 TAB，哪个 body 才在层级里。
   */
  const visiblePills = () =>
    ev(`(() => {
      const out = [];
      const walk = (n) => {
        if (n.name.startsWith('DockPillText_') && n.activeInHierarchy) {
          const c = n.getComponent('cc.Label');
          if (c) out.push(c.string);
        }
        n.children.forEach(walk);
      };
      const s = cc.director.getScene();
      if (s) walk(s);
      return JSON.stringify(out);
    })()`).then((s) => JSON.parse(s));

  console.log('\n=== 2. 红点与坞内摘要、称号条同口径 ===');
  const entry = await label('AchievementTitleText');
  judge('R06', '成就红点 6 与称号条「可领 6」一致', /可领6/.test(String(entry)), `称号条=${entry}`);
  await shot(`${OUT}-1-lobby-dots`);

  await click('Tab_garden');
  await sleep(900);
  const pills = await visiblePills();
  judge(
    'R05',
    '后院红点数 = 坞内「成熟 N」摘要（同一判据不会读成两个数）',
    pills.includes('成熟 1'),
    `摘要=${pills.join(' / ')}`,
  );

  console.log('\n=== 3. 领一档成就 → 红点 6 → 5 ===');
  await click('Tab_achieve');
  await sleep(900);
  await click('AchievementButton');
  if (!(await waitFor('AchievementPanel', 8000))) throw new Error('成就面板没打开');
  await sleep(600);
  await click('AchievementChip-medic-0');
  if (!(await waitFor('MilestoneLater', 6000))) throw new Error('领取后没有庆祝弹窗');
  await click('MilestoneLater');
  await sleep(400);
  await click('AchievementClose');
  await sleep(700);
  const afterClaim = await dot('achieve');
  const entry2 = await label('AchievementTitleText');
  judge(
    'R07',
    '领取落盘后红点同步减一（6 → 5）且不需要重进大厅',
    afterClaim.live === true && afterClaim.text === '5' && /可领5/.test(String(entry2)),
    `红点=${JSON.stringify(afterClaim)} 称号条=${entry2}`,
  );

  console.log('\n=== 4. 收一块成熟作物 → 后院红点熄灭 ===');
  await click('Tab_garden');
  await sleep(900);
  await click('GardenButton');
  if (!(await waitFor('GardenPlotBtn_0', 8000))) throw new Error('后院面板没打开');
  await sleep(700);
  const plotText = await label('GardenPlotBtn_0Label');
  judge('R08a', '第一块地读作「收获」（与红点同一判据）', plotText === '收获', `按钮=${plotText}`);
  const herbsBefore = await save('(s.items && s.items.herb_mint) || 0');
  await click('GardenPlotBtn_0');
  await sleep(900);
  const herbsAfter = await save('(s.items && s.items.herb_mint) || 0');
  await click('GardenClose');
  await sleep(700);
  const gardenDot = await dot('garden');
  judge(
    'R08',
    '收成草药并收完最后一块后，后院红点就地熄灭',
    herbsAfter === herbsBefore + 2 && gardenDot.live === false,
    `薄荷 ${herbsBefore}→${herbsAfter} 红点=${JSON.stringify(gardenDot)}`,
  );
  await shot(`${OUT}-2-after-collect`);

  console.log('\n=== 5. 送养未到点不亮 / 到点重进即亮 ===');
  await boot(5 * 60000);
  const waiting = await dot('habitat');
  judge(
    'R09',
    '审核未到点时小屋红点不亮（不骗玩家去领一个领不到的东西）',
    waiting.live === false,
    `现场=${JSON.stringify(waiting)}`,
  );
  const gardenAgain = await dot('garden');
  judge('R10', '重进大厅后院红点仍亮（成熟是墙钟事件，与送养互不影响）', gardenAgain.live === true, `现场=${JSON.stringify(gardenAgain)}`);

  const noisy = errors.filter((e) => !e.includes('apple-mobile-web-app-capable'));
  console.log('=== console errors (' + errors.length + ') ===');
  noisy.slice(0, 25).forEach((e) => console.log(e));
  judge('R11', '全流程无红色报错（忽略 Cocos meta 弃用警告）', noisy.length === 0, `collected=${errors.length}`);

  report();
  cdp.close();
  process.exit(process.exitCode || 0);
})().catch((e) => {
  console.error('ABORT ' + (e.message || e));
  process.exit(1);
});
