// STATUS: implemented, W30-1 习性动作浏览器验收（CDP 驱动 web-mobile，云函数 mock，不碰线上）
'use strict';
// 覆盖：大厅散步带 idle 立绘真的在走动 / 伸懒腰 / 舔爪（角度或横向位置会变），
// 睡着的立绘只呼吸不换姿态，在小屋卡片同样开启习性动作，采样末帧不残留位移与歪斜。
// 用法：node scripts/verify-pet-habits-browser.js <CDP端口> <站点端口> <截图前缀>

const fs = require('fs');
const path = require('path');

const CDP_PORT = Number(process.argv[2] || 9450);
const PORT = Number(process.argv[3] || 3112);
const OUT = process.argv[4] || 'w30';
const SHOT_DIR = process.env.SHOT_DIR || 'build';
fs.mkdirSync(SHOT_DIR, { recursive: true });
const W = 720;
const H = 1280;
const SITE = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const T0 = Date.now();

/** 采样窗口要盖住至少一轮习性动作：habitGap 2.6s × 抖动上限 1.5 ≈ 3.9s。 */
const WINDOW_MS = 9000;
const SAMPLE_MS = 120;
/** breathing 只改缩放；角度或 x 出现变化才算真的换了动作。 */
const ANGLE_SPAN_MIN = 2;
const X_SPAN_MIN = 6;
const RESIDUAL_ANGLE_MAX = 4.5;
const RESIDUAL_X_MAX = 11;

function dayKeyOf(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
const DAY_KEY = dayKeyOf(T0);

const results = [];
function judge(id, title, pass, detail) {
  results.push({ id, title, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} [${id}] ${title}${detail ? ' → ' + detail : ''}`);
}
function report() {
  const failed = results.filter((r) => !r.pass);
  console.log(`\n合计 ${results.length} 条判定，PASS ${results.length - failed.length} / FAIL ${failed.length}`);
  failed.forEach((f) => console.log(`  FAIL ${f.id} ${f.title} → ${f.detail}`));
  process.exitCode = failed.length ? 1 : 0;
}

/** husky 三项 80/80/50 → idle（worst≥30、mood<70）；british 饿到 20 → sleep。 */
const seedSave = () => JSON.stringify({
  coins: 1000,
  hearts: 10,
  petsSeen: ['pet_husky', 'pet_british'],
  petsAdopted: ['pet_husky', 'pet_british'],
  adoptedAt: { pet_husky: '2026-10-1', pet_british: '2026-10-1' },
  habitat: [
    { petId: 'pet_husky', hunger: 80, cleanliness: 80, mood: 50, birthTimestamp: T0, lastDecayAt: T0, soothedDay: '' },
    { petId: 'pet_british', hunger: 20, cleanliness: 80, mood: 80, birthTimestamp: T0, lastDecayAt: T0, soothedDay: '' },
  ],
  bestStars: {},
  casesDone: 0,
  items: {},
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

let cdp = null;
(async () => {
  cdp = await connect((await findTarget()).webSocketDebuggerUrl);
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
  /** 读立绘 Content 的局部姿态；占位图也在 content 里，缺贴图照样能测姿态。 */
  const pose = (hostName) =>
    ev(`(() => {
      const host = (${FIND})('${hostName}'); if (!host) return null;
      const c = host.getChildByName('Content'); if (!c) return null;
      const s = c.scale;
      return { x: c.position.x, y: c.position.y, a: c.angle, sx: s.x };
    })()`);
  async function sample(hostName, ms = WINDOW_MS) {
    const frames = [];
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const p = await pose(hostName);
      if (p) frames.push(p);
      await sleep(SAMPLE_MS);
    }
    return frames;
  }
  const span = (frames, key) => {
    const v = frames.map((f) => f[key]);
    return v.length ? Math.max(...v) - Math.min(...v) : 0;
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

  try {
    await boot();

    // === 1. 大厅散步带：idle 那只必须有动作，sleep 那只只能呼吸 ===
    console.log('\n=== 1. 大厅散步带 ===');
    const idle = await sample('LobbyPet_pet_husky');
    const asleep = await sample('LobbyPet_pet_british', 4000);
    const idleAngle = span(idle, 'a');
    const idleX = span(idle, 'x');
    const idleScale = span(idle, 'sx');
    judge('H01', 'idle 立绘换过姿态', idle.length > 20 && (idleAngle >= ANGLE_SPAN_MIN || idleX >= X_SPAN_MIN),
      `frames=${idle.length} angleSpan=${idleAngle.toFixed(2)} xSpan=${idleX.toFixed(2)}`);
    judge('H02', 'idle 立绘呼吸仍在', idleScale > 0.005, `scaleSpan=${idleScale.toFixed(3)}`);
    const sleepAngle = span(asleep, 'a');
    const sleepX = span(asleep, 'x');
    const sleepScale = span(asleep, 'sx');
    judge('H03', 'sleep 立绘不做习性动作', sleepAngle === 0 && sleepX === 0,
      `angleSpan=${sleepAngle.toFixed(2)} xSpan=${sleepX.toFixed(2)}`);
    judge('H04', 'sleep 立绘仍在呼吸', sleepScale > 0.002, `scaleSpan=${sleepScale.toFixed(3)}`);
    const tail = idle[idle.length - 1];
    judge('H05', 'idle 收尾不残留位移歪斜', Math.abs(tail.a) <= RESIDUAL_ANGLE_MAX && Math.abs(tail.x) <= RESIDUAL_X_MAX,
      `angle=${tail.a.toFixed(2)} x=${tail.x.toFixed(2)}`);

    // 连拍：130ms 间隔避开 0.48s 跳跃周期与 1.1s 呼吸周期的同相位。
    for (let i = 0; i < 8; i++) {
      await shot(`1-lobby-${i}`);
      await sleep(130);
    }

    // === 2. 在小屋卡片：同样开启习性动作 ===
    console.log('\n=== 2. 小屋卡片 ===');
    await waitFor('HabitatButton');
    await click('HabitatButton');
    if (!(await waitFor('HabitatPanel'))) throw new Error('HabitatPanel not found');
    await sleep(1200);
    const card = await sample('HabitatPortrait_pet_husky');
    const cardAngle = span(card, 'a');
    const cardX = span(card, 'x');
    judge('H06', '卡片立绘也换过姿态', card.length > 20 && (cardAngle >= ANGLE_SPAN_MIN || cardX >= X_SPAN_MIN),
      `frames=${card.length} angleSpan=${cardAngle.toFixed(2)} xSpan=${cardX.toFixed(2)}`);
    const sleepCard = await sample('HabitatPortrait_pet_british', 4000);
    judge('H07', '卡片里睡着的立绘保持安静', span(sleepCard, 'a') === 0 && span(sleepCard, 'x') === 0,
      `angleSpan=${span(sleepCard, 'a').toFixed(2)} xSpan=${span(sleepCard, 'x').toFixed(2)}`);
    for (let i = 0; i < 8; i++) {
      await shot(`2-habitat-${i}`);
      await sleep(130);
    }
    judge('H08', '无运行期异常', errors.length === 0, errors.join(' | ') || 'clean');
  } catch (err) {
    console.error('\nERROR', err && err.message ? err.message : err);
    process.exitCode = 1;
  } finally {
    report();
    // CDP 的 WebSocket 会一直挂着事件循环，不主动断开进程就不退出（外部调用方会误以为卡死）。
    if (cdp) cdp.close();
  }
})();
