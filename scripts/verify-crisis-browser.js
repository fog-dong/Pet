// STATUS: implemented, W25 P2-A3 危重倒计时 / 转院失败 / 口碑记账核验（CDP 驱动 web-mobile 构建，纯本地存档，不碰线上）
// 覆盖两条触发源与一套终局账目：
//   A「诊断恶化」= 连续失误 3 次 → 危急度上调一档（紧急 2/3 门槛被抬成危重 3/3）→ 抢救红条在治疗页倒数；
//     切后台暂停（把时间整段拨过窗口也不归零）、回前台继续、运行中拨 100 秒要真的少 100 秒；
//     治对以后红条随页销毁、康复时长按基准 20 秒、结算走成功终局（金币爱心照常进账、不出现转院文案）；
//     种子塞非法负数口碑：解码必须归零，成功只按本局星级加一次，并随 saveGame 快照上报。
//   B「重试用尽」= 同一局第 3 次治疗仍不达标 → 当场进入抢救窗口 → 时间拨到归零自动转院：
//     结算页只有转院终局文案、按比例退药（3 份退 1）、爱心 −2 且扣到 0 为止、金币一分不进、
//     星级不落 bestStars、床位不凭空多也不凭空少；口碑 −1 同样扣到 0 为止并随快照上报。
// 时间不是真等：时钟只认 Date.now，所以页内给 Date.now 加一个可累加的偏移量（window.__bias），
// 不碰生产代码、不给发布包留调试钩子。
// 可选项：EXPECT_COUNTDOWN + ONLY + PARTIAL 用来跑「配置通路探针」——把 build/ 里打包的 penalty 资源
// 改成别的秒数再跑 A 的前半段。兜底常量与配置文件逐项同值，只读运行时 180 秒证明不了读的是配置。
// 前置：本地起 web-mobile 构建静态服务 + headless Chrome 开 CDP 端口。
// 用法：node scripts/verify-crisis-browser.js <CDP端口> <站点端口> <截图前缀>
'use strict';

const fs = require('fs');
const path = require('path');

const CDP_PORT = Number(process.argv[2] || 9448);
const PORT = Number(process.argv[3] || 8095);
const OUT = process.argv[4] || 'crisis';
const SHOT_DIR = process.env.SHOT_DIR || 'build';
const EXPECT_COUNTDOWN = Number(process.env.EXPECT_COUNTDOWN || 180);
const PARTIAL = process.env.PARTIAL === '1';
const ONLY = (process.env.ONLY || 'A,B').split(',').map((s) => s.trim());
fs.mkdirSync(SHOT_DIR, { recursive: true });
const SITE = `http://127.0.0.1:${PORT}`;
const T0 = Date.now();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const POOL = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../assets/bundles/cases/config/gacha.json'), 'utf8'),
).tiers.flatMap((t) => t.pets);

/** 两档用例都走同一只宠物（大黄 / case_dog_010，紧急度 urgent、单段拍片），差别只在诊断失误数与治疗方案。 */
const RUNS = [
  {
    key: 'A',
    petName: '大黄',
    petId: 'pet_golden',
    caseId: 'case_dog_010',
    lesionId: 'hip',
    affection: 5,
    hearts: 8,
    // 故意种一个非法负值：解码必须归零，成功结算只按本局星级加一次。
    reputation: -5,
    // 3 笔远离病灶的整笔 = 3 次误判 → harsh 档恶化升档；随后擦到显影才通关。
    strokes: [
      { from: [200, -150], to: [200, 150], steps: 8, label: '右侧整列' },
      { from: [-180, 170], to: [180, 170], steps: 8, label: '顶部横擦' },
      { from: [-200, 160], to: [-200, 40], steps: 8, label: '左下短擦' },
    ],
    expectMistakes: 3,
    /** 药对 + 床对 + 时间错 = 2/3：升档前（紧急门槛 2）能过，升档后（危重门槛 3）必须失败。 */
    fail: { medicine: 0, bed: 1, time: 1, title: '治疗评分 2/3，危重病例需要 3/3 全对' },
    right: { medicine: 0, bed: 1, time: 0 },
  },
  {
    key: 'B',
    petName: '大黄',
    petId: 'pet_golden',
    caseId: 'case_dog_010',
    lesionId: 'hip',
    affection: 10,
    hearts: 1,
    // 只有 1 点口碑：转院扣 1 分到 0 为止，正好把「差评上墙」和「不扣成负数」一起验掉。
    reputation: 1,
    // 只在病灶上来回擦：0 次误判，开局不进危重，把「重试用尽」这条触发源单独隔离出来。
    strokes: [],
    expectMistakes: 0,
    /** 药错 + 床对 + 时间错 = 1/3，紧急门槛 2 也过不去；连吃三次即重试用尽。 */
    fail: { medicine: 1, bed: 1, time: 1, title: '治疗评分 1/3，还差一点' },
    crisisTitle: '治疗评分 1/3，重试用尽',
    failTimes: 3,
  },
].filter((run) => ONLY.includes(run.key));

const CRISIS_PAUSED = '危重抢救 · 已暂停（回到游戏继续倒计时）';
const HARSH_TEXT = '连续失误 3 次，病情恶化，好感度 −15';
const TRANSFER_SUMMARY = '大黄 病情恶化，已被转去上级医院';
const SUCCESS_SUMMARY = '大黄 又能摇尾巴了';
const NOT_ADOPTED = '本次未领养，可以稍后再来';

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
      // 记下每次调用的入参：口碑进不进 saveGame 快照，只能从真实出参里验，不能只看本地存档。
      callFunction(opt) { (window.__calls || (window.__calls = [])).push({ name: opt.name, data: opt.data }); return Promise.resolve({ result: reply(opt.name) }); },
    },
  };
})()`;

const FIND = `(nm) => { const find = (n) => { if (n.name === nm) return n; for (const c of n.children) { const r = find(c); if (r) return r; } return null; }; const s = cc.director.getScene(); return s ? find(s) : null; }`;
const FINDCOMP = `(nm) => { const walk = (n) => { const c = n.getComponent(nm); if (c) return c; for (const ch of n.children) { const r = walk(ch); if (r) return r; } return null; }; const s = cc.director.getScene(); return s ? walk(s) : null; }`;
const SCENE = `(() => { const s = window.cc && cc.director.getScene(); return s ? s.name : 'none'; })()`;

function seedSave(run) {
  return JSON.stringify({
    coins: 20000,
    hearts: run.hearts,
    // P2-A3：口碑是本地权威值，种子故意给非法/极小值来验解码与扣量下限。
    reputation: run.reputation,
    petsSeen: POOL.filter((id) => id !== run.petId),
    petsAdopted: [],
    habitat: [],
    affection: { [run.petId]: run.affection },
    medicines: { 关节营养: 3, 止痛药: 5, 静养: 3, 观察: 3 },
    bestStars: {},
    // 床位初始占用 = casesDone % (beds+1)，取 0 保证「住院」不会撞满床。
    casesDone: 0,
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

  const ev = (expr, awaitPromise = false) =>
    cdp.call('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise }).then((r) => {
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
  const waitForText = async (nm, sub, ms = 8000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (String(await label(nm)).includes(sub)) return true;
      await sleep(120);
    }
    return false;
  };
  /** 全树扫描版：面板重开时旧遮罩可能还排在前面，只看第一个匹配节点会读到过期标签。 */
  const waitForAnyText = async (nm, sub, ms = 8000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const hit = await ev(
        `(() => { let ok = false; const walk = (n) => { if (n.name === '${nm}') { const l = n.getComponent('cc.Label');
          if (l && l.string.indexOf('${sub}') >= 0) ok = true; } for (const c of n.children) walk(c); };
          const s = cc.director.getScene(); if (s) walk(s); return ok; })()`,
      );
      if (hit) return true;
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
  /** 同一帧里一次读多个标签：面板与红条各读一次会跨帧，秒数就对不上。 */
  const labels = (names) =>
    ev(
      `(() => { const f = ${FIND}; return { ${names
        .map((n) => `'${n}': (() => { const c = f('${n}'); const l = c && c.getComponent('cc.Label'); return l ? l.string : null; })()`)
        .join(', ')} }; })()`,
    );
  const saveField = (expr) =>
    ev(`(() => { const s = JSON.parse(localStorage.getItem('pet_save_v1')); return (${expr}); })()`);
  const affection = (petId) => saveField(`s.affection['${petId}'] ?? null`);
  const medStock = (name) => saveField(`s.medicines['${name}'] ?? null`);
  const coins = () => saveField('s.coins');
  const hearts = () => saveField('s.hearts');
  const reputation = () => saveField('s.reputation ?? null');
  /** 最近一次 saveGame 的快照：口碑要跟着快照上报，只看本地存档证明不了这条腿。 */
  const lastSaveSnapshot = () =>
    ev(`(() => { const c = (window.__calls || []).filter(x => x.name === 'saveGame').pop(); return c ? c.data.snapshot : null; })()`);
  const beds = () => saveField('s.bedsOccupied');
  const bestStars = (caseId) => saveField(`s.bestStars['${caseId}'] ?? null`);
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

  /** 时钟偏移量：只包 Date.now，暂停累计与剩余量全部由生产实现算。 */
  const installClockBias = () =>
    ev(`(() => { if (window.__biasOn) return 1; window.__bias = 0;
      const real = Date.now.bind(Date); Date.now = () => real() + (window.__bias || 0); window.__biasOn = 1; return 1; })()`);
  const warp = (ms) => ev(`window.__bias += ${ms}; window.__bias`);
  const unwarp = () => ev('window.__bias = 0, 0');

  /** 红条节点：-1 = 本页没挂（治疗页之外都该是 -1），0 = 挂了但隐藏（危重未启动），1 = 正在显示。 */
  const barState = () => ev(`(() => { const n = (${FIND})('CrisisHud'); return n ? (n.activeInHierarchy ? 1 : 0) : -1; })()`);
  const barText = () => label('CrisisLabel');
  const barSeconds = async () => {
    const m = String(await barText()).match(/剩 (\d+)s/);
    return m ? Number(m[1]) : null;
  };
  /** 一次 evaluate 读齐红条三件事：分三次读会跨帧，可见性与秒数就对不上。 */
  const barInfo = () =>
    ev(`(() => { const f = ${FIND}; const n = f('CrisisHud'); const l = n && f('CrisisLabel');
      const t = l ? l.getComponent('cc.Label').string : null; const m = t && t.match(/剩 (\\d+)s/);
      return { state: n ? (n.activeInHierarchy ? 1 : 0) : -1, text: t, seconds: m ? Number(m[1]) : null }; })()`);
  /** 切后台/回前台：走 cc.game 事件总线，命中的是 CrisisHud 自己注册的生产回调。 */
  const hideGame = () => ev("cc.game.emit('game_on_hide'), 1");
  const showGame = () => ev("cc.game.emit('game_on_show'), 1");

  /** 直接重读打包在 cases 分包里的 penalty 资源，作为「配置真的进了发布包」的独立证据。 */
  const bundledCrisis = () =>
    ev(
      `(() => new Promise((res) => { const b = cc.assetManager.getBundle('cases');
        if (!b) { res({ err: 'no-bundle' }); return; }
        b.load('config/penalty', cc.JsonAsset, (e, a) => {
          if (e || !a || !a.json || !a.json.crisis) { res({ err: String(e || 'empty') }); return; }
          res({ countdown: a.json.crisis.countdownSeconds, pauseOnHide: a.json.crisis.pauseOnHide,
            refundRatio: a.json.crisis.refundRatio, heartsPenalty: a.json.crisis.heartsPenalty,
            retryLimit: a.json.treatment ? a.json.treatment.retryLimit : null });
        }); }))()`,
      true,
    );

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
      return { finished: g.finished, mistakes: g.strokes.mistakes,
        done: g.lesions.filter((l) => l.done).length, total: g.lesions.length }; })()`);
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

  async function boot(run) {
    // `pet_api_base_v1='off'`：用例必须显式关掉自建 HTTP 通路，否则会打到真后端且浏览器没有 wx.request。
    // seedSave 已经 stringify 过一次，这里再套一层才是 JS 字符串字面量；少了这层就是 setItem(key, {...})，落盘 "[object Object]"。
    await ev(`localStorage.setItem('pet_cloud_env_v1','mock-env-id');
      localStorage.setItem('pet_api_base_v1','off');
      localStorage.setItem('pet_save_v1', ${JSON.stringify(seedSave(run))});
      localStorage.setItem('pet_privacy_v1', JSON.stringify({ privacyAccepted: true, acceptedVersion: '1.0.1', guestMode: false }));
      location.replace('${SITE}/index.html?qa=crisis-${run.key}');`);
    for (let i = 0; i < 160; i++) {
      await sleep(200);
      if ((await ev(SCENE)) === 'Lobby') break;
    }
    const scene = await ev(SCENE);
    if (scene !== 'Lobby') throw new Error(`未进入 Lobby（当前场景=${scene}）`);
    await sleep(4200);
    // 种子落没落上一眼就能看出来：默认新档是 500 金币 / 空图鉴，读到它就说明写盘姿势错了。
    const seeded = await saveField('[s.coins, (s.petsSeen || []).length, (s.medicines || {})["止痛药"] ?? -1]');
    if (!seeded || seeded[0] < 19000 || seeded[1] < POOL.length - 1 || seeded[2] !== 5) {
      throw new Error(`种子存档没落上（coins=${seeded && seeded[0]}，已见=${seeded && seeded[1]}，止痛药=${seeded && seeded[2]}）`);
    }
    vh = await ev('cc.view.getVisibleSize().height');
    await installToastSpy();
    await installClockBias();
  }

  /** P1-A 入口：大厅主按钮 → 街头寻访 → 抽到大黄立即接诊。 */
  async function intake(run) {
    const READY = '花点金币';
    const SEARCH = '点一点纸箱';
    let rolls = 0;
    /** 相位守卫在 GachaFlow 里，页内点击偶发丢一帧；重试并留诊断，别把抽卡抖动当成玩法故障。 */
    async function payAndSearch() {
      for (let attempt = 1; attempt <= 4; attempt += 1) {
        if (!(await click('GachaPay'))) throw new Error('GachaPay 节点不存在');
        if (await waitForAnyText('GachaHint', SEARCH, 6000)) return;
        console.log(`  支付重试 #${attempt}：当前提示「${await label('GachaHint')}」，台面金币 ${await label('GachaCoinsLabel')}`);
        await sleep(500);
      }
      throw new Error(`点支付进不了拍箱相位（提示停在「${await label('GachaHint')}」）`);
    }
    if (!(await click('StartButton'))) throw new Error('StartButton 不存在');
    if (!(await waitForAnyText('GachaHint', READY, 15000))) throw new Error('寻访出价区没就绪');
    for (;;) {
      if (rolls >= 150) throw new Error('抽不到目标宠（已达 150 次上限）');
      await payAndSearch();
      rolls += 1;
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
      if (rolls % 5 === 0) console.log(`  roll#${rolls} ${name}（${primary}）`);
      if (primary === '立即接诊') {
        // 兜底：目标之外的新宠会直接翻页，先回大厅再重开面板。
        await click('GachaSecondary');
        await sleep(900);
        await click('StartButton');
        if (!(await waitForAnyText('GachaHint', READY, 12000))) throw new Error('重开面板后出价区没就绪');
        continue;
      }
      await click('GachaPrimary');
      if (!(await waitForAnyText('GachaHint', READY, 10000))) throw new Error('再寻访一次后没回到出价区');
    }
  }

  /** 拍片：先按用例画「远离病灶」的整笔攒误判，再围绕病灶擦到全部显影。 */
  async function driveXray(run) {
    await ev('window.__diags = [], 1');
    await ev(`(() => { const g = (${FINDCOMP})('Xray'); if (!g || typeof g.onFinish !== 'function' || g.__armed) return;
      g.__armed = true; const inner = g.onFinish;
      g.onFinish = (r) => { (window.__diags = window.__diags || []).push(r); window.__toastLog = []; return inner && inner(r); }; })()`);
    for (const stroke of run.strokes) {
      const a = await localToWorld(stroke.from[0], stroke.from[1]);
      const b = await localToWorld(stroke.to[0], stroke.to[1]);
      if (!a || !b) throw new Error('胶片取世界坐标失败');
      await drag(a, b, stroke.steps);
      const st = await xrayInfo();
      console.log(`  stroke「${stroke.label}」→ 误判 ${st && st.mistakes} 次`);
      if (st && st.finished) break;
    }
    for (let guard = 0; guard < 8; guard += 1) {
      const before = await xrayInfo();
      if (!before || before.finished || before.done >= before.total) break;
      const w = await lesionWorld(run.lesionId);
      if (!w) throw new Error(`取不到病灶节点 Lesion_${run.lesionId}`);
      for (const dy of [-26, 0, 26]) {
        await drag({ x: w.x - 95, y: w.y + dy }, { x: w.x + 95, y: w.y + dy }, 9);
      }
      const after = await xrayInfo();
      console.log(`  scrub#${guard} 显影 ${after ? `${after.done}/${after.total}` : '页面已推进'} 误判 ${after ? after.mistakes : '-'}`);
    }
    const diags = await ev('window.__diags || []');
    const record = diags[diags.length - 1] || {};
    judge(
      `${run.key}01`,
      `拍片回传误判 ${run.expectMistakes} 次${run.expectMistakes === 0 ? '（0 次 = 诊断阶段不触发恶化）' : '（3 次 = harsh 档恶化升档）'}`,
      record.completed === true && record.mistakes === run.expectMistakes,
      JSON.stringify(record),
    );
  }

  async function selectPlan(plan) {
    await tapNode(`Medicine${plan.medicine}`);
    await sleep(240);
    await tapNode(`Bed${plan.bed}`);
    await sleep(240);
    await tapNode(`Time${plan.time}`);
    await sleep(240);
  }

  /** 危重启动的直接证据：治疗页红条可见，且倒数秒数落在窗口里。 */
  async function assertCrisisBar(id, tolerance = 3) {
    const bar = await barInfo();
    judge(
      id,
      `危重启动：治疗页红条可见，窗口 ${EXPECT_COUNTDOWN}s 起倒数（容差 ${tolerance}s）`,
      bar.state === 1 && bar.seconds !== null
        && bar.seconds <= EXPECT_COUNTDOWN
        && bar.seconds >= EXPECT_COUNTDOWN - tolerance
        && /^危重抢救 · 剩 \d+s$/.test(String(bar.text)),
      `active=${bar.state}　剩余=${bar.seconds}s　文案=${bar.text}`,
    );
    const config = await bundledCrisis();
    judge(
      `${id}b`,
      '发布包里的 penalty 资源带着同一组危重数值（配置确实进了包，不是只有代码兜底）',
      !!config && config.countdown === EXPECT_COUNTDOWN && config.pauseOnHide === true && config.refundRatio === 0.5 && config.heartsPenalty === 2 && config.retryLimit === 3,
      JSON.stringify(config),
    );
    return bar.seconds;
  }

  console.log(
    `\n### 危重核验：期望窗口 ${EXPECT_COUNTDOWN}s，用例=${ONLY.join('/')}，PARTIAL=${PARTIAL ? '1（只跑到红条与配置通路）' : '0（跑完整终局）'}；基准时刻 ${new Date(T0).toISOString()}`,
  );

  for (const run of RUNS) {
    console.log(`\n=== 用例 ${run.key}：${run.petName}（${run.caseId}，紧急度 urgent，爱心初始 ${run.hearts}）===`);
    await boot(run);
    await intake(run);
    await driveXray(run);
    if (!(await waitFor('ConfirmButton', 25000))) throw new Error(`用例 ${run.key}：诊断完成后没进治疗页`);
    await sleep(400);
    const coinsAtCase = await coins();
    // 抽卡的重复奖励会往爱心上加钱，所以账目基线必须取「进这一局时」而不是种子里那个数。
    const heartsAtCase = await hearts();

    if (run.key === 'A') {
      const noticeLog = await toastLog();
      judge(
        'A02',
        '恶化提示落到治疗页：连续失误 3 次按重罚公示，好感扣到 0 为止',
        noticeLog.some((e) => e.text === HARSH_TEXT) && (await affection(run.petId)) === 0,
        `日志=${JSON.stringify(noticeLog)}　好感=${await affection(run.petId)}`,
      );
      // A 用例的时钟从拍片第 3 次误判起走，到治疗页已经走掉诊断收尾的几秒，所以这里给 20s 容差；
      // 「满窗起倒数」由 B 用例在治疗页内当场触发的那次断言严格证明。
      await assertCrisisBar('A03', 20);
      judge(
        'A03c',
        '升档要同步写进页面副标题：门槛已经抬到 3/3，副标题不能再写「紧急 · 至少选对 2/3」',
        (await label('SeverityLabel')) === '危重 · 药/床/时间必须全对（3/3）',
        `副标题=${await label('SeverityLabel')}`,
      );
      if (PARTIAL) {
        console.log('  PARTIAL：配置通路探针到此为止，不再走治疗');
        continue;
      }

      await hideGame();
      await sleep(500);
      const pausedText = String(await barText());
      const pausedSeconds = await barSeconds();
      await warp(EXPECT_COUNTDOWN * 1000 + 20000);
      await sleep(900);
      const stillPaused = String(await barText());
      judge(
        'A04',
        `切后台暂停：时间整段拨过窗口（+${EXPECT_COUNTDOWN * 1000 + 20000}ms）仍停在「已暂停」，没被判转院`,
        pausedText === CRISIS_PAUSED && stillPaused === CRISIS_PAUSED && (await barState()) === 1 && (await has('ConfirmButton')) === true,
        `暂停时=${pausedText}　拨针后=${stillPaused}`,
      );
      await showGame();
      await sleep(500);
      const resumed = await barSeconds();
      judge(
        'A05',
        `回前台继续倒数，暂停期间那 200s 不计：恢复后 ${resumed}s，仍接近满窗 ${EXPECT_COUNTDOWN}s`,
        resumed !== null && resumed > EXPECT_COUNTDOWN - 15,
        `暂停时文案读不到秒数=${pausedSeconds}　恢复后=${resumed}　文案=${await barText()}`,
      );
      await warp(100000);
      await sleep(600);
      const afterRun = await barSeconds();
      judge(
        'A06',
        `恢复运行后拨 100 秒要真的少 100 秒：${resumed}s → ${afterRun}s`,
        resumed !== null && afterRun !== null && afterRun <= resumed - 95 && afterRun >= resumed - 115,
        `文案=${await barText()}`,
      );
      await shot(`${OUT}-A-crisis-countdown`);
      // 后面还有治疗、康复与结算，把偏移收回真实时间，免得康复读秒与局时长被算长。
      await unwarp();

      await selectPlan(run.fail);
      await click('ConfirmButton');
      await sleep(900);
      const failTitle = await label('ChoiceTitle');
      judge(
        'A07',
        '升档把门槛真抬高了：2/3 在危重档判失败（未升档的紧急档本可过关）',
        failTitle === run.fail.title,
        `面板=${failTitle}`,
      );
      await shot(`${OUT}-A-escalated-threshold`);
      await click('ChoiceAction0');
      await sleep(500);

      await selectPlan(run.right);
      await click('ConfirmButton');
      if (!(await waitComp('Recovery', 12000))) throw new Error('用例 A：全对方案没进康复页');
      const seconds = await ev(`(() => { const r = (${FINDCOMP})('Recovery'); return r ? r.seconds : null; })()`);
      const barOnRecovery = await barState();
      judge(
        'A08',
        '治对即解除危机：康复页没有红条（随治疗页销毁），康复时长按基准 20 秒',
        barOnRecovery === -1 && seconds === 20,
        `红条节点=${barOnRecovery}　seconds=${seconds}`,
      );
      // 刚切进康复页还在淡入，立刻截会得到一帧纯底色；等一拍再截才看得出页面长什么样。
      await sleep(1500);
      await shot(`${OUT}-A-recovery`);
      // 初始提示「预计 20 秒康复完成」里也含「康复完成」，等它会把没走完的康复误判为完成；只认收尾那句。
      if (!(await waitForText('Hint', '可以进入领养', 40000))) throw new Error('用例 A：康复没走完');
      await click('AdoptButton');
      if (!(await waitFor('LaterButton', 12000))) throw new Error('用例 A：没到领养页');
      await click('LaterButton');
      if (!(await waitFor('PageTitle', 15000))) throw new Error('用例 A：没到结算页');
      await sleep(1200);
      const page = await labels(['PageTitle', 'Summary', 'Adopted', 'TransferNote']);
      judge(
        'A09',
        '抢救回来就是成功终局：文案「又能摇尾巴」，不出现转院说明',
        page.Summary === SUCCESS_SUMMARY && page.PageTitle === '今日救助' && page.TransferNote === null,
        `Summary=${page.Summary}　Title=${page.PageTitle}　TransferNote=${page.TransferNote}`,
      );
      const afterCoins = await coins();
      const afterHearts = await hearts();
      judge(
        'A10',
        `成功结算进账：金币 ${coinsAtCase} → ${afterCoins}，爱心 ${heartsAtCase} → ${afterHearts}`,
        afterCoins > coinsAtCase && afterHearts >= heartsAtCase,
        `coins=${afterCoins}　hearts=${afterHearts}`,
      );
      const rep = await reputation();
      judge(
        'A11',
        '口碑非法负值解码归零，成功结算只按本局星级入账一次（1 ≤ 口碑 ≤ 3）',
        typeof rep === 'number' && rep >= 1 && rep <= 3,
        `种子 -5 → reputation=${rep}（只该等于 ★ 数 × gainPerStar，没被扣穿也没重复加）`,
      );
      const pushed = await ev(`(async () => {
        const end = Date.now() + 8000;
        while (Date.now() < end) {
          const c = (window.__calls || []).filter(x => x.name === 'saveGame').pop();
          const s = c && c.data && c.data.snapshot;
          if (s && typeof s.reputation === 'number') return s.reputation;
          await new Promise((r) => setTimeout(r, 200));
        }
        return null;
      })()`, true);
      judge(
        'A12',
        '口碑随 saveGame 快照上报，服务端白名单收得到，不必新增上云接口',
        pushed === rep,
        `快照.reputation=${pushed}　本地=${rep}`,
      );
      await shot(`${OUT}-A-success-result`);
      continue;
    }

    // 用例 B：0 次误判开局不恶化，把「重试用尽」这条触发源单独隔离。
    const before = await barState();
    judge('B02', '没有失误就没有恶化：红条节点在治疗页存在但隐藏（危重未启动）', before === 0, `active=${before}`);
    judge(
      'B02b',
      '没恶化就不升档：副标题仍按病例原始危急度写，不能一刀切全报 3/3',
      (await label('SeverityLabel')) === '紧急 · 至少选对 2/3',
      `副标题=${await label('SeverityLabel')}`,
    );
    for (let attempt = 1; attempt <= run.failTimes; attempt += 1) {
      const last = attempt === run.failTimes;
      await selectPlan(run.fail);
      await click('ConfirmButton');
      await sleep(900);
      const panel = await labels(['ChoiceTitle', 'ChoiceHint', 'CrisisLabel']);
      const barNow = await barState();
      judge(
        `B1${attempt}`,
        last ? '第 3 次仍不达标：面板改为「重试用尽」并写上抢救窗口，红条同帧亮起' : `第 ${attempt} 次不达标：只给普通失败面板，红条仍隐藏`,
        last
          ? panel.ChoiceTitle === run.crisisTitle && /抢救只剩 \d+s/.test(String(panel.ChoiceHint)) && barNow === 1
          : panel.ChoiceTitle === run.fail.title && /免费重试/.test(String(panel.ChoiceHint)) && barNow === 0,
        `面板=${panel.ChoiceTitle}　提示=${panel.ChoiceHint}　红条=${barNow}`,
      );
      if (!last) {
        await click('ChoiceAction0');
        await sleep(400);
        continue;
      }
      await shot(`${OUT}-B-retry-exhausted`);
      const panelSeconds = Number(String(panel.ChoiceHint).match(/抢救只剩 (\d+)s/)?.[1] ?? -1);
      const barSecondsNow = Number(String(panel.CrisisLabel).match(/剩 (\d+)s/)?.[1] ?? -1);
      judge(
        'B14',
        '面板剩余秒与红条剩余秒同源（同一个 view，不各算各的）',
        panelSeconds > 0 && Math.abs(panelSeconds - barSecondsNow) <= 1 && Math.abs(barSecondsNow - EXPECT_COUNTDOWN) <= 3,
        `面板=${panelSeconds}　红条=${barSecondsNow}`,
      );
      // 独立编号：B13 已经是「重试用尽面板 + 红条同帧亮起」，这里再复用一个同名判定会让日志出现两条 B13。
      await assertCrisisBar('B15');
      if (PARTIAL) {
        console.log('  PARTIAL：重试用尽的窗口已确认，不再拨针转院');
        break;
      }
      // 把时间整段拨过窗口：归零由 CrisisHud 的下一帧触发转院。
      await warp(EXPECT_COUNTDOWN * 1000 + 5000);
      await sleep(1800);
      if (!(await waitFor('PageTitle', 15000))) throw new Error('用例 B：倒计时归零后没跳到结算页');
      await sleep(1200);
      const page = await labels(['PageTitle', 'Summary', 'Adopted', 'TransferNote']);
      judge(
        'B20',
        '倒计时归零自动转院：结算页走第三种终局文案',
        page.Summary === TRANSFER_SUMMARY && page.PageTitle === '今日救助',
        `Summary=${page.Summary}　Title=${page.PageTitle}`,
      );
      judge('B21', '转院账目上墙：按 refundRatio 退药 + 扣爱心 + 扣口碑', page.TransferNote === '退回 1 份药品，爱心 −2，口碑 −1', `TransferNote=${page.TransferNote}`);
      judge('B22', '转院这局未领养', page.Adopted === NOT_ADOPTED, `Adopted=${page.Adopted}`);
      await shot(`${OUT}-B-transfer-result`);
      const afterCoins = await coins();
      const afterHearts = await hearts();
      const stock = await medStock('止痛药');
      const star = await bestStars(run.caseId);
      judge(
        'B23',
        `失败终局不结算奖励：金币停在 ${coinsAtCase}、本局星级不落图鉴`,
        afterCoins === coinsAtCase && star === null,
        `coins=${afterCoins}　bestStars=${JSON.stringify(star)}`,
      );
      const expectHearts = Math.max(0, heartsAtCase - 2);
      judge(
        'B24',
        `转院只扣 heartsPenalty=2：爱心 ${heartsAtCase} → ${afterHearts}（不足 2 时扣到 0 为止，不扣成负数）`,
        afterHearts === expectHearts,
        `hearts=${afterHearts}　期望=${expectHearts}`,
      );
      judge('B25', '三次消耗 3 份止痛药，转院按向下取整退 1 份（5 → 2 → 3）', stock === 3, `止痛药=${stock}`);
      judge('B26', '三次都是门诊：不占床，转院后床位余额不变', (await beds()) === 0, `bedsOccupied=${await beds()}`);
      const rep = await reputation();
      judge(
        'B27',
        '差评只扣到 0 为止：种 1 分口碑，转院 −1 后正好归零，不会成负数',
        rep === 0,
        `种子 1 → reputation=${rep}`,
      );
      const pushed = await ev(`(async () => {
        const end = Date.now() + 8000;
        while (Date.now() < end) {
          const c = (window.__calls || []).filter(x => x.name === 'saveGame').pop();
          const s = c && c.data && c.data.snapshot;
          if (s && typeof s.reputation === 'number') return s.reputation;
          await new Promise((r) => setTimeout(r, 200));
        }
        return null;
      })()`, true);
      judge(
        'B28',
        '转院后的口碑同样随 saveGame 快照上报（本地与服务端同口径都是 0）',
        pushed === 0 && pushed === rep,
        `快照.reputation=${pushed}　本地=${rep}`,
      );
    }
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
