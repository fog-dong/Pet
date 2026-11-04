// STATUS: implemented, W25 P2-C 后院浏览器验收（CDP 驱动 web-mobile，云函数 mock，不碰线上）
'use strict';
// 覆盖：大厅入口、六格三列排布与开垦价、草药库存/今日次数、播种扣费、浇水提前 20 分钟、
// 成熟收获进背包、合成扣材料与工本、缺料置灰、开垦解锁第三块。
// 数值全部从 garden.json / recipes.json 现算，脚本里不抄第二份数字。
// 用法：node scripts/verify-garden-browser.js <CDP端口> <站点端口> <截图前缀>

const fs = require('fs');
const path = require('path');

const CDP_PORT = Number(process.argv[2] || 9449);
const PORT = Number(process.argv[3] || 8096);
const OUT = process.argv[4] || 'p2c';
const SHOT_DIR = process.env.SHOT_DIR || 'build';
fs.mkdirSync(SHOT_DIR, { recursive: true });
const W = 720;
const H = 1280;
const SITE = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ROOT = path.join(__dirname, '..');
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const GARDEN = readJson('assets/bundles/cases/config/garden.json');
const RECIPES = readJson('assets/bundles/cases/config/recipes.json');
const crop = (id) => GARDEN.crops.find((item) => item.id === id);
const recipe = (id) => RECIPES.recipes.find((item) => item.id === id);

function dayKeyOf(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
const DAY_KEY = dayKeyOf(Date.now());
const nextCost = GARDEN.plots.costs[0];
const afterUnlockCost = GARDEN.plots.costs[1];

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

const ITEM_DEWORM = recipe('deworm_drops').out;
const seedSave = () => JSON.stringify({
  coins: 1000,
  hearts: 5,
  petsSeen: [],
  petsAdopted: [],
  adoptedAt: {},
  habitat: [],
  bestStars: {},
  casesDone: 0,
  // 薄荷 2 够高级粮；猫薄荷 2 + 薄荷 1 够驱虫药剂；洋甘菊 0 让高级粮置灰。
  items: { herb_mint: 2, herb_catnip: 2 },
  medicines: {},
  hospitalLevel: 1,
  bedsOccupied: 0,
  affection: {},
  slotBonus: 0,
  adDay: '',
  adCounts: {},
  pettedDay: '',
  pettedCount: 0,
  habitatLastClaimAt: 0,
  careQuota: { day: DAY_KEY, nail: 0, deworm: 0 },
  rehome: { rehomed: [], review: null },
  garden: [],
  gardenStamp: 0,
  gardenQuota: { day: DAY_KEY, harvest: 0, craft: 0 },
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
    width: W, height: H, deviceScaleFactor: 2, mobile: true, screenWidth: W, screenHeight: H,
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
  const openGarden = async () => {
    await waitFor('GardenButton');
    await click('GardenButton');
    if (!(await waitFor('GardenPanel'))) throw new Error('GardenPanel not found');
    await sleep(1200);
  };
  const closeGarden = async () => {
    await click('GardenClose');
    await sleep(500);
  };

  try {
    await boot();

    // === 1. 入口与初始网格 ===
    console.log('\n=== 1. 后院入口与网格 ===');
    await openGarden();
    const unlock0 = await btn('GardenUnlock');
    judge(
      'G01',
      '大厅入口可开后院，初始 2 块已开垦、下一块按 costs[0] 定价',
      (await label('GardenPlotTitle_0')) === '空地' &&
        (await label('GardenPlotTitle_1')) === '空地' &&
        (await label('GardenPlotTitle_2')) === '未开垦' &&
        !!unlock0 && unlock0.text === `开垦新地块 · ${nextCost} 金币（还差 ${GARDEN.plots.max - GARDEN.plots.unlocked} 块）`,
      JSON.stringify(unlock0),
    );
    const summary0 = await label('GardenSummary');
    const herbs0 = [await label('GardenHerbLabel_mint'), await label('GardenHerbLabel_chamomile'), await label('GardenHerbLabel_catnip')].join('|');
    judge(
      'G02',
      '头部今日次数与三种草药库存和存档一致',
      summary0 === `今日收获 0/${GARDEN.dailyHarvestLimit} · 合成 0/${RECIPES.dailyCraftLimit}` &&
        herbs0 === `薄荷 ×2|洋甘菊 ×0|猫薄荷 ×2`,
      `${summary0} / ${herbs0}`,
    );
    judge('G03', '空地卡片按钮为「播种」且可点', (await btn('GardenPlotBtn_0')).on === true && (await btn('GardenPlotBtn_0')).text === '播种', JSON.stringify(await btn('GardenPlotBtn_0')));
    await shot('1-garden-plots');

    // === 2. 播种 + 浇水 ===
    console.log('\n=== 2. 播种与浇水 ===');
    const mint = crop('mint');
    await click('GardenPlotBtn_0');
    if (!(await waitFor('SeedPickerShade'))) throw new Error('SeedPicker not found');
    judge('G04', '选种弹层列出全部种子（含种子费与产量）', (await has('SeedPick_mint')) && (await has('SeedPick_chamomile')) && (await has('SeedPick_catnip')), '3 seeds');
    await click('SeedPick_mint');
    await sleep(700);
    const coinsAfterSeed = await save('s.coins');
    judge(
      'G05',
      '播种扣种子费、地块进入生长态并显示剩余时间',
      coinsAfterSeed === 1000 - mint.seedCoins &&
        (await label('GardenPlotTitle_0')) === `${mint.name} · ${mint.growMinutes / 60}小时` &&
        (await label('GardenPlotSub_0')) === `浇水 0/${GARDEN.water.dailyLimitPerPlot} · 产 ${mint.yield} 株` &&
        (await btn('GardenPlotBtn_0')).text === '浇水',
      `coins=${coinsAfterSeed} title=${await label('GardenPlotTitle_0')}`,
    );
    await click('GardenPlotBtn_0');
    await sleep(700);
    const water = GARDEN.water.minutesSaved;
    const expectMin = mint.growMinutes - water;
    const expectText = `${Math.floor(expectMin / 60)}小时${expectMin % 60}分`;
    judge(
      'G06',
      `浇水把成熟时间提前 ${water} 分钟，当日次数 1/${GARDEN.water.dailyLimitPerPlot}`,
      (await label('GardenPlotTitle_0')) === `${mint.name} · ${expectText}` &&
        (await label('GardenPlotSub_0')) === `浇水 1/${GARDEN.water.dailyLimitPerPlot} · 产 ${mint.yield} 株` &&
        String(await label('ToastLabel')).indexOf(`提前 ${water} 分钟`) >= 0,
      `${await label('GardenPlotTitle_0')} / ${await label('ToastLabel')}`,
    );
    await shot('2-garden-growing');

    // === 3. 成熟收获（改档后整页重载，Save.load 只加载一次）===
    console.log('\n=== 3. 成熟收获 ===');
    await closeGarden();
    await patchSave('s.garden[0].readyAt = Date.now() - 1000;');
    await reloadLobby();
    await openGarden();
    const readyTitle = await label('GardenPlotTitle_0');
    await click('GardenPlotBtn_0');
    await sleep(800);
    const mintAfter = await save('s.items.herb_mint');
    const harvestQuota = await save('s.gardenQuota.harvest');
    judge(
      'G07',
      '成熟后可收获：草药进背包、今日收获 +1、地块回到空地',
      readyTitle === `${mint.name} · 可收获` &&
        mintAfter === 2 + mint.yield &&
        harvestQuota === 1 &&
        (await label('GardenPlotTitle_0')) === '空地' &&
        String(await label('ToastLabel')).indexOf(`收获了 ${mint.name} ×${mint.yield}`) >= 0,
      `before=${readyTitle} mint=${mintAfter} quota=${harvestQuota} toast=${await label('ToastLabel')}`,
    );

    // === 4. 合成：缺料置灰 / 成功扣工本 ===
    console.log('\n=== 4. 合成 ===');
    await click('GardenTabCraft');
    await sleep(600);
    const food = recipe('premium_food');
    const deworm = recipe('deworm_drops');
    const mintStock = 2 + mint.yield;
    judge(
      'G08',
      '缺洋甘菊时高级粮置灰，材料行写明缺口',
      (await btn(`GardenCraftBtn_${food.id}`)).on === false &&
        (await label(`GardenRecipeNeed_${food.id}`)) === `薄荷 ${mintStock}/2 · 洋甘菊 0/1`,
      await label(`GardenRecipeNeed_${food.id}`),
    );
    judge(
      'G09',
      '材料齐时驱虫药剂可合成',
      (await btn(`GardenCraftBtn_${deworm.id}`)).on === true &&
        (await label(`GardenRecipeNeed_${deworm.id}`)) === `猫薄荷 2/2 · 薄荷 ${mintStock}/1`,
      await label(`GardenRecipeNeed_${deworm.id}`),
    );
    await shot('3-garden-craft');
    const coinsBeforeCraft = await save('s.coins');
    await click(`GardenCraftBtn_${deworm.id}`);
    await sleep(800);
    const coinsAfterCraft = await save('s.coins');
    const dewormItems = await save(`s.items.${ITEM_DEWORM} || 0`);
    const craftQuota = await save('s.gardenQuota.craft');
    judge(
      'G10',
      '合成扣工本与材料、产出道具、今日合成 +1，按钮即时置灰',
      coinsAfterCraft === coinsBeforeCraft - deworm.coins &&
        dewormItems === deworm.outQty &&
        craftQuota === 1 &&
        (await btn(`GardenCraftBtn_${deworm.id}`)).on === false &&
        String(await label('ToastLabel')).indexOf(`合成了 ${deworm.name}`) >= 0,
      `coins=${coinsAfterCraft} items=${dewormItems} quota=${craftQuota}`,
    );

    // === 5. 开垦第三块 ===
    console.log('\n=== 5. 开垦 ===');
    await click('GardenTabPlots');
    await sleep(600);
    const coinsBeforeUnlock = await save('s.coins');
    await click('GardenUnlock');
    await sleep(900);
    const coinsAfterUnlock = await save('s.coins');
    judge(
      'G11',
      '开垦扣 costs[0]，第三块变空地，下一块价改 costs[1]',
      coinsAfterUnlock === coinsBeforeUnlock - nextCost &&
        (await label('GardenPlotTitle_2')) === '空地' &&
        (await btn('GardenUnlock')).text === `开垦新地块 · ${afterUnlockCost} 金币（还差 ${GARDEN.plots.max - GARDEN.plots.unlocked - 1} 块）`,
      `coins=${coinsAfterUnlock} unlock=${(await btn('GardenUnlock')).text}`,
    );
    await shot('4-garden-unlock');
    await closeGarden();

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
