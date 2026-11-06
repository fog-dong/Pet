// STATUS: implemented, W27 P3-UI 模块三 资源不足获取指引验收（CDP 驱动 web-mobile 构建；只读本地存档，不碰线上）
// 覆盖：金币不足时扩建按钮确实点不动（旧缺口复现）、指引条文案与可点性、
// 点指引条 → 医院遮罩先消失再落到能领的地方（成就直接开面板）、
// 装修弹窗的指引条替掉副标题、无可领成就时改指送养感谢金 / 接诊主产出线。
// 前置：本地起 web-mobile 构建静态服务 + headless Chrome 开 CDP 端口。
// 用法：node scripts/verify-earn-guide-browser.js <CDP端口> <站点端口> <截图前缀>
'use strict';

const fs = require('fs');

const CDP_PORT = Number(process.argv[2] || 9456);
const PORT = Number(process.argv[3] || 8101);
const OUT = process.argv[4] || 'w27earn';
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
 * 种子：coins 一律 80，医院 Lv.2 要 2000、卧室主题要 200，两处都买不起。
 * rich=true 时进度够领 6 档成就（指引应指成就谱）；false 时全部未达成（指引改看送养 / 接诊）。
 * rehomeOffset 只影响送养是否到点：负值=已到点，可领感谢金。
 */
function seedSave(rich, rehomeOffsetMs, coins = 80) {
  const now = Date.now();
  return JSON.stringify({
    coins,
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
    casesDone: rich ? 25 : 0,
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
    reputation: rich ? 320 : 0,
    counters: { gardenPlanted: rich ? 4 : 0, nailCare: 0, rehomeCount: rich ? 1 : 0, gachaDraws: 0 },
    achievementsClaimed: [],
    garden: [],
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
  const live = (nm) =>
    ev(`(() => { const n = (${FIND})('${nm}'); return n ? n.activeInHierarchy === true : null; })()`);
  const waitFor = async (nm, ms = 25000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (await has(nm)) return true;
      await sleep(150);
    }
    return false;
  };
  const click = (nm) => ev(`(() => { const n = (${FIND})('${nm}'); if (!n) return 0; n.emit('click'); return 1; })()`);
  const label = (nm) =>
    ev(`(() => { const n = (${FIND})('${nm}'); const c = n && n.getComponent('cc.Label'); return c ? c.string : null; })()`);
  const interactable = (nm) =>
    ev(`(() => { const n = (${FIND})('${nm}'); const b = n && n.getComponent('cc.Button'); return b ? b.interactable : null; })()`);
  const shot = async (file) => {
    const img = await cdp.call('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`${SHOT_DIR}/${file}.png`, Buffer.from(img.data, 'base64'));
    console.log('shot', file);
  };
  /** 当前 TAB 的坞内摘要：四块 body 胶囊同名，只能靠 activeInHierarchy 分辨落点。 */
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

  async function boot(rich, rehomeOffsetMs, coins = 80) {
    await ev(`localStorage.setItem('pet_cloud_env_v1','mock-env-id');
      localStorage.setItem('pet_api_base_v1','off');
      localStorage.setItem('pet_save_v1', ${JSON.stringify(seedSave(rich, rehomeOffsetMs, coins))});
      localStorage.setItem('pet_privacy_v1', JSON.stringify({ privacyAccepted: true, acceptedVersion: '1.0.1', guestMode: false }));
      location.replace('${SITE}/index.html?qa=1');`);
    for (let i = 0; i < 160; i++) {
      await sleep(200);
      if ((await ev(SCENE)) === 'Lobby') break;
    }
    if ((await ev(SCENE)) !== 'Lobby') throw new Error(`未进入 Lobby（当前=${await ev(SCENE)}）`);
    await sleep(2600);
  }

  async function openHospital() {
    await click('Tab_clinic');
    await sleep(900);
    await click('HospitalButton');
    if (!(await waitFor('HospitalUpgrade', 8000))) throw new Error('医院面板没打开');
    await sleep(700);
  }

  console.log('\n=== 1. 金币不足：旧缺口复现 + 指引条顶上 ===');
  await boot(true, -60000);
  await openHospital();
  const upgradeState = await interactable('HospitalUpgrade');
  judge('G01', '扩建按钮在 80 金币时确实点不动（这就是原来没有出路的地方）', upgradeState === false, `interactable=${upgradeState}`);
  const guideText = await label('HospitalEarnGuideText');
  judge(
    'G02',
    '指引条给出「去哪弄金币」且带上可领档数',
    guideText !== null && /缺金币/.test(guideText) && /成就谱还有 \d+ 档/.test(guideText),
    `文案=${guideText}`,
  );
  judge('G03', '指引条本身可点（不是又一块死色块）', (await interactable('HospitalEarnGuide')) === true, `现状=${await live('HospitalEarnGuide')}`);
  await shot(`${OUT}-1-hospital-guide`);

  console.log('\n=== 2. 点指引条：先摘医院遮罩，再落到成就谱 ===');
  await click('HospitalEarnGuide');
  await sleep(900);
  judge('G04', '医院遮罩当场消失（不会跳完还压着一层黑）', (await has('HospitalOverlay')) === false, '仍在=跳转被遮罩吃掉');
  if (!(await waitFor('AchievementPanel', 8000))) throw new Error('指引没把玩家送到成就谱');
  await sleep(600);
  await shot(`${OUT}-2-landed-achievements`);
  await click('AchievementClose');
  await sleep(700);

  console.log('\n=== 3. 装修弹窗：买不起时副标题让位给指引条 ===');
  await click('Tab_habitat');
  await sleep(900);
  await click('HabitatThemeButton');
  if (!(await waitFor('ThemePanel', 8000))) throw new Error('装修弹窗没打开');
  await sleep(700);
  const themeGuide = await label('ThemeEarnGuideText');
  judge(
    'G05',
    '装修弹窗给出金币获取指引（80 金币买不到 200 的卧室）',
    themeGuide !== null && /缺金币/.test(themeGuide),
    `文案=${themeGuide}`,
  );
  judge('G06', '指引条出现时顶掉原副标题，同一条 y 上不留两行字', (await has('ThemeSubtitle')) === false, 'ThemeSubtitle 仍在');
  await shot(`${OUT}-3-theme-guide`);
  await click('ThemeEarnGuide');
  await sleep(900);
  judge('G07', '点装修指引后弹窗整层关掉并打开成就谱', (await has('ThemeOverlay')) === false, `ThemeOverlay=${await has('ThemeOverlay')}`);
  if (!(await waitFor('AchievementPanel', 8000))) throw new Error('装修指引没有落到成就谱');
  await click('AchievementClose');
  await sleep(700);

  console.log('\n=== 4. 无可领成就时：改指送养感谢金 ===');
  await boot(false, -60000);
  await openHospital();
  const rehomeGuide = await label('HospitalEarnGuideText');
  judge('G08', '成就领空 + 送养到点 → 指引指向小屋感谢金', rehomeGuide !== null && /感谢金/.test(rehomeGuide), `文案=${rehomeGuide}`);
  await click('HospitalEarnGuide');
  await sleep(1000);
  const habitatPills = await visiblePills();
  judge('G09', '跳转真的换到小屋 TAB（坞内摘要读得出）', habitatPills.some((t) => t.startsWith('小屋')), `摘要=${habitatPills.join(' / ')}`);

  console.log('\n=== 5. 两头都没有时：兜底回接诊主产出线 ===');
  await boot(false, 5 * 60000);
  await openHospital();
  const clinicGuide = await label('HospitalEarnGuideText');
  judge('G10', '无成就可领 + 送养未到点 → 指向接诊病例', clinicGuide !== null && /接诊病例/.test(clinicGuide), `文案=${clinicGuide}`);
  await click('HospitalEarnGuide');
  await sleep(1000);
  const clinicPills = await visiblePills();
  judge('G11', '兜底跳转落在诊疗 TAB', clinicPills.some((t) => t.startsWith('医院 Lv')), `摘要=${clinicPills.join(' / ')}`);
  await shot(`${OUT}-4-fallback-clinic`);

  console.log('\n=== 6. 买得起的时候不弹指引 ===');
  await boot(false, 5 * 60000, 9999);
  await openHospital();
  judge('G12', '金币够时不出现指引条（只在缺口时说话）', (await has('HospitalEarnGuide')) === false, `现状=${await has('HospitalEarnGuide')}`);
  judge('G13', '金币够时扩建按钮恢复可点', (await interactable('HospitalUpgrade')) === true, `interactable=${await interactable('HospitalUpgrade')}`);
  await click('HospitalClose');
  await sleep(600);

  const noisy = errors.filter((e) => !e.includes('apple-mobile-web-app-capable'));
  console.log('=== console errors (' + errors.length + ') ===');
  noisy.slice(0, 25).forEach((e) => console.log(e));
  judge('G14', '全流程无红色报错（忽略 Cocos meta 弃用警告）', noisy.length === 0, `collected=${errors.length}`);

  report();
  cdp.close();
  process.exit(process.exitCode || 0);
})().catch((e) => {
  console.error('ABORT ' + (e.message || e));
  process.exit(1);
});
