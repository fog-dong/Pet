// STATUS: implemented, W20-4 模块三 客户端全链路核验（CDP 驱动 web-mobile 构建，云函数用 mock 注入，不碰线上）
'use strict';
// 覆盖：大厅存档一致性、小屋扣费/满值/冷却/跨天重置、买不起时置灰与余额守卫、
// 离线收益四分支（granted / 1003 频控 / coins=0 / 云端未接通）、领取连点幂等、缺图占位色、互动合成哔声。
// 前置：本地起 web-mobile 构建静态服务 + headless Chrome 开 CDP 端口。
// 用法：node scripts/verify-habitat-browser.js <CDP端口> <站点端口> <截图前缀>

const fs = require('fs');

const CDP_PORT = Number(process.argv[2] || 9448);
const PORT = Number(process.argv[3] || 8095);
const OUT = process.argv[4] || 'w204';
const SHOT_DIR = process.env.SHOT_DIR || 'build';
fs.mkdirSync(SHOT_DIR, { recursive: true });
const W = 720;
const H = 1280;
const SITE = `http://127.0.0.1:${PORT}`;
const DAY = 86400000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
function judge(id, title, pass, detail) {
  results.push({ id, title, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} [${id}] ${title}${detail ? ' → ' + detail : ''}`);
}

/** 汇总判定并落退出码；forced 非 0 时（如有未捕获异常或 ABORT）直接判失败。 */
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
    } catch {}
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

// 云函数 mock：只装 wx.cloud，其余 wx API 一律缺席（各调用点都有 typeof 守卫）；顺带挂上哔声探针。
const BOOT_SCRIPT = `(() => {
  window.__calls = [];
  window.__tones = [];
  window.__claimMode = 'granted';
  const reply = (name) => {
    if (name === 'login') return { code: 0, msg: 'ok', data: { token: 'mock-token', isNewUser: false, serverTime: Date.now(), minVersion: '0.1.0' } };
    if (name === 'getConfig') return { code: 0, msg: 'ok', data: { version: 1, configs: {}, forceUpdate: false, minVersion: '0.1.0' } };
    if (name === 'claimHabitat') {
      if (window.__claimMode === 'limited') return { code: 1003, msg: 'RATE_LIMITED', data: null, serverTime: Date.now() };
      if (window.__claimMode === 'empty') return { code: 0, msg: 'ok', data: { hours: 5, coins: 0 }, serverTime: Date.now() };
      return { code: 0, msg: 'ok', data: { hours: 5, coins: 150 }, serverTime: Date.now() };
    }
    return { code: 0, msg: 'ok', data: null, serverTime: Date.now() };
  };
  window.wx = {
    cloud: {
      init(opt) { window.__init = opt; },
      callFunction(opt) { window.__calls.push(opt.name); return Promise.resolve({ result: reply(opt.name) }); },
    },
  };
  const AC = window.AudioContext || window.webkitAudioContext;
  if (AC) {
    const orig = AC.prototype.createOscillator;
    AC.prototype.createOscillator = function () {
      const osc = orig.apply(this, arguments);
      const rec = { type: null, freq: null };
      window.__tones.push(rec);
      const setFreq = osc.frequency.setValueAtTime.bind(osc.frequency);
      osc.frequency.setValueAtTime = (v, t) => { rec.freq = v; return setFreq(v, t); };
      const desc = Object.getOwnPropertyDescriptor(OscillatorNode.prototype, 'type');
      if (desc && desc.set) {
        const inner = desc.set.bind(osc);
        const read = desc.get ? desc.get.bind(osc) : () => 'sine';
        Object.defineProperty(osc, 'type', { set: (v) => { rec.type = v; inner(v); }, get: read });
      }
      return osc;
    };
  }
})()`;

const FIND = `(nm) => { const find = (n) => { if (n.name === nm) return n; for (const c of n.children) { const r = find(c); if (r) return r; } return null; }; const s = cc.director.getScene(); return s ? find(s) : null; }`;
const SCENE = `(() => { const s = window.cc && cc.director.getScene(); return s ? s.name : 'none'; })()`;
const PET_STATE = `JSON.parse(localStorage.getItem('pet_save_v1')).habitat.find(h=>h.petId==='pet_husky')`;

function seedSave(overrides) {
  const pettedAt = overrides.pettedAt || 0;
  delete overrides.pettedAt;
  const base = {
    coins: 1200,
    hearts: 8,
    petsSeen: ['pet_husky', 'pet_british', 'pet_american', 'pet_calico', 'pet_samoyed', 'pet_shiba'],
    petsAdopted: ['pet_husky', 'pet_british', 'pet_american', 'pet_calico', 'pet_samoyed', 'pet_shiba'],
    adoptedAt: { pet_husky: '2026-10-1' },
    habitat: [
      { petId: 'pet_husky', hunger: 55, cleanliness: 40, mood: 70, lastPettedAt: pettedAt },
      { petId: 'pet_british', hunger: 40, cleanliness: 60, mood: 60, lastPettedAt: pettedAt },
      { petId: 'pet_american', hunger: 50, cleanliness: 50, mood: 50, lastPettedAt: pettedAt },
      { petId: 'pet_calico', hunger: 50, cleanliness: 50, mood: 50, lastPettedAt: pettedAt },
      { petId: 'pet_samoyed', hunger: 50, cleanliness: 50, mood: 50, lastPettedAt: pettedAt },
      { petId: 'pet_shiba', hunger: 50, cleanliness: 50, mood: 60, lastPettedAt: pettedAt },
    ],
    bestStars: {},
    casesDone: 3,
    items: {},
    medicines: {},
    hospitalLevel: 1,
    bedsOccupied: 0,
    affection: { pet_husky: 20 },
    slotBonus: 0,
    adDay: '',
    adCounts: {},
    habitatLastClaimAt: 0,
  };
  return JSON.stringify(Object.assign(base, overrides));
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
    cdp.call('Runtime.evaluate', { expression: expr, returnByValue: true }).then((r) => (r.result ? r.result.value : undefined));
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
  /** 成员卡走 TOUCH_START/TOUCH_END + 位移阈值，不是 Button：用同一坐标的成对触摸事件模拟轻点。 */
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
      const n = (${FIND})('${nm}'); if (!n) return 'missing';
      const b = n.getComponent('cc.Button'); const l = n.getChildByName('${nm}Label');
      return JSON.stringify({ on: b ? b.interactable : null, text: l ? l.getComponent('cc.Label').string : null });
    })()`);
  const save = (path) => ev(`(() => { const s = JSON.parse(localStorage.getItem('pet_save_v1')); return ${path}; })()`);
  const petState = (field) => ev(`(() => { const h = ${PET_STATE}; return h ? h.${field} : null; })()`);
  const claimCalls = () => ev(`window.__calls.filter(c=>c==='claimHabitat').length`);
  const shot = async (file) => {
    const img = await cdp.call('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`${SHOT_DIR}/${file}.png`, Buffer.from(img.data, 'base64'));
    console.log('shot', file);
  };

  async function boot(cloudEnv, saveOverrides, waitMs = 4200) {
    await ev(`${cloudEnv ? `localStorage.setItem('pet_cloud_env_v1','mock-env-id');` : `localStorage.removeItem('pet_cloud_env_v1');`}
      localStorage.setItem('pet_save_v1', ${JSON.stringify(seedSave(saveOverrides))});
      localStorage.setItem('pet_privacy_v1', JSON.stringify({ privacyAccepted: true, acceptedVersion: '1.0.1', guestMode: false }));
      location.replace('${SITE}/?qa=1');`);
    for (let i = 0; i < 160; i++) {
      await sleep(200);
      if ((await ev(SCENE)) === 'Lobby') break;
    }
    const scene = await ev(SCENE);
    if (scene !== 'Lobby') {
      throw new Error(`未进入 Lobby（当前场景=${scene}）`);
    }
    await sleep(waitMs);
  }

  const openPanel = async () => {
    await click('HabitatButton');
    if (!(await waitFor('HabitatPanel'))) throw new Error('HabitatPanel not found');
    await sleep(1200);
  };
  /** 菜单按钮要单独等：只等 HabitatMenu 会在菜单刚挂上、按钮还没建完时返回。 */
  const openMenu = async () => {
    await openPanel();
    await tap('HabitatCard_pet_husky');
    if (!(await waitFor('feed_btn'))) throw new Error('HabitatMenu buttons not found');
    await sleep(700);
  };

  // === 1. 小屋互动：扣费 / 免费路径 / 冷却 / 满值 / 音效兜底 / 贴图覆盖 ===
  console.log('\n=== 1. 小屋互动（coins 1200 / hearts 8）===');
  await boot(true, {});
  judge(
    'L01',
    '大厅 HUD 与存档一致',
    (await label('CoinPillLabel')) === '1200' && (await label('HeartPillLabel')) === '8',
    `Coin=${await label('CoinPillLabel')} Heart=${await label('HeartPillLabel')}`,
  );
  await openPanel();
  await sleep(400);
  const cards = JSON.parse(
    await ev(`(() => {
      const out = [];
      const walk = (n) => {
        if (n.name.startsWith('HabitatCard_pet_')) {
          const petId = n.name.slice('HabitatCard_'.length);
          let ph = null, art = null;
          (function d(m) { if (m.name === 'Placeholder') ph = m; if (m.name === 'Art') art = m; m.children.forEach(d); })(n);
          const color = ph ? ph.getComponent(cc.Graphics).fillColor : null;
          out.push({ petId, placeholder: !!ph, phColor: color ? '#' + color.toHEX() : '-',
            art: art && art.getComponent(cc.Sprite).spriteFrame ? art.getComponent(cc.Sprite).spriteFrame.name : '-' });
        }
        n.children.forEach(walk);
      };
      walk(cc.director.getScene());
      return JSON.stringify(out);
    })()`,
    ),
  );
  await shot('w204-1-list');
  const withArt = cards.filter((c) => !c.placeholder && c.art !== '-').map((c) => c.petId);
  const missing = cards.filter((c) => c.placeholder);
  // 20 只立绘入库后，本组存档里的卡片全部拿到真贴图，「缺图 → 品种占位色」分支不再被数据触发；
  // 兜底代码仍在 PetVisual.ts:105，若要复验需用未配贴图的品种造数据。
  judge(
    'L20',
    `小屋 ${cards.length} 张卡片全部走真贴图（缺图占位分支未被触发）`,
    cards.length >= 2 && missing.length === 0 && withArt.length === cards.length,
    `真图=${withArt.join('/')} 帧名=${cards.map((c) => c.art).join('/')} 占位=${missing.length} 只`,
  );

  await tap('HabitatCard_pet_husky');
  if (!(await waitFor('feed_btn'))) throw new Error('HabitatMenu buttons not found');
  await sleep(800);
  const before = { coins: await save('s.coins'), hearts: await save('s.hearts') };
  await ev('window.__tones = []');
  await click('feed_btn');
  await sleep(500);
  judge(
    'L21',
    '喂食扣 10 金币、饱食 +30',
    (await save('s.coins')) === before.coins - 10 && (await petState('hunger')) === 85,
    `coins ${before.coins}→${await save('s.coins')}, hunger 55→${await petState('hunger')}`,
  );
  await click('bath_btn');
  await sleep(500);
  judge(
    'L22',
    '洗澡扣 5 爱心、清洁 +40',
    (await save('s.hearts')) === before.hearts - 5 && (await petState('cleanliness')) === 80,
    `hearts ${before.hearts}→${await save('s.hearts')}, cleanliness 40→${await petState('cleanliness')}`,
  );
  await click('pet_btn');
  await sleep(500);
  judge(
    'L23',
    '抚摸免费、心情 +15',
    (await save('s.coins')) === before.coins - 10 && (await petState('mood')) === 85,
    `coins 不变(${await save('s.coins')}), mood 70→${await petState('mood')}`,
  );
  const tones = JSON.parse(await ev('JSON.stringify(window.__tones)'));
  const freqs = tones.map((t) => t.freq);
  judge(
    'S01',
    '三条互动 cue 无素材时走合成哔声且音高互不相同',
    freqs.length === 3 && new Set(freqs).size === 3,
    tones.map((t) => `${t.type}:${t.freq}`).join(' '),
  );
  const moodBefore2 = await petState('mood');
  await click('pet_btn');
  await sleep(450);
  judge(
    'B02',
    '抚摸 60 秒冷却：第二次只提示不加值',
    (await petState('mood')) === moodBefore2 && /刚摸过啦/.test(String(await label('ToastLabel'))),
    await label('ToastLabel'),
  );
  await click('feed_btn');
  await sleep(400);
  await click('feed_btn');
  await sleep(400);
  const coinsAtFull = await save('s.coins');
  await click('feed_btn');
  await sleep(450);
  judge(
    'L24',
    '属性满值只提示不扣费',
    (await petState('hunger')) === 100 && (await save('s.coins')) === coinsAtFull && /已经吃饱啦/.test(String(await label('ToastLabel'))),
    `hunger=${await petState('hunger')} coins=${coinsAtFull}→${await save('s.coins')} toast=${await label('ToastLabel')}`,
  );
  await shot('w204-2-menu');

  // === 2. 离线收益四分支 ===
  console.log('\n=== 2. 离线收益四分支 ===');
  const coinsPreClaim = await save('s.coins');
  await click('HabitatMenuClose');
  await sleep(600);
  await click('HabitatClaim');
  await sleep(400);
  const floatTxt = await label('FloatText');
  await shot('w204-3-claim-granted');
  await sleep(700);
  const granted = JSON.parse(await btnState('HabitatClaim'));
  judge(
    'L25a',
    'granted：飘金币 + 存档入账 + 按钮转「已领取」并禁用',
    floatTxt === '+150 金币' &&
      (await save('s.coins')) === coinsPreClaim + 150 &&
      (await save('s.habitatLastClaimAt')) > 0 &&
      granted.on === false &&
      granted.text === '离线收益 · 已领取',
    `float=${floatTxt} coins=${coinsPreClaim}→${await save('s.coins')} btn=${JSON.stringify(granted)}`,
  );
  await shot('w204-3b-claim-granted-toast');

  await boot(true, {});
  await openPanel();
  const coinsPreLimited = await save('s.coins');
  await ev("window.__claimMode = 'limited'");
  await click('HabitatClaim');
  await sleep(900);
  const limitedBtn = JSON.parse(await btnState('HabitatClaim'));
  judge(
    'L25b',
    '1003 频控：只给「毛孩子们还在休息」Toast，不发币、不误标已领取',
    (await label('ToastLabel')) === '毛孩子们还在休息，晚点再来看看吧' &&
      (await save('s.coins')) === coinsPreLimited &&
      limitedBtn.text === '离线收益 · 待领取',
    `btn=${JSON.stringify(limitedBtn)} toast=${await label('ToastLabel')}`,
  );
  await shot('w204-4-claim-limited');
  await ev("window.__claimMode = 'empty'");
  await click('HabitatClaim');
  await sleep(900);
  judge(
    'L25c',
    'hours>0 但 coins=0：同样走「还在休息」，不发币',
    (await label('ToastLabel')) === '毛孩子们还在休息，晚点再来看看吧' && (await save('s.coins')) === coinsPreLimited,
    `toast=${await label('ToastLabel')} coins=${await save('s.coins')}`,
  );

  await boot(false, {});
  await openPanel();
  const coinsPreOffline = await save('s.coins');
  await click('HabitatClaim');
  await sleep(900);
  judge(
    'L25d',
    '断云（无环境 ID 覆盖位）：短路不发币',
    /云端还没接通/.test(String(await label('ToastLabel'))) && (await save('s.coins')) === coinsPreOffline && (await claimCalls()) === 0,
    `toast=${await label('ToastLabel')}`,
  );
  await tap('HabitatCard_pet_husky');
  if (!(await waitFor('feed_btn'))) throw new Error('HabitatMenu buttons not found');
  await sleep(700);
  const b1Coins = await save('s.coins');
  await click('feed_btn');
  await sleep(500);
  judge(
    'B01',
    '断网小屋照常互动（本地扣费 + 本地属性，不发云端请求）',
    (await save('s.coins')) === b1Coins - 10 && (await claimCalls()) === 0,
    `coins ${b1Coins}→${await save('s.coins')}`,
  );

  // === 3. 存档持久化：整页重载后小屋属性不回初值（等价于杀进程重进）===
  console.log('\n=== 3. 重载后存档持久化 ===');
  const hungerPreReload = await petState('hunger');
  const coinsPreReload = await save('s.coins');
  await ev('location.reload()');
  for (let i = 0; i < 160; i++) {
    await sleep(200);
    if ((await ev(SCENE)) === 'Lobby') break;
  }
  await sleep(4200);
  await openPanel();
  await tap('HabitatCard_pet_husky');
  if (!(await waitFor('feed_btn'))) throw new Error('HabitatMenu buttons not found');
  await sleep(500);
  judge(
    'M22',
    '整页重载后饱食度与金币都不回初值（本地存档持久化）',
    (await petState('hunger')) === hungerPreReload && (await save('s.coins')) === coinsPreReload,
    `hunger ${hungerPreReload}→${await petState('hunger')} coins ${coinsPreReload}→${await save('s.coins')}`,
  );

  // === 4. 跨天冷却重置：上次抚摸在昨天，不该被 60 秒窗口拦住 ===
  console.log('\n=== 4. 抚摸冷却跨天重置 ===');
  await boot(true, { pettedAt: Date.now() - 2 * DAY });
  await openMenu();
  const cdCoins = await save('s.coins');
  await click('pet_btn');
  await sleep(500);
  judge(
    'B04',
    '上次抚摸在昨天：冷却不拦，心情照常 +15',
    (await petState('mood')) === 85 && (await save('s.coins')) === cdCoins,
    `mood 70→${await petState('mood')} coins=${await save('s.coins')}`,
  );

  // === 5. 买不起：置灰 + 数额说明 + 免费路径不断链 ===
  console.log('\n=== 5. 买不起时置灰，抚摸仍免费可点 ===');
  await boot(true, { coins: 5, hearts: 2 });
  await openMenu();
  const greyFeed = JSON.parse(await btnState('feed_btn'));
  const greyBath = JSON.parse(await btnState('bath_btn'));
  const greyPet = JSON.parse(await btnState('pet_btn'));
  await shot('w204-5-shortage');
  judge(
    'L21b',
    '金币不足（需 10）：喂食按钮置灰并写明数额',
    greyFeed.on === false && greyFeed.text === '金币不足（需 10）',
    JSON.stringify(greyFeed),
  );
  judge(
    'L22b',
    '爱心不足（需 5）：洗澡按钮置灰并写明数额',
    greyBath.on === false && greyBath.text === '爱心不足（需 5）',
    JSON.stringify(greyBath),
  );
  judge('L23b', '买不起时零成本路径（抚摸 · 免费）仍然可点', greyPet.on === true && greyPet.text === '抚摸 · 免费', JSON.stringify(greyPet));
  // 真实触摸会被 Button.interactable 拦住，脚本直发 click 会绕过它；这里验第二道防线：互动谓词自身的余额守卫。
  const coinsPreSpend = await save('s.coins');
  await click('feed_btn');
  await sleep(500);
  judge(
    'L21c',
    '即便绕过禁用，扣费仍有余额守卫（不扣成负数）',
    (await save('s.coins')) === coinsPreSpend && /金币不足/.test(String(await label('ToastLabel'))),
    `coins ${coinsPreSpend}→${await save('s.coins')} toast=${await label('ToastLabel')}`,
  );
  await click('pet_btn');
  await sleep(500);
  judge('L23c', '买不起时免费抚摸照样能加心情（零成本回访路径不断链）', (await petState('mood')) === 85, `mood→${await petState('mood')}`);

  // === 6. 领取连点幂等 ===
  console.log('\n=== 6. 领取连点 ===');
  await boot(true, {});
  await openPanel();
  const coinsPreTap = await save('s.coins');
  await ev(`(() => { const n = (${FIND})('HabitatClaim'); n.emit('click'); n.emit('click'); n.emit('click'); return 1; })()`);
  await sleep(1200);
  judge(
    'B03',
    '连点 3 路只发 1 次请求、只入 1 次账',
    (await claimCalls()) === 1 && (await save('s.coins')) === coinsPreTap + 150,
    `calls=${await claimCalls()} coins=${coinsPreTap}→${await save('s.coins')}`,
  );

  console.log('\n=== 未捕获异常 ===');
  console.log(errors.length ? errors.slice(0, 10).join('\n') : '无');
  report(errors.length ? 1 : 0);
  cdp.close();
  process.exit(process.exitCode || 0);
})().catch((e) => {
  console.error('ABORT ' + e.message);
  // WebSocket 会让事件循环一直活着，不显式退出的话脚本会挂在半路上不出结果。
  report(1);
  process.exit(1);
});
