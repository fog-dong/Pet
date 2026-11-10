// STATUS: implemented, W28 P1 三条收尾验收（CDP 驱动 web-mobile 构建；只读本地存档，不碰线上）
// 覆盖：P1-1 缺驱虫药剂时护理面板有可点出路、P1-2 缺爱心时小屋引导行换成获取指引、
// P1-3 装修买不起的行直接禁用并写「差 N 金币」，以及三处「资源够了就不该出现指引」的反例。
// 前置：本地起 web-mobile 构建静态服务 + headless Chrome 开 CDP 端口。
// 用法：node scripts/verify-w28-p1-browser.js <CDP端口> <站点端口> <截图前缀>
'use strict';

const fs = require('fs');

const CDP_PORT = Number(process.argv[2] || 9458);
const PORT = Number(process.argv[3] || 8103);
const OUT = process.argv[4] || 'w28p1';
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
 * 种子默认「三样都缺」：hearts 2 买不起 8 爱心高级粮、coins 80 买不起 200 卧室、items 空即没驱虫药剂。
 * 每个字段单独可覆盖，用来跑反例（资源够了指引条必须闭嘴）。
 */
function seedSave(overrides) {
  const opts = Object.assign({}, overrides);
  const now = Date.now();
  const pets = opts.pets || ['pet_husky', 'pet_british'];
  return JSON.stringify({
    coins: opts.coins === undefined ? 80 : opts.coins,
    hearts: opts.hearts === undefined ? 2 : opts.hearts,
    petsSeen: pets,
    petsAdopted: pets,
    adoptedAt: { pet_husky: '2026-11-01', pet_british: '2026-11-01' },
    habitat: pets.map((petId) => ({
      petId,
      hunger: 50,
      cleanliness: 50,
      mood: 55,
      birthTimestamp: now - 86400000,
      lastDecayAt: now,
      soothedDay: '',
    })),
    habitatLastClaimAt: now,
    bestStars: {},
    casesDone: 0,
    items: opts.items || {},
    medicines: {},
    hospitalLevel: 1,
    bedsOccupied: 0,
    affection: {},
    slotBonus: 0,
    adDay: '',
    adCounts: {},
    pettedDay: '',
    pettedCount: 0,
    reputation: 0,
    counters: {},
    achievementsClaimed: [],
    garden: [],
    gardenStamp: 0,
    gardenQuota: { day: '', harvest: 0, craft: 0 },
    careQuota: { day: '', nail: 0, deworm: 0 },
    rehome: { rehomed: [] },
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
  /** 小屋卡片里的护理 / 送养小键不是 cc.Button，走 TOUCH_START + TOUCH_END 位移阈值。 */
  const tap = (nm) =>
    ev(`(() => {
      const n = (${FIND})('${nm}'); if (!n) return 0;
      const e = { getUILocation: () => ({ x: 0, y: 0 }) };
      n.emit('touch-start', e);
      n.emit('touch-end', e);
      return 1;
    })()`);
  const label = (nm) =>
    ev(`(() => {
      const n = (${FIND})('${nm}');
      if (!n) return null;
      const own = n.getComponent('cc.Label');
      if (own) return own.string;
      const kid = n.children.map((c) => c.getComponent('cc.Label')).find((c) => !!c);
      return kid ? kid.string : null;
    })()`);
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

  async function boot(overrides) {
    await ev(`localStorage.setItem('pet_cloud_env_v1','mock-env-id');
      localStorage.setItem('pet_api_base_v1','off');
      localStorage.setItem('pet_save_v1', ${JSON.stringify(seedSave(overrides))});
      localStorage.setItem('pet_privacy_v1', JSON.stringify({ privacyAccepted: true, acceptedVersion: '1.0.1', guestMode: false }));
      location.replace('${SITE}/index.html?qa=1');`);
    for (let i = 0; i < 160; i++) {
      await sleep(200);
      if ((await ev(SCENE)) === 'Lobby') break;
    }
    const scene = await ev(SCENE);
    if (scene !== 'Lobby') throw new Error(`未进入 Lobby（当前=${scene}）`);
    await sleep(2600);
  }

  async function openHabitat() {
    await click('HabitatButton');
    if (!(await waitFor('HabitatPanel', 12000))) throw new Error('小屋面板没打开');
    if (!(await waitFor('HabitatAction_Care_pet_husky', 12000))) throw new Error('护理小键没就绪');
    await sleep(700);
  }

  console.log('\n=== 1. P1-2 缺爱心：引导行那一格换成可点出路 ===');
  await boot({});
  await openHabitat();
  judge('W1', '缺 8 爱心时小屋出现爱心指引条', (await has('HabitatHeartsGuide')) === true, `现状=${await live('HabitatHeartsGuide')}`);
  const heartsGuide = await label('HabitatHeartsGuideText');
  judge('W2', '文案说的是缺爱心且给了去处', heartsGuide !== null && /缺爱心/.test(heartsGuide), `文案=${heartsGuide}`);
  judge('W3', '指引条可点（不是又一块死色块）', (await interactable('HabitatHeartsGuide')) === true, `interactable=${await interactable('HabitatHeartsGuide')}`);
  judge('W4', '同一行只说一件事：指引亮起时引导语让位', (await live('HabitatQuotaLabel')) === false, `HabitatQuotaLabel active=${await live('HabitatQuotaLabel')}`);
  await shot(`${OUT}-1-habitat-hearts-guide`);
  await click('HabitatHeartsGuide');
  await sleep(1000);
  judge('W5', '点指引后小屋遮罩当场关掉', (await has('HabitatOverlay')) === false, `仍在=跳转被遮罩吃掉`);
  const landed = await visiblePills();
  // 本档种子 claimable=0，hearts 路线不看送养（送养只发金币），所以兜底必须落在接诊主产出线。
  judge('W6', '跳转落在诊疗 TAB（爱心只兜底到接诊这条主产出线）', (await live('HospitalButton')) === true, `摘要=${landed.join(' / ')}`);
  judge('W6b', '落地后没有残留的小屋遮罩', (await has('HabitatOverlay')) === false, `HabitatOverlay=${await has('HabitatOverlay')}`);

  console.log('\n=== 2. P1-2 反例：爱心够时指引条闭嘴、引导语回来 ===');
  await boot({ hearts: 30 });
  await openHabitat();
  judge('W7', '爱心够时不出现指引条', (await has('HabitatHeartsGuide')) === false, `现状=${await has('HabitatHeartsGuide')}`);
  judge('W8', '指引条不在时引导语恢复可见', (await live('HabitatQuotaLabel')) === true, `active=${await live('HabitatQuotaLabel')}`);

  console.log('\n=== 3. P1-1 缺驱虫药剂：护理卡下方挂后院出路 ===');
  await boot({});
  await openHabitat();
  await tap('HabitatAction_Care_pet_husky');
  if (!(await waitFor('CarePanel', 12000))) throw new Error('护理面板没打开');
  await sleep(700);
  judge('W9', '没药剂时驱虫卡下方出现指引条', (await live('CareDewormGuide')) === true, `active=${await live('CareDewormGuide')}`);
  const medGuide = await label('CareDewormGuideText');
  judge('W10', '文案指向后院合成（唯一能拿到药剂的地方）', medGuide !== null && /后院/.test(medGuide), `文案=${medGuide}`);
  judge('W11', '指引条可点', (await interactable('CareDewormGuide')) === true, `interactable=${await interactable('CareDewormGuide')}`);
  await shot(`${OUT}-2-care-deworm-guide`);
  await click('CareDewormGuide');
  await sleep(1000);
  judge('W12', '点指引后护理面板整层关掉', (await has('CareOverlay')) === false, `CareOverlay=${await has('CareOverlay')}`);
  const gardenPills = await visiblePills();
  judge('W13', '跳转真的换到后院 TAB（药剂唯一出路是种草药）', (await live('GardenButton')) === true, `摘要=${gardenPills.join(' / ')}`);

  console.log('\n=== 4. P1-1 反例：有药剂时不该出现指引条 ===');
  await boot({ items: { item_deworm: 1 } });
  await openHabitat();
  await tap('HabitatAction_Care_pet_husky');
  if (!(await waitFor('CarePanel', 12000))) throw new Error('护理面板没打开（有药档）');
  await sleep(700);
  judge('W14', '手握 1 支药剂时指引条不出现', (await live('CareDewormGuide')) === false, `active=${await live('CareDewormGuide')}`);
  const meta = await label('CareDewormWhy');
  judge('W15', '卡片副行回到药剂余量口径', meta !== null && /药剂 1 支/.test(meta), `副行=${meta}`);
  await click('CareClose');
  await sleep(600);

  console.log('\n=== 5. P1-3 装修买不起：当场禁用 + 差 N 金币 ===');
  await boot({});
  await openHabitat();
  await click('HabitatThemeEntry');
  if (!(await waitFor('ThemePanel', 12000))) throw new Error('装修弹窗没打开');
  await sleep(700);
  const bedText = await label('ThemePick_bedroom');
  judge('W16', '卧室按钮写「差 120 金币」（200−80，当场算差额）', bedText === '差 120 金币', `文案=${bedText}`);
  judge('W17', '买不起的行按禁用态渲染', (await interactable('ThemePick_bedroom')) === false, `interactable=${await interactable('ThemePick_bedroom')}`);
  const balconyText = await label('ThemePick_balcony');
  judge('W18', '阳台同样是差额口径（500−80）', balconyText === '差 420 金币', `文案=${balconyText}`);
  judge('W19', '默认诊所是「使用中」而非价格', (await label('ThemePick_clinic')) === '使用中', `文案=${await label('ThemePick_clinic')}`);
  await shot(`${OUT}-3-theme-lack`);
  const coinsBefore = await label('ThemeCoins');
  await click('ThemePick_bedroom');
  await sleep(800);
  judge('W20', '禁用后点下去不再弹二次确认（旧缺口）', (await has('ChoicePanel')) === false, `ChoicePanel=${await has('ChoicePanel')}`);
  judge('W21', '金币分文未动', (await label('ThemeCoins')) === coinsBefore, `${coinsBefore} → ${await label('ThemeCoins')}`);

  console.log('\n=== 6. P1-3 反例：钱够了恢复原价与可点 ===');
  await boot({ coins: 4000 });
  await openHabitat();
  await click('HabitatThemeEntry');
  if (!(await waitFor('ThemePanel', 12000))) throw new Error('装修弹窗没打开（有钱档）');
  await sleep(700);
  judge('W22', '买得起时按钮回到「200 金币」', (await label('ThemePick_bedroom')) === '200 金币', `文案=${await label('ThemePick_bedroom')}`);
  judge('W23', '买得起时按钮可点', (await interactable('ThemePick_bedroom')) === true, `interactable=${await interactable('ThemePick_bedroom')}`);
  judge('W24', '全档买得起时副标题归位（不硬塞指引）', (await has('ThemeSubtitle')) === true, `ThemeSubtitle=${await has('ThemeSubtitle')}`);
  await shot(`${OUT}-4-theme-afford`);
  await click('ThemeClose');
  await sleep(600);

  const noisy = errors.filter((e) => !e.includes('apple-mobile-web-app-capable'));
  console.log('=== console errors (' + errors.length + ') ===');
  noisy.slice(0, 25).forEach((e) => console.log(e));
  judge('W25', '全流程无红色报错（忽略 Cocos meta 弃用警告）', noisy.length === 0, `collected=${errors.length}`);

  report();
  cdp.close();
  process.exit(process.exitCode || 0);
})().catch((e) => {
  console.error('ABORT ' + (e.message || e));
  process.exit(1);
});
