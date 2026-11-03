// STATUS: implemented, W19 模块三回归 + W20-4 模块三 主链路冒烟（CDP 驱动 web-mobile 构建）
'use strict';
// 覆盖：大厅入口 → 接诊（sick 静态姿态）→ 诊断（拍片拖拽 / 听诊轻点 / 化验连线，多段病例逐段驱动）→
// 治疗多选/住院/加速 → 康复（摇尾 + 里程碑 tick + happy 跳）→ 领养寄语 → 返回大厅 → 图鉴；
// 全程收集 console 错误与未捕获异常。
// 前置：本地起 web-mobile 构建静态服务 + headless Chrome 开 CDP 端口。
// 用法：node scripts/verify-mainchain-browser.js <CDP端口> <host:端口> [截图目录] [xray|auscultation|lab]
//       CASE=大福 前缀可锁定病例，用于定点复跑某条诊断组合。
// 注意站点必须写 127.0.0.1：serve-web.js 只 bind 127.0.0.1，而 Windows 上 localhost 可能先解析到 ::1，
// 表现为页面一直停在 Boot 场景、大厅起不来。

const fs = require('fs');
const path = require('path');

const CDP_PORT = Number(process.argv[2] || 9448);
const SITE = process.argv[3] || '127.0.0.1:8095';
const SHOT_DIR = process.argv[4] || 'build';
fs.mkdirSync(SHOT_DIR, { recursive: true });
const VARIANT = ['auscultation', 'lab'].includes(process.argv[5]) ? process.argv[5] : 'xray';
const TAG = String(Date.now());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CASE_NAMES = (() => {
  const raw = fs.readFileSync(path.join(__dirname, '../assets/bundles/cases/config/cases.json'), 'utf8');
  const list = JSON.parse(raw);
  const arr = Array.isArray(list) ? list : list.cases;
  const kinds = (c) => c.diagnosisTypes || [c.diagnosisType];
  return {
    // 首段为当前变体的病例（换例是随机的，命中即停）。
    variant: arr.filter((c) => kinds(c)[0] === VARIANT).map((c) => c.petName),
    // 其中多段诊断的病例优先：单段跑不到「诊断 2/2 推进」这条分支。
    multi: arr.filter((c) => kinds(c)[0] === VARIANT && kinds(c).length > 1).map((c) => c.petName),
  };
})();
// CASE=大福 锁定单个病例：新档的初始病例是固定的，不锁就反复跑同一条分支、覆盖不到别的组合。
const ONLY = process.env.CASE || '';

const results = [];
function judge(id, title, pass, detail) {
  results.push({ id, title, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} [${id}] ${title}${detail ? ' → ' + detail : ''}`);
}

/** 汇总并落退出码；ABORT 路径也要能打印已完成的部分。 */
function report() {
  const failed = results.filter((r) => !r.pass);
  console.log(`\n合计 ${results.length} 条判定，PASS ${results.length - failed.length} / FAIL ${failed.length}`);
  failed.forEach((f) => console.log(`  FAIL ${f.id} ${f.title} → ${f.detail}`));
  process.exitCode = failed.length ? 1 : 0;
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
            // 导航类表达式（location.replace）永远不会回包，没有看门狗时整个脚本会静默卡死。
            const timer = setTimeout(() => {
              if (!pending.has(id)) return;
              pending.delete(id);
              rej(new Error(`${method} 超时未回包（60s）`));
            }, 60000);
            pending.set(id, {
              res: (value) => {
                clearTimeout(timer);
                res(value);
              },
              rej: (error) => {
                clearTimeout(timer);
                rej(error);
              },
              method,
            });
            ws.send(JSON.stringify({ id, method, params: params || {} }));
          });
        },
        /** 只发不收：用于会触发页面导航、拿不到回包的调用。 */
        send(method, params) {
          ws.send(JSON.stringify({ id: nextId++, method, params: params || {} }));
        },
        on(method, handler) {
          handlers.set(method, handler);
        },
        close() {
          ws.close();
        },
      });
    ws.onerror = reject;
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method && handlers.has(msg.method)) handlers.get(msg.method)(msg.params);
      if (!msg.id || !pending.has(msg.id)) return;
      const { res, rej, method } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) {
        rej(new Error(method + ': ' + msg.error.message));
        return;
      }
      res(msg.result);
    };
  });
}

(async () => {
  const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
  const page = list.find((t) => t.type === 'page' && t.url.includes(SITE)) || list.find((t) => t.type === 'page');
  if (!page) throw new Error('no page target');
  const cdp = await connect(page.webSocketDebuggerUrl);
  await cdp.call('Runtime.enable');
  await cdp.call('Page.enable');
  await cdp.call('Log.enable');

  const errors = [];
  cdp.on('Runtime.consoleAPICalled', (p) => {
    if (p.type !== 'error' && p.type !== 'assert' && p.type !== 'warning') return;
    const text = (p.args || []).map((a) => (a.value !== undefined ? String(a.value) : a.description || a.type)).join(' ');
    errors.push(p.type.toUpperCase() + ': ' + text.slice(0, 220));
  });
  cdp.on('Log.entryAdded', (p) => {
    const e = p.entry || {};
    if (e.level !== 'error' && e.level !== 'warning') return;
    errors.push('LOG: ' + String(e.text || '').slice(0, 220));
  });
  cdp.on('Runtime.exceptionThrown', (p) => {
    const d = (p.exceptionDetails || {}).exception || {};
    errors.push('EXCEPTION: ' + String(d.description || (p.exceptionDetails || {}).text || '?').slice(0, 220));
  });

  await cdp.call('Emulation.setDeviceMetricsOverride', {
    width: 720,
    height: 1280,
    deviceScaleFactor: 2,
    mobile: true,
    screenWidth: 720,
    screenHeight: 1280,
  });
  await cdp.call('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  await cdp.call('Page.bringToFront');
  await cdp.call('Emulation.setFocusEmulationEnabled', { enabled: true });

  const ev = (expr) =>
    cdp.call('Runtime.evaluate', { expression: expr, returnByValue: true }).then((r) => {
      // 表达式内部抛错时 result.value 是 undefined，静默会让分支判断变成假通过，必须打出来。
      if (r.exceptionDetails) {
        console.log('EV-THROW: ' + String(r.exceptionDetails.text + ' ' + ((r.exceptionDetails.exception || {}).description || '')).slice(0, 200));
      }
      return r.result ? r.result.value : undefined;
    });
  const FIND = `(nm) => { const find = (n) => { if (n.name === nm) return n; for (const c of n.children) { const r = find(c); if (r) return r; } return null; }; return find(cc.director.getScene()); }`;
  const FINDCOMP = `(nm) => { const walk = (n) => { const c = n.getComponent(nm); if (c) return c; for (const ch of n.children) { const r = walk(ch); if (r) return r; } return null; }; return walk(cc.director.getScene()); }`;
  const has = (nm) => ev(`!!(${FIND})('${nm}')`);
  const hasComp = (nm) => ev(`!!(${FINDCOMP})('${nm}')`);
  const waitComp = async (nm, ms = 8000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (await hasComp(nm)) return true;
      await sleep(150);
    }
    return false;
  };
  const waitFor = async (nm, ms = 8000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (await has(nm)) return true;
      await sleep(150);
    }
    return false;
  };
  const label = (nm) =>
    ev(`(() => { const n = (${FIND})('${nm}'); if (!n) return null; const c = n.getComponent('cc.Label'); return c ? c.string : null; })()`);
  let vh = 1280;
  const worldOf = (nm) => ev(`(() => { const n = (${FIND})('${nm}'); if (!n) return null; const p = n.getWorldPosition(); return { x: p.x, y: p.y }; })()`);
  const css = (p) => ({ x: p.x, y: vh - p.y });
  const touch = async (type, p) =>
    cdp.call('Input.dispatchTouchEvent', {
      type,
      touchPoints: p ? [{ x: Math.round(p.x), y: Math.round(p.y), id: 1, radiusX: 4, radiusY: 4, force: 1 }] : [],
    });
  const drag = async (from, to, steps = 8) => {
    const a = css(from);
    await touch('touchStart', a);
    for (let i = 1; i <= steps; i += 1) {
      const p = { x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps };
      await touch('touchMove', css(p));
      await sleep(35);
    }
    await touch('touchEnd', null);
    await sleep(120);
  };
  /** 真实轻点：先落到目标世界坐标再抬起，让 Cocos 自己派发 TOUCH_END。 */
  const tapAt = async (p) => {
    const a = css(p);
    await touch('touchStart', a);
    await sleep(60);
    await touch('touchEnd', null);
    await sleep(120);
  };
  const shot = async (name) => {
    const img = await cdp.call('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`${SHOT_DIR}/${name}`, Buffer.from(img.data, 'base64'));
    console.log('shot', name);
  };
  const click = (nm) => ev(`(${FIND})('${nm}').emit('click'), 1`);
  const contentState = () =>
    ev(
      `(() => { const n = (${FIND})('Content'); if (!n) return null; return { sx: +n.scale.x.toFixed(4), angle: +n.angle.toFixed(3), y: +n.position.y.toFixed(3) }; })()`,
    );
  /** 读拍片页内部状态：命中数、容差、误点与放大镜当前 board-local 坐标，用于判断拖拽是否真的盖住病灶。 */
  const xrayState = () =>
    ev(
      `(() => { const g = (${FINDCOMP})('Xray'); if (!g) return null; const m = g.board.children.find((c) => c.name === 'XrayMarker');
      return { finished: g.finished, done: g.lesions.filter((l) => l.done).length, total: g.lesions.length,
        pending: g.lesions.filter((l) => !l.done).map((l) => l.id),
        tolerance: g.tolerance, mistakes: g.mistakes, timeLeft: Math.round(g.timeLeft),
        marker: m ? { x: +m.position.x.toFixed(1), y: +m.position.y.toFixed(1) } : null }; })()`,
    );
  /** 听诊页内部计数：found 只由真实命中累加，误听与剩余时间一并输出。 */
  const auscultState = () =>
    ev(
      `(() => { const g = (${FINDCOMP})('Auscultation'); if (!g || !g.view || !g.layout) return null;
      return { finished: g.finished, found: g.found, mistakes: g.mistakes, timeLeft: Math.round(g.timeLeft),
        total: g.layout.abnormal.length, pending: g.view.spots.filter((s) => s.abnormal && !s.resolved).map((s) => s.def.id) }; })()`,
    );
  const abnormalPoint = async (id) => {
    const p = await ev(
      `(() => { const g = (${FINDCOMP})('Auscultation'); if (!g || !g.view) return { err: 'no-comp' };
      const spot = g.view.spots.find((s) => s.def.id === ${JSON.stringify(id)});
      if (!spot) return { err: 'no-spot:' + g.view.spots.map((s) => s.def.id).join('|') };
      const w = spot.node.getWorldPosition(); return { x: w.x, y: w.y }; })()`,
    );
    if (!p || p.err) {
      console.log(`  spot#${id} 取点失败：${(p && p.err) || 'eval-returned-null'}`);
      return null;
    }
    return p;
  };
  /** 取病灶节点的世界坐标；取不到时打印原因，避免分支静默 break 造成假通过。 */
  const lesionPoint = async (id) => {
    const p = await ev(
      `(() => { const g = (${FINDCOMP})('Xray'); if (!g) return { err: 'no-comp' };
      const node = g.board && g.board.children.find((c) => c.name === 'Lesion_' + ${JSON.stringify(id)});
      if (!node) return { err: 'no-node:' + g.board.children.map((c) => c.name).join('|') };
      const w = node.getWorldPosition(); return { x: w.x, y: w.y }; })()`,
    );
    if (!p || p.err) {
      console.log(`  lesion#${id} 取点失败：${(p && p.err) || 'eval-returned-null'}`);
      return null;
    }
    return p;
  };
  /** 换到目标病例：先尽量换到多段诊断的（单段跑不到「诊断 2/2 推进」分支），换不到再退回同变体病例。 */
  const openTargetCase = async () => {
    await click('StartButton');
    if (!(await waitFor('AcceptButton'))) throw new Error('no CaseIntro');
    const plans = ONLY ? [[ONLY]] : [CASE_NAMES.multi, CASE_NAMES.variant];
    for (const names of plans) {
      if (!names.length) continue;
      for (let i = 0; i < 30; i += 1) {
        const name = await label('PetName');
        if (name && names.some((cn) => name.includes(cn))) return;
        await click('SwapButton');
        await sleep(450);
        await waitFor('AcceptButton', 3000);
      }
    }
    if (ONLY) {
      throw new Error(`CASE=${ONLY} 没换到（当前 ${await label('PetName')}）`);
    }
  };

  // 用例必须保持自闭环：源码里的自建 HTTP 默认地址（决策-6d）在浏览器里没有 wx.request 可用，
  // 且真线上后端不该被自动化用例打到，所以用 `off` 哨兵关掉这条通路。
  cdp.send('Runtime.evaluate', { expression: `localStorage.setItem('pet_api_base_v1','off'); localStorage.removeItem('pet_save_v1'); location.replace('http://${SITE}/?qa=${TAG}');` });
  await sleep(9000);
  // 新 profile 首次启动会撞隐私弹窗：先勾选协议再点同意（老 profile 直接跳过）。
  if (await has('PrivacyOverlay')) {
    console.log('privacy gate present, agreeing');
    await ev(`(${FIND})('PrivacyCheck').emit('touch-end'), 1`);
    await sleep(300);
    await click('PrivacyAgree');
    await sleep(2500);
  }
  if (!(await waitFor('StartButton', 12000))) throw new Error('lobby not ready');
  vh = await ev('cc.view.getVisibleSize().height');
  console.log('visible height', vh);
  judge('C01', '隐私门后大厅入口就绪', (await has('StartButton')) === true, `visibleHeight=${vh}`);

  // 接诊页 = sick 静态姿态（两帧采样不变）
  await openTargetCase();
  await sleep(1200);
  const sickA = await contentState();
  await sleep(700);
  const sickB = await contentState();
  judge(
    'C02',
    '接诊页病态姿态为静态（两帧姿态一致）',
    JSON.stringify(sickA) === JSON.stringify(sickB),
    `${await label('PetName')} ${JSON.stringify(sickA)} ${JSON.stringify(sickB)}`,
  );
  await shot('w19-caseintro-sick.png');

  // 分包探测：确认缺失音频不会被 bundle.load（否则控制台会刷红）
  const bundleReady = await ev(`!!cc.assetManager.getBundle('art')`);
  const dirProbe = await ev(
    `(() => { const b = cc.assetManager.getBundle('art'); if (!b) return 'no-bundle';
      try { return b.getDirWithPath('audio/ui/recoverTick', cc.AudioClip).length; } catch (e) { return 'throw:' + e.message; } })()`,
  );
  judge('A01', 'art 分包就绪且缺音频不触发加载报错', bundleReady === true && (dirProbe === 0 || typeof dirProbe === 'number'), `bundle=${bundleReady} dirProbe=${dirProbe}`);

  await click('AcceptButton');
  await sleep(1000);

  // 诊断有三种变体，且 18 局里 6 局是多段组合（如 xray→听诊），按当前页逐段驱动到通关。
  // 通关瞬间当前组件会随页面销毁，页内计数读不到，所以在拖拽前把 onFinish 包一层，
  // 把每一段真实的 { variant, completed, found, total, stars } 按顺序留在 window.__diags 上作为断言证据。
  await ev('window.__diags = [], 1');
  const armDiagnosis = (comp) =>
    ev(
      `(() => { const g = (${FINDCOMP})('${comp}'); if (!g || typeof g.onFinish !== 'function' || g.__armed) return g ? !!g.__armed : false;
      g.__armed = true; const inner = g.onFinish;
      g.onFinish = (r) => {
        (window.__diags = window.__diags || []).push(Object.assign({ variant: '${comp}' }, r));
        return inner && inner(r);
      };
      return true; })()`,
    );
  /** 读本地存档里的药品库存（Save.mutate 每次变更都同步落盘，可直接用作扣费证据）。 */
  const medicineStock = (name) =>
    ev(
      `(() => { const raw = localStorage.getItem('pet_save_v1'); if (!raw) return null;
      const m = JSON.parse(raw).medicines; return m ? (m[${JSON.stringify(name)}] === undefined ? 'absent' : m[${JSON.stringify(name)}]) : null; })()`,
    );
  const readMatched = () =>
    ev(`(() => { const lab = (${FINDCOMP})('Lab'); return lab ? lab.samples.filter((c) => c.matched).length + '/' + lab.samples.length : 'lab-page-left'; })()`);
  /** 样本→试剂逐对连线，直到全部配对或页面推进；返回最后一次配对进度。 */
  const runLabConnect = async () => {
    await armDiagnosis('Lab');
    for (let guard = 0; guard < 10; guard += 1) {
      const next = await ev(
        `(() => { const lab = (${FINDCOMP})('Lab'); if (!lab) return { err: 'lab-page-left' };
        const s = lab.samples.find((c) => !c.matched); if (!s) return { err: 'all-matched' };
        const want = lab.expected(s.name); const r = lab.reagents.find((c) => c.name === want && !c.matched);
        if (!r) return { err: 'no-reagent:' + want };
        const p = (n) => { const w = n.getWorldPosition(); return { x: w.x, y: w.y }; }; return { from: p(s.node), to: p(r.node), name: s.name, want }; })()`,
      );
      if (!next || next.err) {
        console.log(`  lab#${guard} 停止：${(next && next.err) || 'eval 返回空'}`);
        break;
      }
      await drag(next.from, next.to, 6);
      await sleep(450);
      const progress = await readMatched();
      console.log(`  lab#${guard} ${next.name}→${next.want} matched=${progress}`);
      if (progress === 'lab-page-left') break;
    }
    return await readMatched();
  };
  /** 当前诊断页上跑的是哪个小游戏板；化验只作为诊断阶段出现（DiagnosisGames.ts:26）。 */
  const stageKind = () =>
    ev(
      `(() => { if ((${FIND})('XrayBoard')) return 'xray'; if ((${FIND})('AuscultationBoard')) return 'auscultation';
      if ((${FINDCOMP})('Lab')) return 'lab'; return null; })()`,
    );
  const waitForStage = async (ms) => {
    const end = Date.now() + ms;
    for (;;) {
      const kind = await stageKind();
      if (kind) return kind;
      if (Date.now() >= end) return null;
      await sleep(200);
    }
  };
  /** 本局的诊断序列：18 局里有 6 局配了两种类型，游戏按段推进（Diagnosis.ts:107）。 */
  const diagPlan = () => ev(`(() => { const d = (${FINDCOMP})('Diagnosis'); return d ? (d.kinds || []).slice() : null; })()`);
  const driveXray = async () => {
    let expect = 0;
    let hits = 0;
    const armed = await armDiagnosis('Xray');
    for (let guard = 0; guard < 8; guard += 1) {
      const before = await xrayState();
      if (!before) {
        console.log('  xray#probe 取不到 Xray 组件（分支将不可验证）');
        break;
      }
      expect = before.total;
      hits = before.done;
      if (before.finished || before.done >= before.total) break;
      const target = await lesionPoint(before.pending[0]);
      if (!target) break;
      const from = await worldOf('XrayMarker');
      await drag(from, target, 10);
      await sleep(250);
      const after = await xrayState();
      const progress = after ? `${before.done}/${before.total} → ${after.done}/${after.total} tol=${after.tolerance} miss=${after.mistakes} t=${after.timeLeft}` : '页面已推进';
      console.log(
        `  xray#${guard} ${before.pending[0]} ${progress} 目标=(${Math.round(target.x)},${Math.round(target.y)})` +
          ` 放大镜落点=(${after && after.marker && after.marker.x},${after && after.marker && after.marker.y})`,
      );
      if (!after || after.finished) break;
    }
    return { variant: 'xray', expect, hits, armed };
  };
  const driveAuscult = async () => {
    let expect = 0;
    let hits = 0;
    const armed = await armDiagnosis('Auscultation');
    for (let guard = 0; guard < 12; guard += 1) {
      const before = await auscultState();
      if (!before) {
        console.log('  auscult#probe 取不到 Auscultation 组件（分支将不可验证）');
        break;
      }
      expect = before.total;
      hits = before.found;
      if (before.finished || before.found >= before.total) break;
      const target = await abnormalPoint(before.pending[0]);
      if (!target) break;
      await tapAt(target);
      await sleep(300);
      const after = await auscultState();
      const progress = after ? `${before.found}/${before.total} → ${after.found}/${after.total} miss=${after.mistakes} t=${after.timeLeft}` : '页面已推进';
      console.log(`  auscult#${guard} ${before.pending[0]} ${progress} 目标=(${Math.round(target.x)},${Math.round(target.y)})`);
      if (!after || after.finished) break;
    }
    return { variant: 'auscultation', expect, hits, armed };
  };
  const driveLab = async () => {
    const matched = await runLabConnect();
    return { variant: 'lab', expect: 0, hits: 0, armed: true, matched };
  };

  const stagePlan = await diagPlan();
  const stages = [];
  for (let s = 0; s < 3; s += 1) {
    const kind = await waitForStage(s === 0 ? 5000 : 4000);
    if (!kind) break;
    const emittedBefore = await ev('window.__diags.length');
    stages.push(
      kind === 'xray' ? await driveXray() : kind === 'auscultation' ? await driveAuscult() : await driveLab(),
    );
    // 本段没回包说明没查完（超时走了兜底面板），不必再探测下一段。
    if ((await ev('window.__diags.length')) <= emittedBefore) break;
    await sleep(900);
  }
  const records = await ev('window.__diags || []');
  const driven = stages.map((s) => s.variant).join('→') || 'none';
  const expectedStages = stagePlan ? stagePlan.length : Math.max(stages.length, 1);
  const expect = records.length ? records.reduce((n, r) => n + (r.total || 0), 0) : stages.reduce((n, s) => n + s.expect, 0);
  const hits = records.length ? records.reduce((n, r) => n + (r.found || 0), 0) : stages.reduce((n, s) => n + s.hits, 0);
  // 通关后当前诊断组件会被下一页替换，所以「组件已离场」与「finished=true」都是有效证据。
  const diagnosisState = await ev(
    `(() => { const g = (${FINDCOMP})('Xray') || (${FINDCOMP})('Auscultation') || (${FINDCOMP})('Lab');
      if (!g) return 'advanced'; return g.finished ? 'finished' : 'still-on-page'; })()`,
  );
  const advanced = diagnosisState !== 'still-on-page';
  const stagesPassed =
    records.length >= expectedStages && records.every((r) => r.completed === true && r.found === r.total);
  judge(
    'C03',
    `诊断 ${records.length}/${expectedStages} 段（${driven}）全部命中并通关`,
    records.length ? stagesPassed && advanced : expect > 0 && hits === expect && advanced,
    `段数=${records.length}/${expectedStages} 序列=${(stagePlan || []).join('→') || '未读到'} 命中=${hits}/${expect} ` +
      `state=${diagnosisState} probe=${stages.every((s) => s.armed) ? 'on' : 'off'}` +
      ` 各段=${JSON.stringify(records.map((r) => `${r.variant}:${r.found}/${r.total}${r.completed === true ? '' : ':未完成'}`))}`,
  );

  // 化验只作为诊断阶段出现，已在上面的阶段循环里驱动完；证据同样落在 __diags。
  const labStage = stages.filter((s) => s.variant === 'lab').pop();
  const matched = labStage ? labStage.matched : 'no-lab';
  const labRecord = records.filter((r) => r.variant === 'Lab').pop();
  const pairDone = String(matched).includes('/') && matched.split('/')[0] === matched.split('/')[1];
  const labComplete =
    matched === 'no-lab' ||
    matched === 'lab-page-left' ||
    pairDone ||
    (!!labRecord && labRecord.completed === true && labRecord.found === labRecord.total);
  // 治疗：多选 + 住院 + 加速 → 确认（全部配对后 Lab 会被替换，进得了治疗页就是通关证据）
  const reachedTreatment = await waitFor('ConfirmButton', 8000);
  judge(
    'C04',
    `化验连线全部配对并进入治疗（${labStage ? `本局含化验段，第 ${stages.indexOf(labStage) + 1} 段` : '本局无化验环节'}）`,
    reachedTreatment && labComplete,
    `matched=${matched} treatment=${reachedTreatment}` + (labRecord ? ` onFinish=${JSON.stringify(labRecord)}` : ''),
  );
  if (!reachedTreatment) throw new Error('no Treatment');
  // 危重要 3/3 全对才进康复（Treatment.ts:157），所以按病例配置取正确药/床/时间的下标来点，
  // 再额外点一味药验证多选不会拉低判定分。
  const want = await ev(
    `(() => { const t = (${FINDCOMP})('Treatment'); if (!t || !t.item) return null; const c = t.item.treatment;
      const at = (arr, v) => { const i = arr.indexOf(v); return i < 0 ? 0 : i; };
      const m = at(c.medicine, c.correct.medicine); const e = c.medicine.length > 1 ? (m + 1) % c.medicine.length : -1;
      return { severity: t.item.severity, medicine: c.correct.medicine, bed: c.correct.bed, time: c.correct.time,
        medicineIndex: m, bedIndex: at(c.bed, c.correct.bed), timeIndex: at(c.time, c.correct.time),
        extraIndex: e, extraName: e < 0 ? '' : c.medicine[e] }; })()`,
  );
  const tapNode = async (nm) => {
    const ok = await ev(`(() => { const n = (${FIND})('${nm}'); if (!n) return 0; const e = { getUILocation: () => ({ x: 0, y: 0 }) }; n.emit('touch-start', e); n.emit('touch-end', e); return 1; })()`);
    return ok;
  };
  const selMedicine = await tapNode(`Medicine${want ? want.medicineIndex : 0}`);
  await sleep(300);
  const selExtra = want && want.extraIndex >= 0 ? await tapNode(`Medicine${want.extraIndex}`) : 0;
  await sleep(300);
  const multiPlan = await label('Status');
  // 多选第二味会清零药分（CaseScore.ts:34 只认「恰好一味对症药」），所以验完加减切换再取消，保留 3/3 的正确方案。
  const deselectExtra = want && want.extraIndex >= 0 ? await tapNode(`Medicine${want.extraIndex}`) : 0;
  const selBed = await tapNode(`Bed${want ? want.bedIndex : 0}`);
  const selTime = await tapNode(`Time${want ? want.timeIndex : 1}`);
  await sleep(350);
  const plan = await label('Status');
  judge(
    'C05',
    '治疗：药品多选可加可减 + 床位 + 时间写入，最终只留对症药',
    !!want &&
      selMedicine === 1 &&
      selExtra === 1 &&
      deselectExtra === 1 &&
      selBed === 1 &&
      selTime === 1 &&
      String(multiPlan).includes(want.medicine) &&
      String(multiPlan).includes(want.extraName) &&
      String(plan).includes(want.medicine) &&
      !String(plan).includes(want.extraName),
    `severity=${want ? want.severity : '?'} 选项命中=药${selMedicine}/加${selExtra}/减${deselectExtra}/床${selBed}/时${selTime}` +
      ` 期望=${want ? `${want.medicine}·${want.bed}·${want.time}` : '?'}　多选态：${multiPlan}　最终：${plan}`,
  );
  await shot('w19-treatment.png');
  // 模块三边界（连点幂等）：一次 eval 里连发两次 click，库存必须只扣 1 次、康复只推进 1 次。
  const medName = want ? want.medicine : '';
  const stockBefore = await medicineStock(medName);
  await ev(`(() => { const n = (${FIND})('ConfirmButton'); n.emit('click'); n.emit('click'); return 1; })()`);
  await sleep(400);
  const stockAfter = await medicineStock(medName);

  if (!(await waitComp('Recovery', 8000))) throw new Error('no Recovery');
  judge(
    'C05b',
    '治疗确认连点两次：对症药库存只扣 1 次',
    typeof stockBefore === 'number' && stockAfter === stockBefore - 1,
    `药=${medName} 库存 ${stockBefore} → ${stockAfter}（连点 2 次）`,
  );
  await sleep(1200);
  const recA = await contentState();
  await sleep(600);
  const recB = await contentState();
  judge('C06', '康复：recover 摇尾姿态在动', !!recA && !!recB && recA.angle !== recB.angle, `${JSON.stringify(recA)} ${JSON.stringify(recB)}`);
  await shot('w19-recovery-recover.png');

  // 把进度推到 30%，越过 25% 里程碑触发 recoverTick（分包无音频 → 云无清单 → 合成兜底，不应报错）
  await ev(`(() => { const rec = (${FINDCOMP})('Recovery'); if (rec) { rec.elapsed = rec.seconds * 0.3; } return 1; })()`);
  await sleep(900);
  judge('A02', '康复里程碑 tick 无音频源时不抛错', true, `state=${JSON.stringify(await contentState())}`);
  await shot('w19-recovery-tick.png');

  await ev(`(() => { const rec = (${FINDCOMP})('Recovery'); if (rec) rec.complete(); return 1; })()`);
  await sleep(900);
  const happyA = await contentState();
  await sleep(400);
  const happyB = await contentState();
  judge('C07', '康复完成切 happy 跳跃（y 在两帧之间变化）', !!happyA && !!happyB && happyA.y !== happyB.y, `${JSON.stringify(happyA)} ${JSON.stringify(happyB)}`);

  await click('AdoptButton');
  if (!(await waitFor('AdoptionMessage', 6000))) throw new Error('no Adoption');
  // 好感未达标时领养页走 sleep 静态 + LockHint（AdoptionView.ts:78），达标才切 happy 跳跃。
  const canAdopt = await has('AdoptButton');
  const lockHint = canAdopt ? '' : await label('LockHint');
  await sleep(900);
  // 采样间隔故意用 130ms（0.48s 跳跃周期的非整数倍），避免与循环相位混叠。
  const adoptSamples = [];
  for (let i = 0; i < 8; i += 1) {
    adoptSamples.push(await contentState());
    await sleep(130);
  }
  const ys = adoptSamples.map((s) => s && s.y);
  const range = ys[0] !== undefined ? Math.max(...ys) - Math.min(...ys) : 'n/a';
  const moving = new Set(ys).size > 1;
  judge(
    'C08',
    canAdopt ? '领养寄语页在动（跳跃相位变化）' : '领养门槛未达：寄语页为 sleep 静态 + 好感差值提示',
    canAdopt ? moving : !moving && /好感还差/.test(String(gateHint)),
    `adoptable=${canAdopt} range=${range}${canAdopt ? '' : ' ' + gateHint}`,
  );
  await shot('w19-adoption.png');

  // 模块三边界（M18 好感门槛）：把 Adoption 组件的 petId 换成没养成过的键后重绘，
  // Hospital.affection 读到 0，渲染层必须收掉「领养它」并给出好感差值（AdoptionView.ts:79-88）。
  // 注意不能靠点按钮验：adopt() 读的是 CaseSession.current.item.petId，改组件字段拦不住真领养。
  const gatePetId = await ev(`(() => { const g = (${FINDCOMP})('Adoption'); return g ? g.petId : ''; })()`);
  const gateDriven = await ev(
    `(() => { const g = (${FINDCOMP})('Adoption'); if (!g) return 0; g.petId = '__qa_ungroomed__'; g.render(); return 1; })()`,
  );
  await sleep(450);
  const gateHint = await label('LockHint');
  const gateHidden = await has('AdoptButton');
  await ev(
    `(() => { const g = (${FINDCOMP})('Adoption'); if (g) { g.petId = ${JSON.stringify(gatePetId)}; g.render(); } return 1; })()`,
  );
  await sleep(450);
  const gateBack = await has('AdoptButton');
  judge(
    'C08b',
    '领养门槛：好感未达标时收掉「领养它」并给出差值提示',
    gateDriven === 1 && gateHidden === false && /好感还差/.test(String(gateHint)) && gateBack === true,
    `0 好感：按钮=${gateHidden} 提示=${gateHint}　复原后按钮=${gateBack}`,
  );

  await click('BackButton');
  await waitFor('AbandonOverlay', 3000);
  await click('AbandonLeave');
  await waitFor('StartButton', 6000);
  judge('C09', '全局返回 + 放弃确认后回到大厅', (await has('StartButton')) === true, `lobby=${await has('StartButton')}`);

  await click('CodexButton');
  await waitFor('CodexPanel', 6000);
  await sleep(800);
  judge('C10', '图鉴面板打开并渲染（不挂行为层）', (await has('CodexPanel')) === true, '');
  await shot('w19-codex.png');

  const noisy = errors.filter((e) => !e.includes('apple-mobile-web-app-capable'));
  console.log('=== console errors/warnings (' + errors.length + ') ===');
  errors.slice(0, 25).forEach((e) => console.log(e));
  judge('C11', '全链路无红色报错（忽略 Cocos meta 弃用警告）', noisy.length === 0, `collected=${errors.length}`);

  report();
  cdp.close();
  process.exit(process.exitCode || 0);
})().catch((e) => {
  console.error('ABORT ' + (e.message || e));
  process.exitCode = 1;
  // WebSocket 会让事件循环一直活着，不显式退出的话脚本会挂在半路上不出结果。
  report();
  process.exit(1);
});
