// STATUS: implemented, W19 模块三回归 + W20-4 模块三 主链路冒烟（CDP 驱动 web-mobile 构建）
'use strict';
// 覆盖：大厅入口 → 接诊（sick 静态姿态）→ 诊断（拍片刮擦 / 听诊节奏 / 化验连线，多段病例逐段驱动）→
// 治疗多选/住院/加速 → 康复（摇尾 + 里程碑 tick + happy 跳）→ 领养寄语 → 返回大厅 → 图鉴；
// 全程收集 console 错误与未捕获异常。
// 前置：本地起 web-mobile 构建静态服务 + headless Chrome 开 CDP 端口。
// 用法：node scripts/verify-mainchain-browser.js <CDP端口> <host:端口> [截图目录] [xray|auscultation|lab]
//       CASE=大福 前缀可锁定病例，用于定点复跑某条诊断组合。
//       ONETAKE=1 额外产出 flow-01…flow-16 一镜到底截图（四枚 TAB + 寻访→接诊→诊断→治疗→康复→领养→送养）。
// 注意站点必须写 127.0.0.1：serve-web.js 只 bind 127.0.0.1，而 Windows 上 localhost 可能先解析到 ::1，
// 表现为页面一直停在 Boot 场景、大厅起不来。

const fs = require('fs');
const path = require('path');

const CDP_PORT = Number(process.argv[2] || 9448);
const SITE = process.argv[3] || '127.0.0.1:8095';
const SHOT_DIR = process.argv[4] || 'build';
fs.mkdirSync(SHOT_DIR, { recursive: true });
const VARIANT = ['auscultation', 'lab'].includes(process.argv[5]) ? process.argv[5] : 'xray';
/**
 * ONETAKE=1：在同一页会话里把「大厅 → 四枚 TAB → 寻访 → 接诊 → 诊断 → 治疗 → 康复 → 领养 → 小屋 TAB → 送养」
 * 逐段截图，作为提审前的一镜到底说明。默认关闭，不影响原回归用例的判定点与耗时。
 */
const ONETAKE = process.env.ONETAKE === '1';
const TAG = String(Date.now());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** 听诊判定线在一个拍周期里的位置：波纹缩放 1.46→0.52，缩到 1 的那一帧与金圈重合。 */
const CROSS_RATIO = (1.46 - 1) / (1.46 - 0.52);
/** 落指按住时长：太短怕 Cocos 把一次点击吞成手势噪声，太长把判定推过线。 */
const TAP_HOLD_MS = 20;

const CASES = (() => {
  const raw = fs.readFileSync(path.join(__dirname, '../assets/bundles/cases/config/cases.json'), 'utf8');
  const list = JSON.parse(raw);
  const arr = Array.isArray(list) ? list : list.cases;
  return arr.map((c) => ({ ...c, kinds: c.diagnosisTypes || [c.diagnosisType] }));
})();

const GACHA_POOL = (() => {
  const raw = fs.readFileSync(path.join(__dirname, '../assets/bundles/cases/config/gacha.json'), 'utf8');
  const g = JSON.parse(raw);
  return (g.tiers || []).reduce((ids, t) => ids.concat(t.pets || []), []);
})();

/** 病例选择口径：首段为当前变体；其中多段诊断的优先（单段跑不到「诊断 2/2 推进」这条分支）。 */
const CANDIDATES = (() => {
  const hit = CASES.filter((c) => c.kinds[0] === VARIANT && (!process.env.CASE || c.petName === process.env.CASE));
  const multi = hit.filter((c) => c.kinds.length > 1);
  return { names: [...new Set(hit.map((c) => c.petName))], ids: [...new Set(hit.map((c) => c.petId))], multiFirst: [...multi, ...hit] };
})();

/**
 * 空候选集只能靠 150 连抽撞运气，抽到才怪——在浏览器还没起之前就按口径报错，
 * 别让人对着 timeout 猜原因。
 */
if (!CANDIDATES.names.length) {
  throw new Error(
    `变体 ${VARIANT} 里没有首段匹配${process.env.CASE ? `、且宠名为 ${process.env.CASE}` : ''}的病例（换 VARIANT 或 CASE）`,
  );
}

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
    width: Number(process.env.CDP_W || 720),
    height: Number(process.env.CDP_H || 1280),
    deviceScaleFactor: 2,
    mobile: true,
    screenWidth: Number(process.env.CDP_W || 720),
    screenHeight: Number(process.env.CDP_H || 1280),
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
  /** 等某个 Label 的文字出现目标片段；面板相位只能靠文案区分时用（节点从挂舞台起就存在）。 */
  const waitForText = async (nm, sub, ms = 8000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (String(await label(nm)).includes(sub)) return true;
      await sleep(120);
    }
    return false;
  };
  let vh = 1280;
  // 世界坐标（左下原点）→ CSS 像素。390×844 下可见高度约 1558 设计单位，直接当 CSS 用会把触点甩到屏幕外。
  let vp = { w: 720, h: 1280, cw: 720, ch: 1280 };
  const css = (p) => ({ x: (p.x * vp.cw) / vp.w, y: vp.ch - (p.y * vp.ch) / vp.h });
  const syncViewport = async () => {
    vp = await ev(
      `(() => { const v = cc.view.getVisibleSize(); return { w: v.width, h: v.height, cw: window.innerWidth, ch: window.innerHeight }; })()`,
    );
    vh = vp.h;
    return vp;
  };
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
  const tapAt = async (p, hold = 60, tail = 120) => {
    const a = css(p);
    await touch('touchStart', a);
    await sleep(hold);
    await touch('touchEnd', null);
    await sleep(tail);
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
  /** 读拍片页内部状态：命中数、雾气残余量与剩余时间，用于判断刮擦是否真的擦开并显影。 */
  const xrayState = () =>
    ev(
      `(() => { const g = (${FINDCOMP})('Xray'); if (!g) return null;
      return { finished: g.finished, done: g.lesions.filter((l) => l.done).length, total: g.lesions.length,
        pending: g.lesions.filter((l) => !l.done).map((l) => l.id),
        fog: g.fog ? +g.fog.remaining().toFixed(2) : null, timeLeft: Math.round(g.timeLeft) }; })()`,
    );
  /**
   * 听诊页节奏状态探针（P1-B-1 起没有「点位」概念，改读 rhythm 模型）。
   * elapsed 是本拍已经走掉的游戏毫秒，判定线固定在 period × 0.4894，两者一减就是真实余量，
   * 比反推 ripple 更准；ripple 只作交叉校验。
   * 一次求值顺带取棋盘坐标、把 onFinish 包好、并把 rhythm.tap 包一层留下每次落指的真实误差
   * （多段病例里第二段的进场延迟直接决定首拍赶不赶得上：判定线 ≈685ms、≈895ms 自动判漏，
   * 每少一个 CDP 往返就多几十毫秒断言余量）。
   */
  const auscultState = () =>
    ev(
      `(() => { const g = (${FINDCOMP})('Auscultation'); if (!g || !g.rhythm) return null;
      if (!g.__armed && typeof g.onFinish === 'function') {
        g.__armed = true; const inner = g.onFinish;
        g.onFinish = (r) => { (window.__diags = window.__diags || []).push(Object.assign({ variant: 'Auscultation' }, r)); return inner && inner(r); };
      }
      if (!g.__tapped) { const R = g.rhythm; const raw = R.tap.bind(R); g.__tapped = true; g.__taps = [];
        R.tap = () => { const b = R.beatIndex, e = R.elapsed; const grade = raw();
          g.__taps.push({ beat: b, elapsed: Math.round(e), grade }); return grade; }; }
      const b = (${FIND})('RhythmBoard'); const w = b ? b.getWorldPosition() : null; const r = g.rhythm;
      return { armed: !!g.__armed, pt: w ? { x: w.x, y: w.y } : null,
        finished: g.finished, hits: r.hits, misses: r.misses, combo: r.combo, maxCombo: r.maxCombo,
        beat: r.beatIndex, total: r.rule.beats, period: r.rule.periodMs, good: r.rule.goodMs,
        done: r.done, traveling: r.traveling, ripple: +r.ripple.toFixed(4),
        elapsed: Math.round(r.elapsed), timeLeft: Math.round(g.timeLeft),
        taps: (g.__taps || []).slice(-3) }; })()`,
    );
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
  /**
   * P1-A 入口：大厅主按钮 → 街头寻访 → 抽到候选病例的目标宠立即接诊。
   * 目标宠之外全部预置成「已见」，所以只有抽到候选宠才会出现「立即接诊」。
   * 相位只能看提示文字：GachaOffer 的 show/hide 只切 active，GachaBox 从挂舞台起就存在。
   */
  const openTargetCase = async () => {
    const READY = '花点金币';
    const SEARCH = '点一点纸箱';
    const wanted = new Set(CANDIDATES.names);
    await click('StartButton');
    if (!(await waitForText('GachaHint', READY, 15000))) throw new Error('寻访出价区没就绪');
    if (ONETAKE) await shot('flow-06-gacha-offer.png');
    for (let rolls = 1; rolls <= 150; rolls += 1) {
      await click('GachaPay');
      if (!(await waitForText('GachaHint', SEARCH, 8000))) throw new Error('没进入拍箱阶段');
      await click('GachaBox');
      if (!(await waitFor('GachaName', 8000))) throw new Error('结果卡没出来');
      const name = await label('GachaName');
      const primary = await label('GachaPrimaryLabel');
      if (name && wanted.has(name) && primary === '立即接诊') {
        if (ONETAKE) await shot('flow-07-gacha-result.png');
        await click('GachaPrimary');
        if (!(await waitFor('AcceptButton', 12000))) throw new Error('接诊卡没出来');
        judge('C01b', `寻访 ${rolls} 次后抽到候选病例 ${name} 并进入接诊`, true, `抽卡次数=${rolls} 主按钮=${primary}`);
        return;
      }
      console.log(`  roll#${rolls} ${name}（${primary}）`);
      await click('GachaPrimary');
      if (!(await waitForText('GachaHint', READY, 10000))) throw new Error('再寻访一次后没回到出价区');
    }
    throw new Error(`寻访 150 次没抽到候选病例（候选=${[...wanted].join('/')}）`);
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
  const viewport = await syncViewport();
  console.log('visible height', vh, `css ${viewport.cw}x${viewport.ch}`);
  judge('C01', '隐私门后大厅入口就绪', (await has('StartButton')) === true, `visibleHeight=${vh}`);

  // 寻访是概率抽取，主链用例必须锁定候选病例，所以把候选之外的宠物预置成「已见」：
  // 抽到已见宠只会出「再寻访一次」，只有候选宠才会出「立即接诊」。
  // 金币只在这条用例通路上加量，其余存档字段一律沿用游戏自己写出的默认快照（不手编字段形状）。
  const seenIds = GACHA_POOL.filter((id) => !CANDIDATES.ids.includes(id));
  const seeded = await ev(
    `(() => { const raw = localStorage.getItem('pet_save_v1'); if (!raw) return 'no-save';
    const s = JSON.parse(raw); const want = ${JSON.stringify(seenIds)};
    if ((s.petsSeen || []).join('|') === want.join('|') && s.coins >= 20000) return 'ready';
    s.coins = 20000; s.petsSeen = want; localStorage.setItem('pet_save_v1', JSON.stringify(s)); return 'written'; })()`,
  );
  if (seeded === 'no-save') throw new Error('大厅没写出 pet_save_v1 存档，无法预置寻访池');
  if (seeded === 'written') {
    console.log(`寻访池预置：已见 ${seenIds.length} 只 / 候选 ${CANDIDATES.ids.length} 只，重载页面生效`);
    cdp.send('Runtime.evaluate', { expression: 'location.reload()' });
    await sleep(9000);
    if (!(await waitFor('StartButton', 15000))) throw new Error('重载后大厅没就绪');
    vh = await ev('cc.view.getVisibleSize().height');
  }
  judge('C01a', '寻访池预置完成（候选宠是唯一未见面）', seeded === 'written' || seeded === 'ready', `seed=${seeded} 池=${GACHA_POOL.length}`);

  /** 一镜到底 01–05：四枚常驻 TAB 逐一点亮，每帧等 0.2s 交叉淡入走完再截；末帧回切诊疗，保证后面的 StartButton 在亮着的坞里。 */
  if (ONETAKE) {
    await shot('flow-01-lobby-clinic.png');
    const TAB_SHOTS = [
      ['Tab_garden', 'flow-02-lobby-garden.png'],
      ['Tab_habitat', 'flow-03-lobby-habitat.png'],
      ['Tab_achieve', 'flow-04-lobby-achieve.png'],
      ['Tab_clinic', 'flow-05-lobby-clinic-back.png'],
    ];
    for (const [tab, file] of TAB_SHOTS) {
      await click(tab);
      await sleep(700);
      await shot(file);
    }
  }

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
  if (ONETAKE) await shot('flow-08-case-intro.png');

  // 分包探测：确认缺失音频不会被 bundle.load（否则控制台会刷红）
  const bundleReady = await ev(`!!cc.assetManager.getBundle('art')`);
  const dirProbe = await ev(
    `(() => { const b = cc.assetManager.getBundle('art'); if (!b) return 'no-bundle';
      try { return b.getDirWithPath('audio/ui/recoverTick', cc.AudioClip).length; } catch (e) { return 'throw:' + e.message; } })()`,
  );
  judge('A01', 'art 分包就绪且缺音频不触发加载报错', bundleReady === true && (dirProbe === 0 || typeof dirProbe === 'number'), `bundle=${bundleReady} dirProbe=${dirProbe}`);

  await click('AcceptButton');
  // 段间不做大块盲等：听诊首拍的判定线只有 685ms（period 1400 × 0.4894），
  // 895ms 后游戏自己判漏拍，届时再进场最多拿 6/7，C03 的「全部命中」必然假失败。
  await sleep(150);
  /**
   * 诊断页要等转场淡入结束才有画面，但听诊首拍的判定线在 685ms，为截图多等会让 C03 掉拍，
   * 所以这一帧只在拍片/化验变体下补拍（两者时间预算充裕），听诊变体跳过。
   */
  if (ONETAKE && VARIANT !== 'auscultation') {
    await sleep(1300);
    await shot('flow-09-diagnosis.png');
  }

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
      `(() => { if ((${FIND})('XrayBoard')) return 'xray'; if ((${FIND})('RhythmBoard')) return 'auscultation';
      if ((${FINDCOMP})('Lab')) return 'lab'; return null; })()`,
    );
  const waitForStage = async (ms) => {
    const end = Date.now() + ms;
    for (;;) {
      const kind = await stageKind();
      if (kind) return kind;
      if (Date.now() >= end) return null;
      await sleep(80);
    }
  };
  /**
   * 本局的诊断序列：18 局里有 6 局配了两种类型，游戏按段推进（Diagnosis.ts:107）。
   * 必须在进场后轮询——接诊卡到诊断页有转场动画，Diagnosis 组件挂载前读 kinds 只会拿到 null，
   * 读不到序列就得回退到「探测到几段算几段」，转场残留的上一段会被当成新的一段跑第二遍。
   */
  const diagPlan = () => ev(`(() => { const d = (${FINDCOMP})('Diagnosis'); return d ? (d.kinds || []).slice() : null; })()`);
  const waitForPlan = async (ms) => {
    const end = Date.now() + ms;
    for (;;) {
      const plan = await diagPlan();
      if (plan && plan.length) return plan;
      if (Date.now() >= end) return null;
      await sleep(80);
    }
  };
  /** 等本段诊断把结果写进 window.__diags；写进去了才继续探下一段。 */
  const waitStageRecord = async (from, ms) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if ((await ev('window.__diags.length')) > from) return true;
      await sleep(120);
    }
    return false;
  };
  /** 刮擦：以病灶为中心左右往返拖三道（每道 190px），模拟玩家擦雾；雾层按 12px 步长结算。 */
  const scrubAround = async (target) => {
    for (const dy of [-26, 0, 26]) {
      await drag({ x: target.x - 95, y: target.y + dy }, { x: target.x + 95, y: target.y + dy }, 9);
      await sleep(140);
    }
  };
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
      await scrubAround(target);
      const after = await xrayState();
      const progress = after
        ? `${before.done}/${before.total} → ${after.done}/${after.total} fog=${after.fog} t=${after.timeLeft}`
        : '页面已推进';
      console.log(
        `  xray#${guard} ${before.pending[0]} ${progress} 目标=(${Math.round(target.x)},${Math.round(target.y)})`,
      );
      if (!after || after.finished) break;
    }
    return { variant: 'xray', expect, hits, armed };
  };
  /**
   * 听诊按时间判定：每拍判定线固定在 period × 0.4894（AuscultationRhythm.ts:17），
   * 落指的 TOUCH_END 那一刻的 elapsed 减判定线就是误差，|误差| > goodMs 算漏拍，
   * 晚过 goodMs 还会被 update() 抢先自动判漏（那时 rhythm.tap() 返回 null，点击整个作废）。
   * 所以真正要控的是「读数之后到落指之间这条管线吃掉多少游戏毫秒」：读数本身一个 CDP 往返，
   * 接着 touchStart 一个往返、按住 hold、再 touchEnd 一个往返，实测 150–300 毫秒——
   * 等波纹贴环再发指必然晚过窗。做法是留一个提前量 lead，用每次落指记在 __taps 里的真实误差
   * 闭环校正（收敛后稳定在 ±20ms，七拍全完美）；墙钟与游戏时钟的倍率也按相邻两次 timeLeft
   * 实测换算，不写死——headless SwiftShader 下帧率抖动时这个倍率会跟着漂。
   */
  let gameClock = 1;
  let lastAuscult = null;
  const readAuscult = async () => {
    const t0 = Date.now();
    const s = await auscultState();
    if (s && lastAuscult) {
      const wall = t0 - lastAuscult.t;
      const drop = lastAuscult.s.timeLeft - s.timeLeft;
      if (wall >= 60 && drop > 0 && drop < wall * 3) {
        gameClock = Math.min(2, Math.max(0.2, drop / wall));
      }
    }
    if (s) lastAuscult = { t: t0, s };
    return { state: s, rtt: Date.now() - t0 };
  };
  /** 还剩多少游戏毫秒到判定线（可为负：已经越过）。 */
  const toCrossMs = (s) => s.period * CROSS_RATIO - s.elapsed;
  /** 游戏毫秒换算成墙钟毫秒：headless 里 deltaTime 慢于真实时间，按实测倍率折算。 */
  const wallMs = (gameMs) => Math.min(1200, Math.max(10, Math.round(gameMs / gameClock)));
  const GRADE_TEXT = { perfect: '完美', good: '接住', miss: '漏拍', null: '点击作废' };
  const driveAuscult = async () => {
    let expect = 0;
    let hits = 0;
    let armed = false;
    let pt = null;
    const grades = [];
    let entryMisses = 0;
    // 落指提前量（游戏毫秒）：初值按「读数 + touchStart + 按住 + touchEnd」的往返开销估，
    // 之后每拍用实测误差往「正好压线」收敛。
    let lead = 190;
    lastAuscult = null;
    for (let guard = 0; guard < 40; guard += 1) {
      const entry = await readAuscult();
      const before = entry.state;
      if (!before) {
        // 最后拍打完页面立刻推进到下一段，组件随之销毁：取不到读数在这里是正常收尾，不是探针失效。
        if (grades.length) {
          console.log(`  auscult#end 本段 ${grades.length}/${expect} 拍已落指，诊断页已推进到下一段`);
          break;
        }
        if (guard < 8) {
          await sleep(40);
          continue;
        }
        console.log('  auscult#probe 取不到 Auscultation.rhythm（P1-B 探针失效，分支不可验证）');
        break;
      }
      armed = before.armed;
      pt = before.pt;
      expect = before.total;
      hits = before.hits;
      if (guard === 0) {
        entryMisses = before.misses;
        console.log(
          `  auscult#enter 进场：拍${before.beat + 1}/${before.total} 已漏拍=${before.misses} ` +
            `距判定线=${Math.round(toCrossMs(before))}ms 时钟倍率=${gameClock.toFixed(2)}`,
        );
      }
      if (before.finished || before.done) break;
      if (!pt) {
        console.log('  auscult#board 取不到 RhythmBoard 世界坐标，无法真实落指');
        break;
      }
      if (!before.traveling) {
        await sleep(60);
        continue;
      }
      // 逐跳收敛到「提前量」：每睡一步重新读，倍率或提前量估偏了也只多睡/少睡一跳。
      let cur = { ...before, rtt: entry.rtt };
      let chased = 0;
      while (toCrossMs(cur) > lead && chased < 8) {
        await sleep(Math.max(10, wallMs(toCrossMs(cur) - lead) - cur.rtt));
        const next = await readAuscult();
        if (!next.state || !next.state.traveling || next.state.beat !== cur.beat) {
          cur = next.state ? { ...next.state, traveling: false, rtt: next.rtt } : { ...cur, traveling: false };
          break;
        }
        cur = { ...next.state, rtt: next.rtt };
        chased += 1;
      }
      if (!cur.traveling) {
        console.log(`  auscult#${guard} 拍${cur.beat + 1}/${cur.total} 收敛中本拍已结束（miss=${cur.misses}），进入下一拍`);
        continue;
      }
      await tapAt(pt, TAP_HOLD_MS, 40);
      const after = await readAuscult();
      const landed = (after.state && after.state.taps || []).filter((t) => t.beat === cur.beat).pop();
      if (landed) {
        grades.push(landed.grade === null ? '点击作废' : GRADE_TEXT[landed.grade] || String(landed.grade));
        // W33 P0-7：抓一帧「连击 + 判定」同时出现的画面，并留几何证据（两行中心距 ≥60）。
        if (ONETAKE && grades.length === 1) {
          await shot('flow-09b-auscultation.png');
          const gap = await ev(
            `(() => {
              const find = (n, nm) => { if (n.name === nm) return n; for (const c of n.children) { const r = find(c, nm); if (r) return r; } return null; };
              const s = cc.director.getScene();
              const a = find(s, 'RhythmCombo'); const b = find(s, 'RhythmJudge');
              if (!a || !b) return null;
              return { combo: Math.round(a.getWorldPosition().y), judge: Math.round(b.getWorldPosition().y) };
            })()`,
          );
          console.log(`  auscult#layout ${JSON.stringify(gap)}`);
        }
        const err = Math.round(landed.elapsed - cur.period * CROSS_RATIO);
        lead = Math.round(Math.min(600, Math.max(40, lead + err)));
        console.log(
          `  auscult#${guard} 拍${cur.beat + 1}/${cur.total} 收${chased}步 落指误差=${err}ms 提前量→${lead}ms ` +
            `倍率=${gameClock.toFixed(2)} → ${grades[grades.length - 1]}` +
            (after.state ? ` hits=${after.state.hits}/${after.state.total} miss=${after.state.misses} combo=${after.state.combo}/${after.state.maxCombo}` : ''),
        );
      } else {
        grades.push('未结算');
        console.log(`  auscult#${guard} 拍${cur.beat + 1}/${cur.total} 落指后没读到 __taps 记录（探针或页面已推进）`);
      }
      if (after.state) {
        hits = after.state.hits;
        if (after.state.finished || after.state.done) break;
      } else {
        break;
      }
    }
    return { variant: 'auscultation', expect, hits, armed, grades, entryMisses };
  };
  const driveLab = async () => {
    const matched = await runLabConnect();
    return { variant: 'lab', expect: 0, hits: 0, armed: true, matched };
  };

  const stagePlan = await waitForPlan(1500);
  const maxStages = stagePlan ? stagePlan.length : 3;
  const stages = [];
  for (let s = 0; s < maxStages; s += 1) {
    const kind = await waitForStage(s === 0 ? 5000 : 4000);
    if (!kind) break;
    const emittedBefore = await ev('window.__diags.length');
    stages.push(
      kind === 'xray' ? await driveXray() : kind === 'auscultation' ? await driveAuscult() : await driveLab(),
    );
    // 本段没回包说明没查完（超时走了兜底面板），不必再探测下一段。
    // 回包落在 onFinish 里，收尾动画可能比驱动结束稍晚，所以要轮询等而不是定长睡——
    // 定长睡既会漏掉刚推进的下一段，也会把下一段（听诊）的首拍睡进漏拍窗。
    if (!(await waitStageRecord(emittedBefore, 4000))) break;
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
  const rhythmStage = stages.filter((s) => s.variant === 'auscultation').pop();
  const rhythmNote = rhythmStage
    ? ` 听诊进场漏拍=${rhythmStage.entryMisses} 判定=${JSON.stringify(rhythmStage.grades)}（` +
      `${rhythmStage.grades.filter((g) => g === '完美').length}完美/` +
      `${rhythmStage.grades.filter((g) => g === '接住').length}接住/${rhythmStage.grades.length}拍）`
    : '';
  judge(
    'C03',
    `诊断 ${records.length}/${expectedStages} 段（${driven}）全部命中并通关`,
    records.length ? stagesPassed && advanced : expect > 0 && hits === expect && advanced,
    `段数=${records.length}/${expectedStages} 序列=${(stagePlan || []).join('→') || '未读到'} 命中=${hits}/${expect} ` +
      `state=${diagnosisState} probe=${stages.every((s) => s.armed) ? 'on' : 'off'}` +
      ` 各段=${JSON.stringify(records.map((r) => `${r.variant}:${r.found}/${r.total}${r.completed === true ? '' : ':未完成'}`))}${rhythmNote}`,
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
  if (ONETAKE) await shot('flow-10-treatment.png');
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
  if (ONETAKE) await shot('flow-11-recovery.png');

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
    canAdopt ? moving : !moving && /好感还差/.test(String(lockHint)),
    `adoptable=${canAdopt} range=${range}${canAdopt ? '' : ' ' + lockHint}`,
  );
  await shot('w19-adoption.png');
  if (ONETAKE) await shot('flow-12-adoption.png');

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

  /**
   * 一镜到底 13–16：真点「领养它」→ 结算页回大厅 → 小屋 TAB（habitatList 从 petsAdopted 补出这位新住户）
   * → 送养面板 → 扣 150 金币进审核 → 跳审核出结果 → 移出小屋。
   * 非一镜到底时保持原样：走全局返回 + 放弃确认，验的是返回链而不是送养链。
   */
  if (ONETAKE && canAdopt) {
    // 坞摘要 pill 的节点名在四块坞里是同一套（DockPillText_0_0…），FIND 只会命中先建出来的诊疗坞，
    // 所以住户增减直接读存档里的 habitat 数组，和小屋面板用的是同一份数据。
    const habitatIds = () =>
      ev(
        `(() => { const s = JSON.parse(localStorage.getItem('pet_save_v1') || '{}'); return (s.habitat || []).map((h) => h.petId).join(','); })()`,
      );
    await click('AdoptButton');
    if (!(await waitFor('LobbyButton', 8000))) throw new Error('领养后没进结算页');
    await sleep(900);
    await shot('flow-13-result.png');
    await click('LobbyButton');
    await waitFor('StartButton', 12000);
    judge('C09', '一镜到底：真领养走结算页「回大厅」，大厅重新就绪（不经放弃确认）', (await has('StartButton')) === true, '');

    // 回大厅时正好撞上成就里程碑弹窗：真实玩家必须先点掉才能继续，脚本用 emit 会穿透遮罩，所以先关掉再拍后面几帧。
    if (await has('MilestoneOverlay')) {
      await click('MilestoneLater');
      await sleep(600);
    }
    await click('Tab_habitat');
    if (!(await waitFor('RehomeButton', 6000))) throw new Error('小屋 TAB 没渲染出送养入口');
    await sleep(700);
    const housedAfterAdopt = await habitatIds();
    await shot('flow-14-habitat-tab.png');

    // 结果的随机数与 verify-care-browser.js 的 R06/R07 同款钉成 0：刚领养的住户照护度低，不钉就常走失败分支。
    await ev('window.Math.random = () => 0');
    await click('RehomeButton');
    if (!(await waitFor('RehomePanel', 6000))) throw new Error('送养面板没打开');
    await shot('flow-15-rehome-panel.png');
    await click('RehomePayCoins');
    await sleep(800);
    const reviewText = await label('RehomeWait');
    await click('RehomeSkip');
    if (!(await waitFor('RehomeResultTitle', 8000))) throw new Error('跳过审核后没出送养结果页');
    await sleep(600);
    await shot('flow-16-rehome-result.png');
    const resultTitle = await label('RehomeResultTitle');
    const thanksText = await label('RehomeCoins');
    await click('RehomeResultOk');
    await sleep(900);
    const housedAfterRehome = await habitatIds();
    const rehomedIds = await ev(
      `(() => { const s = JSON.parse(localStorage.getItem('pet_save_v1') || '{}'); return ((s.rehome || {}).rehomed || []).join(','); })()`,
    );
    const rehomedPet = String(rehomedIds).split(',')[0] || '';
    judge(
      'C12',
      '一镜到底尾链：小屋补出新住户 → 送养进审核 → 跳审核成功 → 移出 habitat 且 rehomed 落档（M1 不回屋）',
      !!rehomedPet &&
        String(housedAfterAdopt).indexOf(rehomedPet) >= 0 &&
        String(reviewText).indexOf('审核中 · 还需 30 分钟') === 0 &&
        resultTitle === '找到新家啦' &&
        /\+\d+ 金币/.test(String(thanksText)) &&
        String(housedAfterRehome).indexOf(rehomedPet) < 0,
      `领养后 habitat=${housedAfterAdopt}　审核=${reviewText}　结果=${resultTitle}/${thanksText}　送走后 habitat=${housedAfterRehome}　rehomed=${rehomedIds}`,
    );
  } else {
    if (ONETAKE) judge('C12', '一镜到底尾链：本局好感未达标，走不到真领养，送养链无住户', false, `adoptable=${canAdopt}`);
    await click('BackButton');
    await waitFor('AbandonOverlay', 3000);
    await click('AbandonLeave');
    await waitFor('StartButton', 6000);
    judge('C09', '全局返回 + 放弃确认后回到大厅', (await has('StartButton')) === true, `lobby=${await has('StartButton')}`);
  }

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
