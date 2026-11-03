// STATUS: implemented, W22-6 生命周期 UI 核验（CDP 驱动 web-mobile 构建，纯本地存档，不碰线上）
// 覆盖：同一出生时间下金毛与布偶阶段不同（配置驱动证据）、阶段标签文案、卡片底部陪伴进度条、
// 详情摘要「预计寿命」、幼年/成年/老年三档互动收益、老档缺字段回填生日且不追溯扣属性。
// 前置：本地起 web-mobile 构建静态服务 + headless Chrome 开 CDP 端口。
// 用法：node scripts/verify-life-browser.js <CDP端口> <站点端口> <截图前缀>
'use strict';

const fs = require('fs');

const CDP_PORT = Number(process.argv[2] || 9448);
const PORT = Number(process.argv[3] || 8095);
const OUT = process.argv[4] || 'w22';
const SHOT_DIR = process.env.SHOT_DIR || 'build';
fs.mkdirSync(SHOT_DIR, { recursive: true });
const W = 720;
const H = 1280;
const SITE = `http://127.0.0.1:${PORT}`;
const DAY = 86400000;
// 基准时刻在 Node 侧取一次：种子存档与断言共用同一个点，避免出现两处「现在」。
const T0 = Date.now();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 三档对照：金毛 100 天=成年、布偶 100 天=幼年（同生日、不同阈值），柴犬 340 天=老年。 */
const SEED_PETS = [
  { petId: 'pet_golden', ageDays: 100, hunger: 60, cleanliness: 70, mood: 70 },
  { petId: 'pet_ragdoll', ageDays: 100, hunger: 70, cleanliness: 70, mood: 70 },
  { petId: 'pet_shiba', ageDays: 340, hunger: 80, cleanliness: 80, mood: 70 },
];

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

// 云函数 mock：本单全程不发离线收益请求，只保证 login/getConfig 走通。
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

/** 种子：ageDays 换成出生时间戳；水位取 T0，保证进屋时补算 0 小时，断言只看互动本身。 */
function seedSave(options) {
  const old = !!(options && options.legacy);
  const habitat = SEED_PETS.map((p) => {
    const base = {
      petId: p.petId,
      hunger: p.hunger,
      cleanliness: p.cleanliness,
      mood: p.mood,
      birthTimestamp: T0 - p.ageDays * DAY,
      lastDecayAt: T0,
      soothedDay: '',
    };
    // 老档形态：三个新字段全缺席，decodeHabitat 应补 0 再由数据层回填。
    if (old) {
      delete base.birthTimestamp;
      delete base.lastDecayAt;
      delete base.soothedDay;
    }
    return base;
  });
  return JSON.stringify({
    coins: 1200,
    hearts: 8,
    petsSeen: SEED_PETS.map((p) => p.petId),
    petsAdopted: SEED_PETS.map((p) => p.petId),
    adoptedAt: { pet_golden: '2026-10-1', pet_ragdoll: '2026-10-1', pet_shiba: '2026-10-1' },
    habitat,
    bestStars: {},
    casesDone: 3,
    items: {},
    medicines: {},
    hospitalLevel: 1,
    bedsOccupied: 0,
    affection: {},
    slotBonus: 0,
    adDay: '',
    adCounts: {},
    habitatLastClaimAt: 0,
    pettedDay: '',
    pettedCount: 0,
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
    cdp.call('Runtime.evaluate', { expression: expr, returnByValue: true }).then((r) => (r.result ? r.result.value : undefined));
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
  const tap = (nm) =>
    ev(`(() => {
      const n = (${FIND})('${nm}'); if (!n) return 0;
      const e = { getUILocation: () => ({ x: 0, y: 0 }) };
      n.emit('touch-start', e);
      n.emit('touch-end', e);
      return 1;
    })()`);
  const label = (nm) => ev(`(() => { const n = (${FIND})('${nm}'); const c = n && n.getComponent('cc.Label'); return c ? c.string : null; })()`);
  const save = (path) => ev(`(() => { const s = JSON.parse(localStorage.getItem('pet_save_v1')); return ${path}; })()`);
  const petState = (petId, field) =>
    ev(`(() => { const h = JSON.parse(localStorage.getItem('pet_save_v1')).habitat.find(x=>x.petId==='${petId}'); return h ? h.${field} : null; })()`);
  const shot = async (file) => {
    const img = await cdp.call('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`${SHOT_DIR}/${file}.png`, Buffer.from(img.data, 'base64'));
    console.log('shot', file);
  };

  /** 卡片内 StageTag_* 的文字与是否存在底部进度条：逐卡回读，不靠颜色猜测。 */
  const cardInfo = () =>
    ev(`(() => {
      const out = {};
      const walk = (n) => {
        if (n.name.startsWith('HabitatCard_pet_')) {
          const petId = n.name.slice('HabitatCard_'.length);
          let tag = null, bar = 0;
          (function d(m) {
            if (m.name.startsWith('StageTag_')) { const c = m.getChildByName('StageTagText'); tag = c ? c.getComponent('cc.Label').string : '?'; }
            if (m.name.startsWith('HabitatLife')) bar += 1;
            m.children.forEach(d);
          })(n);
          out[petId] = { tag, bar };
        }
        n.children.forEach(walk);
      };
      walk(cc.director.getScene());
      return JSON.stringify(out);
    })()`);

  async function boot(seedOptions) {
    // `pet_api_base_v1='off'`：源码里有自建 HTTP 默认地址（决策-6d），浏览器用例必须显式关掉这条通路，
    // 否则会去请求真线上后端、且 mock 的 wx 没有 request；关掉后回落到下面 mock 的 wx.cloud。
    await ev(`localStorage.setItem('pet_cloud_env_v1','mock-env-id');
      localStorage.setItem('pet_api_base_v1','off');
      localStorage.setItem('pet_save_v1', ${JSON.stringify(seedSave(seedOptions))});
      localStorage.setItem('pet_privacy_v1', JSON.stringify({ privacyAccepted: true, acceptedVersion: '1.0.1', guestMode: false }));
      location.replace('${SITE}/index.html?qa=1');`);
    for (let i = 0; i < 160; i++) {
      await sleep(200);
      if ((await ev(SCENE)) === 'Lobby') break;
    }
    const scene = await ev(SCENE);
    if (scene !== 'Lobby') {
      throw new Error(`未进入 Lobby（当前场景=${scene}）`);
    }
    await sleep(4200);
    await click('HabitatButton');
    if (!(await waitFor('HabitatPanel'))) throw new Error('HabitatPanel not found');
    await sleep(1200);
  }

  async function openMenu(petId) {
    await tap(`HabitatCard_${petId}`);
    if (!(await waitFor('feed_btn'))) throw new Error('HabitatMenu buttons not found');
    await sleep(700);
  }

  console.log('\n=== 1. 同一出生时间，阶段按 pets.json 阈值分档 ===');
  await boot({});
  const info = JSON.parse(await cardInfo());
  await shot(`${OUT}-1-list`);
  judge('W22-1a', '金毛 100 天 = 成年（阈值 60/200）', info.pet_golden && info.pet_golden.tag === '成年', JSON.stringify(info.pet_golden));
  judge('W22-1b', '布偶 100 天 = 幼年（阈值 150/400）', info.pet_ragdoll && info.pet_ragdoll.tag === '幼年', JSON.stringify(info.pet_ragdoll));
  judge('W22-1c', '柴犬 340 天 = 老年（阈值 90/330）', info.pet_shiba && info.pet_shiba.tag === '老年', JSON.stringify(info.pet_shiba));
  judge(
    'W22-1d',
    '同生日不同品种阶段确实不同（差异来自配置，不是代码分支）',
    info.pet_golden.tag !== info.pet_ragdoll.tag,
    `金毛=${info.pet_golden.tag} 布偶=${info.pet_ragdoll.tag}`,
  );
  judge(
    'W22-1e',
    '每张卡片底部都有陪伴进度条节点',
    [info.pet_golden, info.pet_ragdoll, info.pet_shiba].every((c) => c.bar === 1),
    `条数=${[info.pet_golden, info.pet_ragdoll, info.pet_shiba].map((c) => c.bar).join('/')}`,
  );

  console.log('\n=== 2. 详情摘要「预计寿命」按品种阈值折算 ===');
  await openMenu('pet_golden');
  const goldenLife = await label('HabitatMenuLife');
  await shot(`${OUT}-2-menu-adult`);
  judge(
    'W22-2a',
    '金毛摘要 = 陪伴 8 岁 4 个月 · 预计寿命：25 岁（300/12）',
    goldenLife === '陪伴 8 岁 4 个月 · 预计寿命：25 岁',
    String(goldenLife),
  );
  await click('HabitatMenuClose');
  await sleep(600);
  await openMenu('pet_ragdoll');
  judge(
    'W22-2b',
    '布偶同生日但摘要 = 预计寿命：42 岁（500/12），与金毛不同行',
    (await label('HabitatMenuLife')) === '陪伴 8 岁 4 个月 · 预计寿命：42 岁',
    String(await label('HabitatMenuLife')),
  );

  console.log('\n=== 3. 阶段影响互动收益（模块三实测）===');
  await click('pet_btn');
  await sleep(500);
  const ragdollMood = await petState('pet_ragdoll', 'mood');
  judge('W22-3a', '幼年抚摸不打折：心情 70→80（§2.2 +10）', ragdollMood === 80, `mood=${ragdollMood}`);
  judge('W22-3b', '飘字按实际收益生成 +10 心情', (await label('FloatText')) === '+10 心情', String(await label('FloatText')));
  await click('HabitatMenuClose');
  await sleep(700);
  await openMenu('pet_shiba');
  await click('pet_btn');
  await sleep(500);
  const shibaMood = await petState('pet_shiba', 'mood');
  const shibaFloat = await label('FloatText');
  await shot(`${OUT}-3-menu-senior`);
  judge('W22-3c', '老年抚摸收益减半：心情 70→75（10×0.5）', shibaMood === 75, `mood=${shibaMood}`);
  judge('W22-3d', '老年飘字读作 +5 心情，不写死 +10', shibaFloat === '+5 心情', String(shibaFloat));
  const heartsAfterSoothe = await save('s.hearts');
  judge(
    'W22-3e',
    '老年小毛病只可能是「没命中」（8 爱心）或「当天命中一次」（5 爱心）',
    heartsAfterSoothe === 8 || heartsAfterSoothe === 5,
    `hearts=${heartsAfterSoothe}`,
  );
  judge('W22-3f', '抚摸计入全局每日 3 次：两次互动后 pettedCount=2', (await save('s.pettedCount')) === 2, `pettedCount=${await save('s.pettedCount')}`);

  console.log('\n=== 4. 老档缺字段：按领养日回填生日，且不追溯扣属性 ===');
  await boot({ legacy: true });
  const legacyBirth = await petState('pet_golden', 'birthTimestamp');
  const legacyWater = await petState('pet_golden', 'lastDecayAt');
  const legacyHunger = await petState('pet_golden', 'hunger');
  judge(
    'W22-4a',
    '回填生日 = 2026-10-1 本地零点（正数时间戳）',
    legacyBirth === new Date(2026, 9, 1).getTime(),
    `birth=${legacyBirth} 期望=${new Date(2026, 9, 1).getTime()}`,
  );
  judge('W22-4b', '水位补为当前时间（>0）', typeof legacyWater === 'number' && legacyWater > 0, `water=${legacyWater}`);
  judge('W22-4c', '不按领养日追溯扣属性：饱食仍是 60', legacyHunger === 60, `hunger=${legacyHunger}`);
  const legacyInfo = JSON.parse(await cardInfo());
  const legacyTag = legacyInfo.pet_golden ? legacyInfo.pet_golden.tag : null;
  judge('W22-4d', '老档回填后立刻有阶段标签（按回填生日判定）', legacyTag !== null, `tag=${legacyTag}`);
  await shot(`${OUT}-4-legacy`);

  console.log('\n=== 未捕获异常 ===');
  console.log(errors.length ? errors.slice(0, 10).join('\n') : '无');
  report(errors.length ? 1 : 0);
  cdp.close();
  process.exit(process.exitCode || 0);
})().catch((e) => {
  console.error('ABORT ' + e.message);
  report(1);
  process.exit(1);
});
