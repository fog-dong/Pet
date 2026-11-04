// STATUS: implemented, W25 P2-D 护理 + 送养浏览器验收（CDP 驱动 web-mobile，云函数 mock，不碰线上）
'use strict';
// 覆盖：卡片护理/送养小键、剪指甲四红点点错与成功、驱虫消耗药剂与跨天/无药剂置灰、
// 送养通过率与照护度提示（高低两档）、审核中→跳过→成功结果、感谢金与图鉴计数、
// M1 送养后重载不再诈尸回屋、M2 领养位 = petsAdopted - rehomed、失败分支不退费。
// 数值全部从 grooming.json / rehome.json 与当前存档现算，脚本里不抄第二份数字。
// 用法：node scripts/verify-care-browser.js <CDP端口> <站点端口> <截图前缀>

const fs = require('fs');
const path = require('path');

const CDP_PORT = Number(process.argv[2] || 9449);
const PORT = Number(process.argv[3] || 8096);
const OUT = process.argv[4] || 'p2d3';
const SHOT_DIR = process.env.SHOT_DIR || 'build';
fs.mkdirSync(SHOT_DIR, { recursive: true });
const W = 720;
const H = 1280;
const SITE = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const T0 = Date.now();

const ROOT = path.join(__dirname, '..');
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const GROOMING = readJson('assets/bundles/cases/config/grooming.json');
const REHOME = readJson('assets/bundles/cases/config/rehome.json');
const GACHA = readJson('assets/bundles/cases/config/gacha.json');

/** 与 cache/DayKey.ts 一致（月、日不补零）。 */
function dayKeyOf(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
const DAY_KEY = dayKeyOf(T0);

function tierOf(petId) {
  const tier = GACHA.tiers.find((item) => item.pets.indexOf(petId) >= 0);
  return tier ? tier.tier : null;
}
/** 与 game/RehomeRules.ts 同口径：照护度均值 → 区间线性映射 → 千分位；感谢金 = (档位 + 好感加成) × 世代衰减。 */
function expectRate(entry) {
  const care = (entry.hunger + entry.cleanliness + entry.mood) / 300;
  return Math.round((REHOME.rate.min + care * (REHOME.rate.max - REHOME.rate.min)) * 1000) / 1000;
}
function expectThanks(petId, affection, generation) {
  const base = REHOME.thanks[tierOf(petId)];
  const bonus = Math.min(REHOME.affection.maxBonus, Math.max(0, Math.floor(affection)) * REHOME.affection.perPoint);
  const scale = Math.max(REHOME.generation.floor, Math.pow(REHOME.generation.decay, Math.max(0, Math.floor(generation))));
  return { base, bonus, scale, total: Math.max(0, Math.round((base + bonus) * scale)) };
}
const percent = (rate) => `${Math.round(rate * 100)}%`;

const results = [];
const skips = [];
function judge(id, title, pass, detail) {
  results.push({ id, title, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} [${id}] ${title}${detail ? ' → ' + detail : ''}`);
}
function skip(id, title, reason) {
  skips.push({ id, title, reason });
  console.log(`SKIP [${id}] ${title} → ${reason}`);
}
function report(forced) {
  const failed = results.filter((r) => !r.pass);
  console.log(`\n合计 ${results.length} 条判定，PASS ${results.length - failed.length} / FAIL ${failed.length}`);
  failed.forEach((f) => console.log(`  FAIL ${f.id} ${f.title} → ${f.detail}`));
  skips.forEach((s) => console.log(`  ⚠️ SKIP ${s.id} ${s.title} → ${s.reason}`));
  process.exitCode = failed.length || forced ? 1 : 0;
}

const seedSave = () => JSON.stringify({
  coins: 1000,
  hearts: 10,
  petsSeen: ['pet_husky', 'pet_british'],
  petsAdopted: ['pet_husky', 'pet_british'],
  adoptedAt: { pet_husky: '2026-10-1', pet_british: '2026-10-1' },
  habitat: [
    // 水位 = T0：补算小时数恒为 0，用例期间属性不会被衰减改写。
    { petId: 'pet_husky', hunger: 90, cleanliness: 90, mood: 90, birthTimestamp: T0, lastDecayAt: T0, soothedDay: '' },
    { petId: 'pet_british', hunger: 30, cleanliness: 30, mood: 30, birthTimestamp: T0, lastDecayAt: T0, soothedDay: '' },
  ],
  bestStars: {},
  casesDone: 0,
  items: { item_deworm: GROOMING.deworm.dailyLimit },
  medicines: {},
  hospitalLevel: 1,
  bedsOccupied: 0,
  affection: { pet_husky: 20 },
  slotBonus: 0,
  adDay: '',
  adCounts: {},
  pettedDay: '',
  pettedCount: 0,
  habitatLastClaimAt: 0,
  careQuota: { day: DAY_KEY, nail: 0, deworm: 0 },
  rehome: { rehomed: [], review: null },
});

const BOOT_SCRIPT = `(() => {
  const reply = (name) => {
    if (name === 'login') return { code: 0, msg: 'ok', data: { token: 'mock-token', isNewUser: false, serverTime: Date.now(), minVersion: '0.1.0' } };
    if (name === 'getConfig') return { code: 0, msg: 'ok', data: { version: 1, configs: {}, forceUpdate: false, minVersion: '0.1.0' } };
    return { code: 0, msg: 'ok', data: null, serverTime: Date.now() };
  };
  window.wx = { cloud: { init() {}, callFunction(opt) { return Promise.resolve({ result: reply(opt.name) }); } } };
})()`;

const FIND = `(nm) => { const find = (n) => { if (n.name === nm) return n; for (const c of n.children) { const r = find(c); if (r) return r; } return null; }; const s = cc.director.getScene(); return s ? find(s) : null; }`;
const SCENE = `(() => { const s = window.cc && cc.director.getScene(); return s ? s.name : 'none'; })()`;

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

async function findTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page' && t.url.includes(String(PORT)));
      if (page && page.webSocketDebuggerUrl) return page;
    } catch {}
    await sleep(500);
  }
  throw new Error('CDP target not found');
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
      // 页面内异常默认只体现在 exceptionDetails 里，value 是 undefined——不抛出来会静默失败。
      if (r.exceptionDetails) {
        const d = (r.exceptionDetails.exception || {}).description || r.exceptionDetails.text;
        throw new Error('EvalException: ' + String(d).split('\n')[0]);
      }
      return r.result ? r.result.value : undefined;
    });
  const has = (nm) => ev(`!!(${FIND})('${nm}')`);
  const waitFor = async (nm, ms = 20000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (await has(nm)) return true;
      await sleep(150);
    }
    return false;
  };
  const click = (nm) => ev(`(() => { const n = (${FIND})('${nm}'); if (!n) return 0; n.emit('click'); return 1; })()`);
  /** 卡片小键走 TOUCH_START/END + 位移阈值，不是 Button：用同一坐标的成对触摸事件模拟轻点。 */
  const tap = (nm) =>
    ev(`(() => {
      const n = (${FIND})('${nm}'); if (!n) return 0;
      const e = { getUILocation: () => ({ x: 0, y: 0 }) };
      n.emit('touch-start', e);
      n.emit('touch-end', e);
      return 1;
    })()`);
  const label = (nm) => ev(`(() => { const n = (${FIND})('${nm}'); const c = n && n.getComponent('cc.Label'); return c ? c.string : null; })()`);
  const btnState = (nm) =>
    ev(`(() => {
      const n = (${FIND})('${nm}'); if (!n) return null;
      const b = n.getComponent('cc.Button'); const l = n.getChildByName('${nm}Label');
      return JSON.stringify({ on: b ? b.interactable : null, text: l ? l.getComponent('cc.Label').string : null });
    })()`);
  const btn = async (nm) => JSON.parse((await btnState(nm)) || 'null');
  const save = (expr) => ev(`(() => { const s = JSON.parse(localStorage.getItem('pet_save_v1')); return ${expr}; })()`);
  const patchSave = (code) =>
    ev(`(() => { const s = JSON.parse(localStorage.getItem('pet_save_v1')); ${code}; localStorage.setItem('pet_save_v1', JSON.stringify(s)); return 1; })()`);
  const shot = async (file) => {
    const img = await cdp.call('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`${SHOT_DIR}/${OUT}-${file}.png`, Buffer.from(img.data, 'base64'));
    console.log('shot', `${OUT}-${file}`);
  };

  /** 钉子点坐标来自空节点 NailDot_<i>；把「世界坐标」直接喂给 getUILocation，
   *  正好是 NailGame 里 convertToNodeSpaceAR 的逆运算，落点必然就是该红点。
   *  组件名用字符串：构建后全局 cc.UITransform 不保证可枚举，getComponent(undefined) 会静默返回 null。 */
  const nailTap = (kind, value) =>
    ev(`(() => {
      const f = (${FIND})('NailField'); if (!f) return 'field-missing';
      ${kind === 'dot' ? `const node = (${FIND})('NailDot_${value}'); if (!node) return 'dot-missing';` : 'const node = null;'}
      const source = ${kind === 'dot' ? 'node.position' : `{ x: ${value}, y: ${value} }`};
      const ut = f.getComponent('cc.UITransform'); if (!ut) return 'transform-missing';
      const w = ut.convertToWorldSpaceAR({ x: source.x, y: source.y, z: 0 });
      f.emit('touch-end', { getUILocation: () => ({ x: w.x, y: w.y }) });
      return 'ok:' + JSON.stringify({ x: source.x, y: source.y, wx: Math.round(w.x), wy: Math.round(w.y) });
    })()`);

  const waitScene = async (name, ms = 60000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      try {
        if ((await ev(SCENE)) === name) return true;
      } catch {}
      await sleep(200);
    }
    return false;
  };
  async function boot() {
    await ev(`localStorage.setItem('pet_cloud_env_v1','mock-env-id');
      localStorage.setItem('pet_api_base_v1', 'off');
      localStorage.setItem('pet_save_v1', ${JSON.stringify(seedSave())});
      localStorage.setItem('pet_privacy_v1', JSON.stringify({ privacyAccepted: true, acceptedVersion: '1.0.1', guestMode: false }));
      location.replace('${SITE}/?qa=1');`);
    if (!(await waitScene('Lobby'))) throw new Error('未进入 Lobby');
    await sleep(4200);
  }
  async function reloadLobby() {
    await ev('location.reload()');
    if (!(await waitScene('Lobby'))) throw new Error('重载后未进入 Lobby');
    await sleep(4200);
  }
  const openHabitat = async () => {
    await waitFor('HabitatButton');
    await click('HabitatButton');
    if (!(await waitFor('HabitatPanel'))) throw new Error('HabitatPanel not found');
    await sleep(1200);
  };
  const openCare = async (petId) => {
    if (!(await tap(`HabitatAction_Care_${petId}`))) throw new Error('care chip not found');
    if (!(await waitFor('CarePanel'))) throw new Error('CarePanel not found');
    await sleep(600);
  };
  const closeCare = async () => {
    await click('CareClose');
    await sleep(500);
  };
  const openRehome = async (petId) => {
    if (!(await tap(`HabitatAction_Rehome_${petId}`))) throw new Error('rehome chip not found');
    if (!(await waitFor('RehomePanel'))) throw new Error('RehomePanel not found');
    await sleep(600);
  };
  const closeRehome = async () => {
    await click('RehomeClose');
    await sleep(500);
  };

  try {
    await boot();

    // === 1. 入口：卡片上的护理 / 送养小键 ===
    console.log('\n=== 1. 小屋卡片入口 ===');
    await openHabitat();
    const chips = await ev(
      `['HabitatAction_Care_pet_husky','HabitatAction_Rehome_pet_husky'].map((nm) => {
        const n = (${FIND})(nm);
        const t = n && n.getChildByName(nm.slice('HabitatAction_'.length) + 'Text');
        return !!n && t ? t.getComponent('cc.Label').string : 'missing';
      }).join(',')`,
    );
    judge('C01', '卡片护理/送养小键齐备且文案正确', chips === '护理,送养', chips);
    await shot('1-habitat');

    // === 2. 护理面板：默认态与驱虫可用 ===
    console.log('\n=== 2. 护理面板 ===');
    await openCare('pet_husky');
    const nailWhy0 = await label('CareNailWhy');
    const dewormWhy0 = await label('CareDewormWhy');
    judge('C02', `剪指甲余量提示为「今日剩 ${GROOMING.nail.dailyLimit} 次」`, nailWhy0 === `今日剩 ${GROOMING.nail.dailyLimit} 次`, nailWhy0);
    const hasStock = GROOMING.deworm.dailyLimit > 0;
    judge(
      'C03',
      '驱虫有药剂时按钮可用，原因行说明余量',
      hasStock && (await btn('CareDewormBtn')).on === true && dewormWhy0 === `药剂 ${GROOMING.deworm.dailyLimit} 支 · 每日 ${GROOMING.deworm.dailyLimit} 次`,
      dewormWhy0,
    );
    const stats0 = `${await label('CareStat_饱食')}|${await label('CareStat_清洁')}|${await label('CareStat_心情')}`;
    judge('C04', '档案属性与存档一致', stats0 === '饱食 90|清洁 90|心情 90', stats0);
    await shot('2-care');

    // === 3. 剪指甲：点错中断 ===
    console.log('\n=== 3. 剪指甲点错 ===');
    await click('CareNailBtn');
    if (!(await waitFor('NailPanel'))) throw new Error('NailPanel not found');
    await sleep(500);
    const dotCount = await ev(`${GROOMING.nail.dots} - 0`);
    const dotsOk = await ev(`(() => { const f = (${FIND})('NailField'); if (!f) return 0; let n = 0; for (let i = 0; i < 4; i++) { const m = (${FIND})('NailDot_' + i); if (m && m.active) n++; } return n; })()`);
    judge('C05', '4 个红点已生成且可定位', dotCount === GROOMING.nail.dots && dotsOk === GROOMING.nail.dots, `dots=${dotsOk}`);
    await shot('3-nail');
    // (185,185) 距最近红点 > 命中半径 87.4，必定点空。
    console.log('tap-miss →', await nailTap('miss', 185));
    await sleep(900);
    const nailClosed = !(await has('NailPanel'));
    const coinsAfterWrong = await save('s.coins');
    const moodAfterWrong = await save(`s.habitat.find(x=>x.petId==='pet_husky').mood`);
    const nailQuota1 = await save('s.careQuota.nail');
    const wrongToast = await label('ToastLabel');
    judge(
      'C06',
      '点错：宠物受惊（心情 -10）、不扣金币、占一次当日次数、Toast 说明原因',
      nailClosed &&
        moodAfterWrong === 80 &&
        coinsAfterWrong === 1000 &&
        nailQuota1 === 1 &&
        !!wrongToast &&
        wrongToast.indexOf('剪刀歪了') >= 0,
      `mood=${moodAfterWrong} coins=${coinsAfterWrong} nail=${nailQuota1} toast=${wrongToast}`,
    );
    judge('C07', '点错后护理面板余量降为 1 次', (await label('CareNailWhy')) === '今日剩 1 次', await label('CareNailWhy'));
    await shot('4-nail-wrong');

    // === 4. 剪指甲：四个全中 ===
    console.log('\n=== 4. 剪指甲成功 ===');
    await click('CareNailBtn');
    if (!(await waitFor('NailPanel'))) throw new Error('NailPanel not found');
    await sleep(400);
    for (let i = 0; i < GROOMING.nail.dots; i++) {
      console.log(`tap-dot-${i} →`, await nailTap('dot', i));
      await sleep(160);
    }
    await sleep(900);
    const coinsAfterNail = await save('s.coins');
    const cleanAfterNail = await save(`s.habitat.find(x=>x.petId==='pet_husky').cleanliness`);
    const moodAfterNail = await save(`s.habitat.find(x=>x.petId==='pet_husky').mood`);
    const nailQuota2 = await save('s.careQuota.nail');
    const nailToast = await label('ToastLabel');
    judge(
      'C08',
      '四红点全中：扣 15 金币、清洁 +12、心情 +8、次数用尽',
      coinsAfterNail === 1000 - GROOMING.nail.costCoins &&
        cleanAfterNail === Math.min(100, 90 + GROOMING.nail.cleanGain) &&
        moodAfterNail === 80 + GROOMING.nail.moodGain &&
        nailQuota2 === GROOMING.nail.dailyLimit &&
        !!nailToast &&
        nailToast.indexOf('指甲剪好了') >= 0,
      `coins=${coinsAfterNail} clean=${cleanAfterNail} mood=${moodAfterNail} nail=${nailQuota2} toast=${nailToast}`,
    );
    const nailBtn2 = await btn('CareNailBtn');
    judge(
      'C09',
      '次数用尽后按钮置灰但保留动作名',
      nailBtn2 && nailBtn2.on === false && nailBtn2.text === '开始剪指甲' && (await label('CareNailWhy')) === '今日剪指甲次数已用完',
      JSON.stringify(nailBtn2) + ' why=' + (await label('CareNailWhy')),
    );
    await shot('5-nail-done');

    // === 5. 驱虫：消耗药剂 ===
    console.log('\n=== 5. 驱虫 ===');
    await click('CareDewormBtn');
    await sleep(800);
    const cleanAfterDeworm = await save(`s.habitat.find(x=>x.petId==='pet_husky').cleanliness`);
    const moodAfterDeworm = await save(`s.habitat.find(x=>x.petId==='pet_husky').mood`);
    const stockAfter = await save(`s.items.${GROOMING.deworm.itemId} || 0`);
    const dewormQuota = await save('s.careQuota.deworm');
    const dewormToast = await label('ToastLabel');
    judge(
      'C10',
      '驱虫：清洁 +25 / 心情 +5、消耗 1 支药剂、占一次当日次数',
      cleanAfterDeworm === Math.min(100, 90 + GROOMING.nail.cleanGain + GROOMING.deworm.cleanGain) &&
        moodAfterDeworm === 80 + GROOMING.nail.moodGain + GROOMING.deworm.moodGain &&
        stockAfter === 0 &&
        dewormQuota === 1 &&
        !!dewormToast &&
        dewormToast.indexOf('驱虫完成') >= 0,
      `clean=${cleanAfterDeworm} mood=${moodAfterDeworm} stock=${stockAfter} deworm=${dewormQuota}`,
    );
    judge(
      'C11',
      '驱虫同日第二次：按钮置灰并提示次数已用完',
      (await btn('CareDewormBtn')).on === false && (await label('CareDewormWhy')) === `今日驱虫次数已用完（${GROOMING.deworm.dailyLimit} 次）`,
      await label('CareDewormWhy'),
    );
    await shot('6-deworm');
    await closeCare();

    // === 6. 送养：通过率与提示 ===
    console.log('\n=== 7. 送养信息 ===');
    const british = { hunger: 30, cleanliness: 30, mood: 30 };
    const britishRate = expectRate(british);
    const britishThanks = expectThanks('pet_british', 0, 0);
    await openRehome('pet_british');
    const lowRate = await label('RehomeRateValue');
    const lowHint = await label('RehomeRateHint');
    const lowThanks = await label('RehomeThanksValue');
    judge(
      'R01',
      '低照护度：通过率 67% 且明确提示「照护度不足，通过率低」',
      lowRate === percent(britishRate) && lowHint === '照护度不足，通过率低',
      `${lowRate} / ${lowHint}`,
    );
    judge(
      'R02',
      '感谢金卡与明细口径一致（低照护 + 零好感）',
      lowThanks === `+${britishThanks.total} 金币` && (await label('RehomeThanksDetail')) === `档位 ${britishThanks.base} + 好感 0 × ${britishThanks.scale.toFixed(2)}`,
      `${lowThanks} / ${await label('RehomeThanksDetail')}`,
    );
    await shot('8-rehome-low');
    await closeRehome();

    const huskyStats = {
      hunger: await save(`s.habitat.find(x=>x.petId==='pet_husky').hunger`),
      cleanliness: await save(`s.habitat.find(x=>x.petId==='pet_husky').cleanliness`),
      mood: await save(`s.habitat.find(x=>x.petId==='pet_husky').mood`),
    };
    const huskyRate = expectRate(huskyStats);
    const huskyThanks = expectThanks('pet_husky', 20, 0);
    await openRehome('pet_husky');
    const highRate = await label('RehomeRateValue');
    const highHint = await label('RehomeRateHint');
    const highThanks = await label('RehomeThanksValue');
    judge(
      'R03',
      '高照护度：通过率随属性抬升且提示「照护得很好」',
      highRate === percent(huskyRate) && highHint === '照护得很好，通过率很高',
      `${highRate} / ${highHint}`,
    );
    judge(
      'R04',
      '感谢金 = (档位 + 好感加成) × 世代系数',
      highThanks === `+${huskyThanks.total} 金币` &&
        (await label('RehomeThanksDetail')) === `档位 ${huskyThanks.base} + 好感 ${huskyThanks.bonus} × ${huskyThanks.scale.toFixed(2)}`,
      `${highThanks} / ${await label('RehomeThanksDetail')}`,
    );
    await shot('9-rehome-high');

    // === 8. 送养成功：审核中 → 跳过 → 结果 → 小屋刷新 ===
    console.log('\n=== 8. 送养成功 ===');
    await ev('window.Math.random = () => 0');
    const coinsBefore = await save('s.coins');
    const heartsBefore = await save('s.hearts');
    await click('RehomePayCoins');
    await sleep(600);
    const waitText = await label('RehomeWait');
    const coinsAfterPay = await save('s.coins');
    judge(
      'R05',
      '提交扣 150 金币并进入 30 分钟审核',
      coinsAfterPay === coinsBefore - REHOME.cost.coins && !!waitText && waitText.indexOf('审核中 · 还需 30 分钟') === 0,
      `${waitText} coins=${coinsAfterPay}`,
    );
    await shot('10-review');
    await click('RehomeSkip');
    await sleep(900);
    const okTitle = await label('RehomeResultTitle');
    const farewell = await label('RehomeFarewell');
    const resultCoins = await label('RehomeCoins');
    const codex = await label('RehomeCodex');
    const heartsAfterSkip = await save('s.hearts');
    const coinsAfterAward = await save('s.coins');
    const rehomedAfter = await save('s.rehome.rehomed.join(",")');
    const habitatIds = await save('s.habitat.map(x=>x.petId).join(",")');
    const adoptedIds = await save('s.petsAdopted.join(",")');
    judge(
      'R06',
      '结果页：成功标题 + 告别文案 + 感谢金 + 图鉴计数',
      okTitle === '找到新家啦' &&
        !!farewell &&
        farewell.indexOf('回头看了你一眼') >= 0 &&
        resultCoins === `+${huskyThanks.total} 金币` &&
        !!codex &&
        codex.indexOf('当前图鉴 2 只') >= 0,
      `${okTitle} / ${farewell} / ${resultCoins} / ${codex}`,
    );
    judge(
      'R07',
      '成功后移出 habitat、写入 rehomed、petsAdopted 保留（M1/M2 数据层）',
      habitatIds === 'pet_british' &&
        rehomedAfter === 'pet_husky' &&
        adoptedIds === 'pet_husky,pet_british' &&
        coinsAfterAward === coinsAfterPay + huskyThanks.total &&
        heartsAfterSkip === heartsBefore - REHOME.cost.skipHearts,
      `habitat=${habitatIds} rehomed=${rehomedAfter} adopted=${adoptedIds} coins=${coinsAfterAward} hearts=${heartsAfterSkip}`,
    );
    await shot('11-rehome-ok');
    await click('RehomeResultOk');
    await sleep(1500);
    const titleAfter = await label('HabitatTitle');
    judge(
      'R08',
      '回小屋后标题只剩 1 只，且不再渲染已送养的卡片',
      !!titleAfter && titleAfter.indexOf('1 只') >= 0 && !(await has('HabitatCard_pet_husky')) && !(await has('HabitatAction_Care_pet_husky')),
      `title=${titleAfter}`,
    );
    await shot('12-habitat-after');

    // === 9. M1 诈尸实测：退出重进 ===
    console.log('\n=== 9. M1 重载实测 ===');
    await reloadLobby();
    await openHabitat();
    const titleReload = await label('HabitatTitle');
    const ghost = await has('HabitatCard_pet_husky');
    const alive = await save('s.habitat.map(x=>x.petId).join(",")');
    const rehomedReload = await save('s.rehome.rehomed.join(",")');
    const adoptedReload = await save('s.petsAdopted.join(",")');
    const liveCount = await save('s.petsAdopted.length - s.rehome.rehomed.length');
    judge(
      'M01',
      '重载后已送养的宠物不会诈尸回屋（M1）',
      !ghost && alive === 'pet_british' && titleReload.indexOf('1 只') >= 0,
      `ghost=${ghost} habitat=${alive} title=${titleReload}`,
    );
    judge(
      'M02',
      '图鉴仍点亮、领养位按 petsAdopted - rehomed 计（M2）',
      adoptedReload.indexOf('pet_husky') >= 0 && rehomedReload === 'pet_husky' && liveCount === 1,
      `adopted=${adoptedReload} rehomed=${rehomedReload} live=${liveCount}`,
    );
    await shot('13-reload');

    // === 10. 跨天 + 无药剂（Save.load 只加载一次，必须改档后整页重载）===
    console.log('\n=== 10. 跨天 + 无药剂 ===');
    await patchSave(`s.careQuota.day = '2000-1-1'; s.items = Object.assign({}, s.items, { ${JSON.stringify(GROOMING.deworm.itemId)}: 0 });`);
    await reloadLobby();
    await openHabitat();
    await openCare('pet_british');
    const crossNail = await label('CareNailWhy');
    const crossDeworm = await label('CareDewormWhy');
    judge(
      'C12',
      '跨天次数归零，但无药剂时明确指路去后院',
      crossNail === `今日剩 ${GROOMING.nail.dailyLimit} 次` &&
        (await btn('CareDewormBtn')).on === false &&
        crossDeworm === '没有驱虫药剂，去后院合成一支吧',
      `nail=${crossNail} deworm=${crossDeworm}`,
    );
    await shot('13b-deworm-blocked');
    await closeCare();

    // === 11. 送养失败：不退费、宠物留在小屋 ===
    console.log('\n=== 10. 送养失败 ===');
    await ev('window.Math.random = () => 0.9999');
    const coinsFail0 = await save('s.coins');
    const heartsFail0 = await save('s.hearts');
    await openRehome('pet_british');
    await click('RehomePayCoins');
    await sleep(600);
    await click('RehomeSkip');
    await sleep(900);
    const failTitle = await label('RehomeResultTitle');
    const failRate = await label('RehomeRejectedRate');
    const failCoins = await save('s.coins');
    const failHearts = await save('s.hearts');
    const failHabitat = await save('s.habitat.map(x=>x.petId).join(",")');
    const failReview = await save('s.rehome.review');
    judge(
      'R09',
      '审核未通过：宠物留在小屋、审核清空、费用不退',
      failTitle === '这次没遇到合适的人家' &&
        failRate === `本次通过率 ${percent(britishRate)}` &&
        failCoins === coinsFail0 - REHOME.cost.coins &&
        failHearts === heartsFail0 - REHOME.cost.skipHearts &&
        failHabitat === 'pet_british' &&
        failReview === null,
      `${failTitle} / ${failRate} coins=${failCoins} hearts=${failHearts} review=${failReview}`,
    );
    await shot('14-rehome-fail');
    await click('RehomeResultOk');
    await sleep(1200);
    judge('R10', '失败结果关闭后小屋仍能看到这只宠物', await has('HabitatCard_pet_british'), 'card=' + (await has('HabitatCard_pet_british')));

    if (errors.length) {
      console.log(`\n页面异常 ${errors.length} 条：`);
      errors.forEach((e) => console.log('  ' + e));
    }
    judge('X01', '页面无未捕获异常', errors.length === 0, `count=${errors.length}`);
    report(errors.length);
  } catch (err) {
    console.error('ABORT:', err && err.message);
    report(1);
  } finally {
    cdp.close();
  }
})();
