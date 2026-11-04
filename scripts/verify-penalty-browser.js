// STATUS: implemented, W25 P2-A1 负反馈核验（CDP 驱动 web-mobile 构建，纯本地存档，不碰线上）
// 覆盖：误判按「一笔」计数（长擦不逐帧加）、跨过病灶的那一笔作废、诊断失误两档扣好感（2 次 −8 / 3 次 −15 且扣到 0 为止）、
// 1 次失误不到警戒线不弹提示、药不对症扣好感 + 心情（仅小屋有档时）+ 康复时长 ×2、错药一局只罚一次、
// 没选错药时康复时长按基准 20 秒。
// 用例说明：心情只作用于小屋已落档的个体（Q2 拍板），浏览器里要同时验证「有档掉心情 / 无档不掉心情」两条分支，
// 所以 A 档给糯米预先塞一条小屋记录（其余宠物一律不进 petsSeen 之外的档），B/C 档不塞小屋记录。
// 前置：本地起 web-mobile 构建静态服务 + headless Chrome 开 CDP 端口。
// 用法：node scripts/verify-penalty-browser.js <CDP端口> <站点端口> <截图前缀>
'use strict';

const fs = require('fs');
const path = require('path');

const CDP_PORT = Number(process.argv[2] || 9448);
const PORT = Number(process.argv[3] || 8095);
const OUT = process.argv[4] || 'penalty';
const SHOT_DIR = process.env.SHOT_DIR || 'build';
fs.mkdirSync(SHOT_DIR, { recursive: true });
const SITE = `http://127.0.0.1:${PORT}`;
const DAY = 86400000;
const T0 = Date.now();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const POOL = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../assets/bundles/cases/config/gacha.json'), 'utf8'),
).tiers.flatMap((t) => t.pets);

/** 三档用例：A=有小屋记录 + 2 次失误 + 错药重试；B=无小屋记录 + 3 次失误 + 全对；C=无小屋记录 + 1 次失误 + 错药。 */
const RUNS = [
  {
    key: 'A',
    petId: 'pet_poodle',
    petName: '糯米',
    lesionId: 'knee',
    habitat: true,
    affection: 30,
    expectMistakes: 2,
    tier: 'warn',
    strokes: [
      { from: [-210, -150], to: [-210, 150], steps: 8, label: '左侧整列' },
      { from: [-180, -170], to: [180, -170], steps: 14, label: '底部横擦' },
      { from: [-230, 150], to: [70, 20], steps: 10, label: '斜穿病灶' },
    ],
    wrong: { medicine: 1, bed: 1, time: 1, medicineName: '止痛药' },
    right: { medicine: 0, bed: 1, time: 0, medicineName: '关节营养' },
    dedupeRetry: true,
  },
  {
    key: 'B',
    petId: 'pet_golden',
    petName: '大黄',
    lesionId: 'hip',
    habitat: false,
    affection: 5,
    expectMistakes: 3,
    tier: 'harsh',
    strokes: [
      { from: [200, -150], to: [200, 150], steps: 8, label: '右侧整列' },
      { from: [-180, 170], to: [180, 170], steps: 8, label: '顶部横擦' },
      { from: [-200, 160], to: [-200, 40], steps: 8, label: '左下短擦' },
    ],
    right: { medicine: 0, bed: 1, time: 0, medicineName: '关节营养' },
    dedupeRetry: false,
  },
  {
    key: 'C',
    petId: 'pet_lop_rabbit',
    petName: '雪球',
    lesionId: 'molar',
    habitat: false,
    affection: 10,
    expectMistakes: 1,
    tier: 'none',
    strokes: [{ from: [-210, -150], to: [-210, 150], steps: 8, label: '左侧整列' }],
    wrong: { medicine: 1, bed: 1, time: 1, medicineName: '止痛药' },
    right: { medicine: 0, bed: 1, time: 0, medicineName: '磨牙棒' },
    dedupeRetry: false,
  },
];

const WARN_TEXT = '诊断失误 2 次，宠物受了不少折腾，好感度 −8';
const HARSH_TEXT = '连续失误 3 次，病情恶化，好感度 −15';
const WRONG_MOOD_TEXT = '药不对症、心情 −20，好感度 −5，康复时间 ×2';
const WRONG_PLAIN_TEXT = '药不对症，好感度 −5，康复时间 ×2';

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

// 云函数 mock：本单只走本地存档，login/getConfig 走通即可，绝不发真实请求。
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
const FINDCOMP = `(nm) => { const walk = (n) => { const c = n.getComponent(nm); if (c) return c; for (const ch of n.children) { const r = walk(ch); if (r) return r; } return null; }; const s = cc.director.getScene(); return s ? walk(s) : null; }`;
const SCENE = `(() => { const s = window.cc && cc.director.getScene(); return s ? s.name : 'none'; })()`;

function seedSave(run) {
  const habitat = run.habitat
    ? [
        {
          petId: run.petId,
          hunger: 70,
          cleanliness: 70,
          mood: 70,
          birthTimestamp: T0 - 100 * DAY,
          lastDecayAt: T0,
          soothedDay: '',
        },
      ]
    : [];
  return JSON.stringify({
    coins: 20000,
    hearts: 8,
    // 除目标外全部记为「已遇见」：抽到别人只会走「再寻访一次」，抽到目标才出「立即接诊」。
    petsSeen: POOL.filter((id) => id !== run.petId),
    petsAdopted: [],
    habitat,
    affection: { [run.petId]: run.affection },
    medicines: { 关节营养: 3, 止痛药: 3, 观察: 3, 静养: 3, 磨牙棒: 3 },
    bestStars: {},
    casesDone: 3,
    items: {},
    hospitalLevel: 1,
    bedsOccupied: 0,
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
    width: 720,
    height: 1280,
    deviceScaleFactor: 2,
    mobile: true,
    screenWidth: 720,
    screenHeight: 1280,
  });
  await cdp.call('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  await cdp.call('Page.addScriptToEvaluateOnNewDocument', { source: BOOT_SCRIPT });

  const errors = [];
  cdp.on('Runtime.exceptionThrown', (p) => {
    const d = (p.exceptionDetails || {}).exception || {};
    errors.push(String(d.description || '?').slice(0, 200));
  });

  const ev = (expr) =>
    cdp.call('Runtime.evaluate', { expression: expr, returnByValue: true }).then((r) => {
      if (r.exceptionDetails) {
        console.log('EV-THROW: ' + String(r.exceptionDetails.text + ' ' + ((r.exceptionDetails.exception || {}).description || '')).slice(0, 200));
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
  const waitComp = async (nm, ms = 12000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (await ev(`!!(${FINDCOMP})('${nm}')`)) return true;
      await sleep(150);
    }
    return false;
  };
  /** 纸箱节点从挂舞台起就存在，只能靠提示文字判断是否进入「可拍箱」阶段。 */
  const waitForText = async (nm, sub, ms = 8000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (String(await label(nm)).includes(sub)) return true;
      await sleep(120);
    }
    return false;
  };
  const click = (nm) => ev(`(() => { const n = (${FIND})('${nm}'); if (!n) return 0; n.emit('click'); return 1; })()`);
  const tapNode = (nm) =>
    ev(`(() => { const n = (${FIND})('${nm}'); if (!n) return 0; const e = { getUILocation: () => ({ x: 0, y: 0 }) };
      n.emit('touch-start', e); n.emit('touch-end', e); return 1; })()`);
  const label = (nm) =>
    ev(`(() => { const n = (${FIND})('${nm}'); const c = n && n.getComponent('cc.Label'); return c ? c.string : null; })()`);
  const saveField = (expr) =>
    ev(`(() => { const s = JSON.parse(localStorage.getItem('pet_save_v1')); return (${expr}); })()`);
  const affection = (petId) => saveField(`s.affection['${petId}'] ?? null`);
  const mood = (petId) => saveField(`(s.habitat.find((x) => x.petId === '${petId}') || {}).mood ?? null`);
  const medStock = (name) => saveField(`s.medicines['${name}'] ?? null`);
  let vh = 1280;
  const css = (p) => ({ x: p.x, y: vh - p.y });
  const touch = async (type, p) =>
    cdp.call('Input.dispatchTouchEvent', {
      type,
      touchPoints: p ? [{ x: Math.round(p.x), y: Math.round(p.y), id: 1, radiusX: 4, radiusY: 4, force: 1 }] : [],
    });
  const drag = async (from, to, steps) => {
    await touch('touchStart', css(from));
    for (let i = 1; i <= steps; i += 1) {
      const p = { x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps };
      await touch('touchMove', css(p));
      await sleep(35);
    }
    await touch('touchEnd', null);
    await sleep(140);
  };
  const shot = async (name) => {
    const img = await cdp.call('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`${SHOT_DIR}/${name}.png`, Buffer.from(img.data, 'base64'));
    console.log('shot', name);
  };

  /** 胶片局部坐标 → 屏幕 CSS 坐标（用 UITransform 反查，板子若有缩放也能对上）。 */
  const localToWorld = (x, y) =>
    ev(`(() => { const g = (${FINDCOMP})('Xray'); if (!g || !g.board) return null;
      const ui = g.board.getComponent('cc.UITransform');
      const w = ui.convertToWorldSpaceAR(new cc.Vec3(${x}, ${y}, 0));
      return { x: w.x, y: w.y }; })()`);
  const lesionWorld = (id) =>
    ev(`(() => { const g = (${FINDCOMP})('Xray'); const n = g && g.board && g.board.children.find((c) => c.name === 'Lesion_${id}');
      if (!n) return null; const w = n.getWorldPosition(); return { x: w.x, y: w.y }; })()`);
  const xrayInfo = () =>
    ev(`(() => { const g = (${FINDCOMP})('Xray'); if (!g) return null;
      return { finished: g.finished, settling: g.settling, mistakes: g.strokes.mistakes, tol: g.tolerance,
        done: g.lesions.filter((l) => l.done).length, total: g.lesions.length, timeLeft: Math.round(g.timeLeft) }; })()`);
  /** 笔迹结算即时反馈走 Hint（不是 Toast），这里只回读页面文字。 */
  const hint = () => label('Hint');
  /** Toast 只活 2.6 秒，跨页那一下很容易错过；页面内埋 50ms 采样器，把出现过的文案全部记下来。 */
  const installToastSpy = () =>
    ev(`(() => {
      window.__toastLog = [];
      if (window.__toastSpy) clearInterval(window.__toastSpy);
      const find = (nm) => { const walk = (n) => { if (n.name === nm) return n; for (const c of n.children) { const r = walk(c); if (r) return r; } return null; };
        const s = cc.director.getScene(); return s ? walk(s) : null; };
      window.__toastSpy = setInterval(() => {
        const n = find('ToastLabel'); const c = n && n.getComponent('cc.Label'); if (!c) return;
        const last = window.__toastLog[window.__toastLog.length - 1];
        if (!last || last.text !== c.string) window.__toastLog.push({ t: Date.now(), text: c.string });
      }, 50);
      return 1; })()`);
  const toastLog = () => ev('window.__toastLog || []');
  const clearToastLog = () => ev('window.__toastLog = [], 1');
  const waitNoToast = async (ms) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (!(await has('ToastLabel'))) return true;
      await sleep(150);
    }
    return false;
  };

  async function boot(run) {
    // `pet_api_base_v1='off'`：用例必须显式关掉自建 HTTP 通路，否则会打到真后端且浏览器无 wx.request。
    await ev(`localStorage.setItem('pet_cloud_env_v1','mock-env-id');
      localStorage.setItem('pet_api_base_v1','off');
      localStorage.setItem('pet_save_v1', ${JSON.stringify(seedSave(run))});
      localStorage.setItem('pet_privacy_v1', JSON.stringify({ privacyAccepted: true, acceptedVersion: '1.0.1', guestMode: false }));
      location.replace('${SITE}/index.html?qa=penalty-${run.key}');`);
    for (let i = 0; i < 160; i++) {
      await sleep(200);
      if ((await ev(SCENE)) === 'Lobby') break;
    }
    const scene = await ev(SCENE);
    if (scene !== 'Lobby') throw new Error(`未进入 Lobby（当前场景=${scene}）`);
    await sleep(4200);
    vh = await ev('cc.view.getVisibleSize().height');
    await installToastSpy();
  }

  /** P1-A 入口：大厅主按钮 → 街头寻访 → 抽到目标宠立即接诊。 */
  async function intake(run) {
    const READY = '花点金币';
    const SEARCH = '点一点纸箱';
    let rolls = 0;
    if (!(await click('StartButton'))) throw new Error('StartButton 不存在');
    if (!(await waitForText('GachaHint', READY, 15000))) throw new Error('寻访出价区没就绪');
    for (;;) {
      if (rolls >= 150) throw new Error('抽不到目标宠（已达 150 次上限）');
      // GachaOffer 只切 active，节点一直存在；phase 守卫在 GachaFlow 里，靠提示文字判相位。
      await click('GachaPay');
      rolls += 1;
      if (!(await waitForText('GachaHint', SEARCH, 8000))) throw new Error('没进入拍箱阶段');
      await click('GachaBox');
      if (!(await waitFor('GachaName', 8000))) throw new Error('结果卡没出来');
      const name = await label('GachaName');
      const primary = await label('GachaPrimaryLabel');
      if (name === run.petName && primary === '立即接诊') {
        await click('GachaPrimary');
        judge(`${run.key}00`, `寻访 ${rolls} 次后抽到 ${run.petName} 并进入接诊`, (await waitFor('AcceptButton', 12000)) === true, `抽卡次数=${rolls}`);
        await click('AcceptButton');
        if (!(await waitFor('XrayBoard', 12000))) throw new Error('没进拍片页');
        return;
      }
      console.log(`  roll#${rolls} ${name}（${primary}）`);
      if (primary === '立即接诊') {
        // 兜底：目标之外的新宠会直接翻页，先回大厅再重开面板。
        await click('GachaSecondary');
        await sleep(600);
        await click('StartButton');
        if (!(await waitForText('GachaHint', READY, 12000))) throw new Error('重开面板后出价区没就绪');
        continue;
      }
      await click('GachaPrimary');
      if (!(await waitForText('GachaHint', READY, 10000))) throw new Error('再寻访一次后没回到出价区');
    }
  }

  /** 拍片：先按用例逐笔画「远离病灶」的整笔，再围绕病灶擦到显影。 */
  async function driveXray(run) {
    await ev('window.__diags = [], 1');
    await ev(`(() => { const g = (${FINDCOMP})('Xray'); if (!g || typeof g.onFinish !== 'function' || g.__armed) return;
      g.__armed = true; const inner = g.onFinish;
      g.onFinish = (r) => { (window.__diags = window.__diags || []).push(r); window.__toastLog = []; return inner && inner(r); }; })()`);
    const marks = [];
    for (const stroke of run.strokes) {
      const a = await localToWorld(stroke.from[0], stroke.from[1]);
      const b = await localToWorld(stroke.to[0], stroke.to[1]);
      if (!a || !b) throw new Error('胶片取世界坐标失败');
      await drag(a, b, stroke.steps);
      const st = await xrayInfo();
      const text = await hint();
      marks.push({ label: stroke.label, mistakes: st ? st.mistakes : null, hint: text, timeLeft: st ? st.timeLeft : null });
      console.log(`  stroke「${stroke.label}」${stroke.steps} 采样 → 误判 ${st && st.mistakes} 次　Hint=${text}　剩余 ${st && st.timeLeft}ms`);
      if (st && st.finished) break;
    }
    for (let guard = 0; guard < 6; guard += 1) {
      const before = await xrayInfo();
      if (!before || before.finished || before.done >= before.total) break;
      const w = await lesionWorld(run.lesionId);
      if (!w) throw new Error(`取不到病灶节点 Lesion_${run.lesionId}`);
      for (const dy of [-26, 0, 26]) {
        await drag({ x: w.x - 95, y: w.y + dy }, { x: w.x + 95, y: w.y + dy }, 9);
      }
      const after = await xrayInfo();
      console.log(`  scrub#${guard} 显影 ${after ? `${after.done}/${after.total}` : '页面已推进'} 误判 ${after ? after.mistakes : '-'} 剩余 ${after ? after.timeLeft : '-'}ms`);
    }
    return marks;
  }

  async function selectPlan(plan) {
    await tapNode(`Medicine${plan.medicine}`);
    await sleep(240);
    await tapNode(`Bed${plan.bed}`);
    await sleep(240);
    await tapNode(`Time${plan.time}`);
    await sleep(240);
  }

  console.log(`\n### 抽卡池 ${POOL.length} 只，目标宠按名字判定；基准时刻 T0=${new Date(T0).toISOString()}`);

  for (const run of RUNS) {
    console.log(`\n=== 用例 ${run.key}：${run.petName}（${run.petId}，小屋记录 ${run.habitat ? '有' : '无'}，好感度初始 ${run.affection}）===`);
    await boot(run);
    await intake(run);
    const marks = await driveXray(run);

    const last = marks[marks.length - 1] || {};
    const strokeOne = marks[0] || {};
    judge(
      `${run.key}01`,
      '一笔远离病灶的整笔只记 1 次误判，并当场提示',
      strokeOne.mistakes === 1 && String(strokeOne.hint).includes('误判 1 次'),
      JSON.stringify(strokeOne),
    );
    if (run.key === 'A') {
      const second = marks[1] || {};
      judge(
        'A02',
        '14 采样的长擦仍然只加 1 次误判（按笔计数，不逐帧累加）',
        second.mistakes === 2,
        JSON.stringify(second),
      );
      const third = marks[2] || {};
      judge(
        'A03',
        '起点在远处、终点跨过病灶的一笔不记误判（markNear 作废，计数仍为 2）',
        third.mistakes === 2,
        JSON.stringify(third),
      );
    }

    const reached = await waitFor('ConfirmButton', 20000);
    if (!reached) throw new Error('用例 ' + run.key + '：诊断完成后没进治疗页');
    const diags = await ev('window.__diags || []');
    const record = diags[diags.length - 1] || {};
    judge(
      `${run.key}04`,
      `拍片通关回传的误判数 = ${run.expectMistakes}（星级判定与惩罚同源）`,
      record.completed === true && record.mistakes === run.expectMistakes,
      JSON.stringify(record),
    );

    // onFinish 时日志刚清空，这里读到的一定是「诊断结束 → 治疗页」这一段出现过的 Toast。
    await sleep(400);
    const noticeLog = await toastLog();
    const expectTierText = run.tier === 'harsh' ? HARSH_TEXT : run.tier === 'warn' ? WARN_TEXT : '';
    judge(
      `${run.key}05`,
      run.tier === 'none' ? '1 次失误未到警戒线：治疗页不弹任何负反馈提示' : `治疗页 Toast 文案与 ${run.tier} 档完全一致`,
      run.tier === 'none'
        ? noticeLog.some((e) => /诊断失误|连续失误|病情恶化/.test(e.text)) === false
        : noticeLog.some((e) => e.text === expectTierText),
      `日志=${JSON.stringify(noticeLog)}　Hint=${await hint()}`,
    );
    const affAfterDiagnosis = await affection(run.petId);
    const expectAffection =
      run.tier === 'harsh' ? Math.max(0, run.affection - 15) : run.tier === 'warn' ? run.affection - 8 : run.affection;
    judge(
      `${run.key}06`,
      `诊断失误落账好感度 ${run.affection} → ${expectAffection}`,
      affAfterDiagnosis === expectAffection,
      `实际=${affAfterDiagnosis}`,
    );
    if (run.key === 'B') {
      judge('B07', '3 次失误按重罚，5 点好感扣到 0 为止（不出现负数）', affAfterDiagnosis === 0, `好感度=${affAfterDiagnosis}`);
      judge('B08', '小屋没有该宠记录：不写心情字段（只扣好感）', (await mood(run.petId)) === null, `mood=${await mood(run.petId)}`);
    }
    await shot(`${OUT}-${run.key}-treatment-notice`);

    if (run.wrong) {
      await waitNoToast(5000);
      const stockBefore = await medStock(run.wrong.medicineName);
      const moodBefore = await mood(run.petId);
      const affBefore = await affection(run.petId);
      await selectPlan(run.wrong);
      const planText = await label('Status');
      await clearToastLog();
      await click('ConfirmButton');
      await sleep(500);
      const failTitle = await label('ChoiceTitle');
      judge(
        `${run.key}10`,
        '错药 + 错时间只拿 1/3，普通/紧急门槛 2 → 进失败兜底面板',
        failTitle === '治疗评分 1/3，还差一点',
        `面板=${failTitle}　方案=${planText}`,
      );
      await sleep(600);
      const wrongLog = await toastLog();
      const expectWrongText = run.habitat ? WRONG_MOOD_TEXT : WRONG_PLAIN_TEXT;
      judge(
        `${run.key}11`,
        run.habitat
          ? '错药提示带心情：药不对症、心情 −20，好感度 −5，康复时间 ×2'
          : '错药提示不带心情段（小屋没这条记录就不写心情）',
        wrongLog.some((e) => e.text === expectWrongText),
        `日志=${JSON.stringify(wrongLog)}`,
      );
      const moodAfter = await mood(run.petId);
      const affAfter = await affection(run.petId);
      const stockAfter = await medStock(run.wrong.medicineName);
      judge(
        `${run.key}12`,
        run.habitat ? `心情 ${moodBefore} → ${moodBefore - 20} 且好感 ${affBefore} → ${affBefore - 5}` : `心情保持 ${moodBefore}（无记录不扣）且好感 ${affBefore} → ${affBefore - 5}`,
        run.habitat ? moodAfter === moodBefore - 20 && affAfter === affBefore - 5 : moodAfter === null && affAfter === affBefore - 5,
        `mood=${moodAfter} 好感=${affAfter}`,
      );
      judge(
        `${run.key}13`,
        `失败也照常消耗选中的药：${run.wrong.medicineName} ${stockBefore} → ${stockAfter}`,
        stockAfter === stockBefore - 1,
        `chip=${await label(`Medicine${run.wrong.medicine}Label`)}`,
      );
      await shot(`${OUT}-${run.key}-treatment-wrong-medicine`);

      if (run.dedupeRetry) {
        await click('ChoiceAction0');
        await sleep(3400);
        const affMid = await affection(run.petId);
        const moodMid = await mood(run.petId);
        const stockMid = await medStock(run.wrong.medicineName);
        await selectPlan(run.wrong);
        await clearToastLog();
        await click('ConfirmButton');
        await sleep(3200);
        const retryLog = await toastLog();
        judge(
          'A15',
          '同一局二次错药不重复惩罚：没有新 Toast，心情/好感原地不动',
          retryLog.some((e) => /药不对症/.test(e.text)) === false && (await mood(run.petId)) === moodMid && (await affection(run.petId)) === affMid,
          `日志=${JSON.stringify(retryLog)}　mood=${await mood(run.petId)}　好感=${await affection(run.petId)}`,
        );
        judge(
          'A16',
          `重试照常扣库存：${run.wrong.medicineName} ${stockMid} → ${await medStock(run.wrong.medicineName)}`,
          (await medStock(run.wrong.medicineName)) === stockMid - 1,
          `chip=${await label(`Medicine${run.wrong.medicine}Label`)}`,
        );
      }

      await click('ChoiceAction0');
      await sleep(500);
    }

    const rightStockBefore = await medStock(run.right.medicineName);
    await selectPlan(run.right);
    await click('ConfirmButton');
    if (!(await waitComp('Recovery', 12000))) throw new Error('用例 ' + run.key + '：没进康复页');
    const seconds = await ev(`(() => { const r = (${FINDCOMP})('Recovery'); return r ? r.seconds : null; })()`);
    const hintText = await label('Hint');
    const expectSeconds = run.wrong ? 40 : 20;
    judge(
      `${run.key}20`,
      run.wrong ? '错药后康复时长按 ×2 拉长：40 秒' : '没选错药时康复时长按基准 20 秒（倍数保持 1）',
      seconds === expectSeconds && /秒康复完成/.test(String(hintText)) && String(hintText).includes(String(expectSeconds)),
      `seconds=${seconds}　Hint=${hintText}`,
    );
    judge(
      `${run.key}21`,
      `对症药 ${run.right.medicineName} 库存 ${rightStockBefore} → ${await medStock(run.right.medicineName)}`,
      (await medStock(run.right.medicineName)) === rightStockBefore - 1,
      `stock=${await medStock(run.right.medicineName)}`,
    );
    await shot(`${OUT}-${run.key}-recovery`);
  }

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
