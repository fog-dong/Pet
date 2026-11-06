// STATUS: implemented, W27 P3-UI 模块三 P0-4 面板开合过渡验收（CDP 驱动 web-mobile 构建；只读本地存档，不碰线上）
// 覆盖：六块面板（医院/后院/小屋/护理/送养/成就谱）打开是否真的淡入+落位、关闭是否真的淡出后销毁、
// 淡出期间输入是否还被吞掉、淡出未完就重开是否只留一层遮罩、大厅 TAB 换页未被破坏、全程无报错。
// 取样用页内定时采样后整条时间线回传，避免 CDP 往返抖动盖不住 0.2 秒的窗口。
// 前置：本地起 web-mobile 构建静态服务 + headless Chrome 开 CDP 端口。
// 用法：node scripts/verify-panel-motion-browser.js <CDP端口> <站点端口> <截图前缀>
'use strict';

const fs = require('fs');

const CDP_PORT = Number(process.argv[2] || 9457);
const PORT = Number(process.argv[3] || 8102);
const OUT = process.argv[4] || 'w27motion';
const SHOT_DIR = process.env.SHOT_DIR || 'build';
fs.mkdirSync(SHOT_DIR, { recursive: true });
const W = 720;
const H = 1280;
const SITE = `http://127.0.0.1:${PORT}`;
const FADE_OUT_MS = 180; // 与 Tokens.DURATION.fadeOut 对齐，用于识别「整段淡出落在两帧之间」的采样饥饿
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

/** 种子：一只 husky 在屋里（护理 / 送养都点得开），没有进行中的送养审核，金币充足（不弹指引条，干扰最少）。 */
function seedSave() {
  const now = Date.now();
  return JSON.stringify({
    coins: 5000,
    hearts: 4,
    petsSeen: ['pet_husky'],
    petsAdopted: ['pet_husky'],
    adoptedAt: { pet_husky: '2026-11-01' },
    habitat: [
      {
        petId: 'pet_husky',
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
    casesDone: 3,
    items: {},
    medicines: {},
    hospitalLevel: 1,
    bedsOccupied: 0,
    affection: { pet_husky: 20 },
    slotBonus: 0,
    adDay: '',
    adCounts: {},
    pettedDay: '',
    pettedCount: 0,
    reputation: 10,
    counters: { gardenPlanted: 0, nailCare: 0, rehomeCount: 0, gachaDraws: 0 },
    achievementsClaimed: [],
    garden: [],
    gardenStamp: 0,
    gardenQuota: { day: '', harvest: 0, craft: 0 },
    careQuota: { day: '', nail: 0, deworm: 0 },
    rehome: { rehomed: [], review: null },
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

  const ev = (expr, awaitPromise) =>
    cdp
      .call('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: awaitPromise === true })
      .then((r) => {
        if (r.exceptionDetails) {
          const d = r.exceptionDetails.exception || {};
          throw new Error(`页内表达式报错：${String(d.description || r.exceptionDetails.text).split('\n')[0]}`);
        }
        return r.result ? r.result.value : undefined;
      });
  const has = (nm) => ev(`!!(${FIND})('${nm}')`);
  const count = (nm) =>
    ev(
      `(() => { let c = 0; const walk = (n) => { if (n.name === '${nm}') c++; n.children.forEach(walk); }; const s = cc.director.getScene(); if (s) walk(s); return c; })()`,
    );
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
  const shot = async (file) => {
    const img = await cdp.call('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`${SHOT_DIR}/${file}.png`, Buffer.from(img.data, 'base64'));
    console.log('shot', file);
  };
  const waitFor = async (nm, ms = 12000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (await has(nm)) return true;
      await sleep(120);
    }
    return false;
  };

  /**
   * 页内时间线采样：遮罩的 UIOpacity 不透明度、卡片缩放与 y、遮罩是否还活着、是否还吞点击。
   * 组件一律用字符串取：构建后全局 cc.XXX 不保证可枚举，getComponent(undefined) 会静默返回 null。
   * 探针挂在 window 上，boot() 里 location.replace 会换一份新文档把它们冲掉，所以每次开机都要重注入一次。
   * 采样走 requestAnimationFrame 而不是 setTimeout：tween 是按帧推进的，定时器在无 GPU 的 headless 里能漂到
   * 两三百毫秒，比整段淡出还长，会整段漏采（实测就是这样把正常淡出误判成「当场抽掉」的）。
   * 触发也放在页内同一个 JS turn 里（fireNm + mode），t=0 就是点击那一刻；
   * 从 node 侧 click 再起录的话，CDP 单程 100ms 已经把 180ms 的淡出走掉大半，起止都没了参照。
   */
  const PROBE_SRC = `
    window.__rec = (overlayNm, panelNm, ms, fireNm, mode) => new Promise((resolve) => {
      const t0 = performance.now();
      let fired = false;
      if (fireNm) {
        const n = (${FIND})(fireNm);
        if (n) {
          if (mode === 'tap') {
            const e = { getUILocation: () => ({ x: 0, y: 0 }) };
            n.emit('touch-start', e);
            n.emit('touch-end', e);
          } else { n.emit('click'); }
          fired = true;
        }
      }
      const out = [];
      const tick = () => {
        const o = (${FIND})(overlayNm);
        const p = (${FIND})(panelNm);
        const op = o ? o.getComponent('cc.UIOpacity') : null;
        out.push({
          t: Math.round(performance.now() - t0),
          alive: !!o,
          op: op ? op.opacity : (o ? 255 : null),
          block: o ? !!o.getComponent('cc.BlockInputEvents') : null,
          scale: p ? Math.round(p.scale.x * 1000) / 1000 : null,
          y: p ? Math.round(p.position.y * 10) / 10 : null,
        });
        if (performance.now() - t0 < ms) { requestAnimationFrame(tick); } else { resolve(JSON.stringify({ fired, samples: out })); }
      };
      tick();
    });
    window.__opacity = (nm) => {
      const n = (${FIND})(nm);
      if (!n) return null;
      const o = n.getComponent('cc.UIOpacity');
      return o ? o.opacity : 255;
    };`;
  const injectProbes = () => ev(PROBE_SRC);
  const timeline = (overlayNm, panelNm, ms, fireNm, mode) =>
    ev(
      `window.__rec('${overlayNm}','${panelNm}',${ms},${fireNm ? `'${fireNm}'` : 'null'},${mode ? `'${mode}'` : 'null'})`,
      true,
    ).then((s) => {
      const r = JSON.parse(s);
      if (fireNm && !r.fired) throw new Error(`页内找不到触发节点 ${fireNm}`);
      return r.samples;
    });
  const opacityOf = (nm) => ev(`window.__opacity('${nm}')`);

  /** 一次完整开合：淡入在跑 → 落位干净 → 淡出在跑 → 播完销毁 → 场上不残留。 */
  async function cycle(id, label, overlayNm, panelNm, openNm, closeNm, openMode) {
    // 起表即点击，同一 JS turn：t=0 就是动画原点，之后的每一帧都落在同一把尺子上。
    const open = await timeline(overlayNm, panelNm, 1200, openNm, openMode);
    if (!(await has(panelNm))) throw new Error(`${label} 面板没打开`);
    const live = open.filter((s) => s.alive);
    const home = open[open.length - 1];
    const fading = live.filter((s) => s.op !== null && s.op < 255);
    const lifting = live.filter((s) => s.scale !== null && s.scale < 0.999);
    // 这套 headless 只有 ~8 FPS（帧间隔 100–150ms），0.25 秒的淡入本来就只跨两三帧，
    // 所以判据是「采到过中间值」而不是「采够 N 帧」——硬切实现永远采不到 255 以外的值。
    judge(
      `${id}-1`,
      `${label} 打开遮罩从半透明起步并走到全不透明（淡入真的在播，不是硬切）`,
      fading.length >= 1 && home.op === 255,
      `半透明帧=${fading.slice(0, 4).map((s) => `${s.t}ms/${Math.round(s.op)}`).join(' ') || '无'}；落位=${home.op}`,
    );
    judge(
      `${id}-2`,
      `${label} 打开卡片从 0.97 / 下方 18px 起幅并落回原位（上浮在播）`,
      lifting.length >= 1 && home.scale === 1,
      `最小 scale=${lifting.length ? Math.min(...lifting.map((s) => s.scale)) : '无'}；起幅 y=${live.length ? live[0].y : '?'} → 落位 y=${home.y}`,
    );
    judge(
      `${id}-3`,
      `${label} 落位后完全复位（255 / 缩放 1 / 遮罩仍在吞点击）`,
      home.op === 255 && home.scale === 1 && home.block === true,
      JSON.stringify(home),
    );

    const close = await timeline(overlayNm, panelNm, 900, closeNm);
    const alive = close.filter((s) => s.alive);
    const dimming = alive.filter((s) => s.op !== null && s.op < 255);
    const death = close.filter((s) => !s.alive)[0];
    // 这套 headless 的帧间隔实测 100–200ms，而淡出只有 180ms：运气差时整段淡出正好塞在两帧之间，
    // 采样物理上落不进去（上一帧还是 255，下一帧已经销毁）。所以给一条不依赖帧率的等价证据：
    // 点击当帧遮罩仍在（当场抽掉的实现这一帧就没了）+ 销毁发生在 150ms 之后（同步销毁到不了这么晚）
    // + 两次采样间隔确实大于淡出时长（确认是帧饥饿，不是动画没播）。
    const gaps = alive.slice(1).map((s, i) => s.t - alive[i].t);
    const lastLive = alive.length ? alive[alive.length - 1].t : close[0].t;
    const starveGap = death ? death.t - lastLive : Math.max(...gaps, 0);
    const starved = starveGap > FADE_OUT_MS;
    judge(
      `${id}-4`,
      `${label} 关闭是淡出不是当场抽掉（点击当帧遮罩仍在，且过渡占住时间窗）`,
      close[0].alive === true && (dimming.length >= 1 || (starved && !!death && death.t >= 150)),
      `t=0 存活=${close[0].alive}/op=${close[0].op}；变暗帧=${
        dimming.slice(0, 4).map((s) => `${s.t}ms/${Math.round(s.op)}`).join(' ') ||
        `${starved ? `无（最后可见 ${lastLive}ms → 首次不见 ${death.t}ms，跨 ${starveGap}ms > 淡出 ${FADE_OUT_MS}ms，整段落在两帧之间，改由销毁时机举证）` : `无（跨帧仅 ${starveGap}ms，本应采到）`}`
      }`,
    );
    judge(
      `${id}-5`,
      `${label} 淡出期间遮罩继续吞点击（不会把这 0.2 秒漏给身后的大厅）`,
      alive.length > 0 && alive.every((s) => s.block === true),
      `存活样本里吞点击=${alive.map((s) => s.block).join('')}`,
    );
    judge(
      `${id}-6`,
      `${label} 淡出播完即销毁（提前抽掉或迟迟不销毁都算不干净）`,
      !!death && death.t >= 150 && death.t <= 700,
      death ? `点击后 ${death.t}ms 采到遮罩已不存在（淡出 180ms）` : '900ms 内没销毁',
    );
    const left = await count(overlayNm);
    judge(`${id}-7`, `${label} 收干净后场上 ${overlayNm} 归零`, left === 0, `count=${left}`);
    if (id === 'M1') console.log('  raw open:', JSON.stringify(open), '\n  raw close:', JSON.stringify(close));
  }

  async function boot() {
    await ev(`localStorage.setItem('pet_cloud_env_v1','mock-env-id');
      localStorage.setItem('pet_api_base_v1','off');
      localStorage.setItem('pet_save_v1', ${JSON.stringify(seedSave())});
      localStorage.setItem('pet_privacy_v1', JSON.stringify({ privacyAccepted: true, acceptedVersion: '1.0.1', guestMode: false }));
      location.replace('${SITE}/index.html?qa=1');`);
    for (let i = 0; i < 160; i++) {
      await sleep(200);
      if ((await ev(SCENE)) === 'Lobby') break;
    }
    if ((await ev(SCENE)) !== 'Lobby') throw new Error(`未进入 Lobby（当前=${await ev(SCENE)}）`);
    await sleep(2600);
    await injectProbes();
  }

  const openHabitat = async () => {
    await click('HabitatButton');
    if (!(await waitFor('HabitatPanel'))) throw new Error('小屋面板没打开');
  };

  console.log('\n=== 1. 医院面板：淡入 → 落位 → 淡出 → 销毁 ===');
  await boot();
  await cycle('M1', '医院', 'HospitalOverlay', 'HospitalPanel', 'HospitalButton', 'HospitalClose');

  console.log('\n=== 2. 淡出未完就重开：只留一层，且照样落位 ===');
  await click('HospitalButton');
  if (!(await waitFor('HospitalPanel'))) throw new Error('重开前医院面板没出现');
  await sleep(60);
  await click('HospitalClose');
  await sleep(70);
  await click('HospitalButton');
  if (!(await waitFor('HospitalPanel'))) throw new Error('快速开关后面板没了');
  await sleep(950);
  const tail = (await timeline('HospitalOverlay', 'HospitalPanel', 260)).pop();
  const held = await count('HospitalOverlay');
  judge('M2-1', '淡出未完就重开，稳定后场上只剩一层遮罩（旧的自己退场）', held === 1, `count=${held}`);
  judge('M2-2', '重开后同样复位到 255 / 缩放 1（不会卡在半路）', tail.op === 255 && tail.scale === 1, JSON.stringify(tail));

  console.log('\n=== 3. 关闭中途截一张（采样与截图并行，肉眼复核淡出画面没有闪烁） ===');
  const fadeSeq = await timeline('HospitalOverlay', 'HospitalPanel', 700, 'HospitalClose');
  await shot(`${OUT}-1-fading-out`);
  const dim = fadeSeq.filter((s) => s.alive && s.op < 255);
  const lowest = dim.length ? Math.min(...dim.map((s) => s.op)) : null;
  judge(
    'M3',
    '淡出过程中采到连续半透明（截图与采样并行，截图仅供参考）',
    dim.length >= 1,
    `半透明样本=${dim.slice(0, 5).map((s) => `${s.t}ms/${Math.round(s.op)}`).join(' ')}；最低=${lowest === null ? '无' : Math.round(lowest)}`,
  );
  await sleep(800);
  await click('HospitalButton');
  if (!(await waitFor('HospitalPanel'))) throw new Error('医院面板没能再开');
  await sleep(700);
  await shot(`${OUT}-2-hospital-settled`);
  await click('HospitalClose');
  await sleep(800);

  console.log('\n=== 4. 后院面板 ===');
  await cycle('M4', '后院', 'GardenOverlay', 'GardenPanel', 'GardenButton', 'GardenClose');

  console.log('\n=== 5. 小屋面板 ===');
  await cycle('M5', '小屋', 'HabitatOverlay', 'HabitatPanel', 'HabitatButton', 'HabitatClose');

  console.log('\n=== 6. 护理面板（从小屋卡片小键进，遮罩嵌在小屋遮罩里） ===');
  await openHabitat();
  await sleep(900);
  await cycle('M6', '护理', 'CareOverlay', 'CarePanel', 'HabitatAction_Care_pet_husky', 'CareClose', 'tap');
  await click('HabitatClose');
  await sleep(900);

  console.log('\n=== 7. 送养面板 ===');
  await openHabitat();
  await sleep(900);
  await cycle('M7', '送养', 'RehomeOverlay', 'RehomePanel', 'HabitatAction_Rehome_pet_husky', 'RehomeClose', 'tap');
  await click('HabitatClose');
  await sleep(900);

  console.log('\n=== 8. 成就谱（卡片不是 addCard，无影子，只验遮罩淡入淡出 + 缩放） ===');
  await click('Tab_achieve');
  await sleep(900);
  await cycle('M8', '成就谱', 'AchievementOverlay', 'AchievementPanel', 'AchievementButton', 'AchievementClose');

  console.log('\n=== 9. 大厅 TAB 换页（④ 的另一半：交叉淡入不能被这次改动带崩） ===');
  const swap = await timeline('Dock_garden', 'Dock_garden', 600, 'Tab_garden');
  await sleep(800);
  const dockSettled = await opacityOf('Dock_garden');
  const half = swap.filter((s) => s.alive && s.op !== null && s.op < 255);
  judge('M9-1', '诊疗→后院换页中途仍采到半透明（原有交叉淡入还在跑）', half.length >= 1 && dockSettled === 255, `中途=${half.slice(0, 5).map((s) => `${s.t}ms/${Math.round(s.op)}`).join(' ')}；存活=${swap.filter((s) => s.alive).length}`);
  judge('M9-2', '换页落位后后院坞完全不透明（不留半透明灰块）', dockSettled === 255, `op=${dockSettled}`);
  await shot(`${OUT}-3-dock-garden`);

  const noisy = errors.filter((e) => !e.includes('apple-mobile-web-app-capable'));
  console.log('=== console errors (' + errors.length + ') ===');
  noisy.slice(0, 25).forEach((e) => console.log(e));
  judge('M10', '全程无红色报错', noisy.length === 0, `collected=${errors.length}`);

  report();
  cdp.close();
  process.exit(process.exitCode || 0);
})().catch((e) => {
  console.error('ABORT ' + (e.message || e));
  process.exit(1);
});
