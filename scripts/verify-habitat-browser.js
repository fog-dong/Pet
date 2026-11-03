// STATUS: implemented, W20-4 模块三 客户端全链路核验（CDP 驱动 web-mobile 构建，云函数用 mock 注入，不碰线上）
'use strict';
// 覆盖：大厅存档一致性、小屋四种触点扣费/满值/每日次数/跨天重置（点图标=喂食洗澡、点立绘=抚摸、
// 长按立绘=高级粮、拖动不误触）、买不起时热区变暗 + Toast 说明原因与余额守卫、
// 离线收益四分支（granted / 1003 频控 / coins=0 / 云端未接通）、领取连点幂等、贴图覆盖、互动合成哔声、
// 老年小毛病必命中用例（按当日 dayKey 反查命中的品种，验证扣爱心 + 当天只收一次）。
// W25 P0-B 起互动弹窗已删：断言不再读按钮 interactable/置灰文案，改读热区 UIOpacity 与点击后的 Toast 原因。
// 数值口径：2026-11-03 决策-4（喂食 30 金币 / 高级粮 8 爱心 / 洗澡 20 金币+5 爱心 / 抚摸 +10 且每天 3 次）
// 与决策-5（老年小毛病 25%、安抚 3 爱心）。
// 前置：本地起 web-mobile 构建静态服务 + headless Chrome 开 CDP 端口。
// 用法：node scripts/verify-habitat-browser.js <CDP端口> <站点端口> <截图前缀>

const fs = require('fs');
const path = require('path');

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
// 基准时刻在 Node 侧取一次：种子存档与断言共用同一个点，避免出现两处「现在」。
const T0 = Date.now();
/** 日期键格式与 cache/DayKey.ts 完全一致（月、日不补零）。 */
function dayKeyOf(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
const DAY_KEY = dayKeyOf(T0);

const DECAY_SRC = fs.readFileSync(path.join(__dirname, '..', 'assets/scripts/game/HabitatDecay.ts'), 'utf8');
/** 概率与安抚价从源码正则取，脚本里不抄第二份数字（改了源码这里会立刻对不上）。 */
const AILMENT_COST = Number(DECAY_SRC.match(/AILMENT_HEART_COST = (\d+)/)[1]);
const AILMENT_ODDS = Number(DECAY_SRC.match(/AILMENT_ODDS_PERCENT = (\d+)/)[1]);

const BARS_SRC = fs.readFileSync(path.join(__dirname, '..', 'assets/scripts/ui/HabitatBars.ts'), 'utf8');
/** 变暗档同样从源码正则取：触点只有「全亮 / 变暗」两档，脚本不能自己抄 92。 */
const ZONE_DIM = Number(BARS_SRC.match(/ZONE_DIM = (\d+)/)[1]);

/** game/HabitatDecay.ts 里 FNV-1a 的镜像，只用来反查「今天哪只必命中」；触发与否仍由页面自己判。
 *  镜像若与实现跑偏，选中的一定不是真命中的宠物，下面的扣爱心断言会直接 FAIL，不会静默放过。 */
function hash32(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}
/** 默认成员之外的品种，供老年用例追加进屋（避免同一 petId 在 habitat 里出现两次）。 */
const BASE_IDS = ['pet_husky', 'pet_british', 'pet_american', 'pet_calico', 'pet_samoyed', 'pet_shiba'];
const ALL_PETS = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'assets/bundles/cases/config/pets.json'), 'utf8'),
).pets.map((p) => p.petId);
/** 900 天超过全部品种的老年线（最长 420 天），所以无论选中谁都必定是老年档。 */
const SENIOR_DAYS = 900;
const STRUCK_PET = ALL_PETS.find((id) => !BASE_IDS.includes(id) && hash32(`${id}|${DAY_KEY}`) % 100 < AILMENT_ODDS) || null;

const results = [];
const skips = [];
function judge(id, title, pass, detail) {
  results.push({ id, title, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} [${id}] ${title}${detail ? ' → ' + detail : ''}`);
}

/** 数据条件今天凑不出来的用例：显式告知，绝不当成通过。 */
function skip(id, title, reason) {
  skips.push({ id, title, reason });
  console.log(`SKIP [${id}] ${title} → ${reason}`);
}

/** 汇总判定并落退出码；forced 非 0 时（如有未捕获异常或 ABORT）直接判失败。 */
function report(forced) {
  const failed = results.filter((r) => !r.pass);
  console.log(`\n合计 ${results.length} 条判定，PASS ${results.length - failed.length} / FAIL ${failed.length}`);
  failed.forEach((f) => console.log(`  FAIL ${f.id} ${f.title} → ${f.detail}`));
  skips.forEach((s) => console.log(`  ⚠️ SKIP ${s.id} ${s.title} → ${s.reason}`));
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

function seedSave(overrides) {
  const opts = Object.assign({}, overrides);
  const senior = opts.senior || null;
  delete opts.senior;
  const ids = BASE_IDS.slice();
  const habitat = [
    // 心情给 55 而不是 70：三次抚摸（+10×3）后是 85，仍然没满。
    // 满值判定在次数判定之前（HabitatModel.runHabitatAction），要是这里就摸满，第 4 次会被「心情已经满格啦」拦住，
    // 就测不到「今日抚摸次数已用完」这条分支了。
    { petId: 'pet_husky', hunger: 55, cleanliness: 40, mood: 55 },
    { petId: 'pet_british', hunger: 40, cleanliness: 60, mood: 60 },
    { petId: 'pet_american', hunger: 50, cleanliness: 50, mood: 50 },
    { petId: 'pet_calico', hunger: 50, cleanliness: 50, mood: 50 },
    { petId: 'pet_samoyed', hunger: 50, cleanliness: 50, mood: 50 },
    { petId: 'pet_shiba', hunger: 50, cleanliness: 50, mood: 60 },
  ];
  if (senior) {
    // 出生时间给到 900 天前、水位给到 T0：进屋既必定是老年档，又不会顺手补算出额外衰减。
    habitat.push({
      petId: senior,
      hunger: 50,
      cleanliness: 50,
      mood: 70,
      birthTimestamp: T0 - SENIOR_DAYS * DAY,
      lastDecayAt: T0,
      soothedDay: '',
    });
    ids.push(senior);
  }
  const base = {
    coins: 1200,
    // 16 爱心 = 高级粮 8 + 洗澡 5，走完两档爱心消耗后还剩 3，正好也能付一次老年安抚（决策-5）。
    hearts: 16,
    petsSeen: ids,
    petsAdopted: ids,
    adoptedAt: { pet_husky: '2026-10-1' },
    habitat,
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
    habitatLastClaimAt: 0,
  };
  return JSON.stringify(Object.assign(base, opts));
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
  /** 小屋触点（图标热区 / 小键 / 立绘）走 TOUCH_START/TOUCH_END + 位移阈值，不是 Button：用同一坐标的成对触摸事件模拟轻点。 */
  const tap = (nm) =>
    ev(`(() => {
      const n = (${FIND})('${nm}'); if (!n) return 0;
      const e = { getUILocation: () => ({ x: 0, y: 0 }) };
      n.emit('touch-start', e);
      n.emit('touch-end', e);
      return 1;
    })()`);
  /** 长按：抬手前停留 500 ms（> HOLD_MS 350），中途不发 TOUCH_MOVE，位移判定自然为 0。 */
  const hold = async (nm) => {
    await ev(`(() => { const n = (${FIND})('${nm}'); if (!n) return 0; n.emit('touch-start', { getUILocation: () => ({ x: 0, y: 0 }) }); return 1; })()`);
    await sleep(520);
    await ev(`(() => { const n = (${FIND})('${nm}'); if (!n) return 0; n.emit('touch-end', { getUILocation: () => ({ x: 0, y: 0 }) }); return 1; })()`);
  };
  /** 从触点起手向下拖 200 px 再抬手：位移远超 TAP_SLOP，短按与长按都不该触发（列表滚动不能误扣费）。 */
  const dragFrom = async (nm) => {
    await ev(`(() => {
      const n = (${FIND})('${nm}'); if (!n) return 0;
      window.__start = { getUILocation: () => ({ x: 0, y: 0 }) };
      window.__away = { getUILocation: () => ({ x: 0, y: -200 }) };
      n.emit('touch-start', window.__start);
      n.emit('touch-move', window.__away);
      return 1;
    })()`);
    await sleep(520);
    await ev(`(() => { const n = (${FIND})('${nm}'); if (!n) return 0; n.emit('touch-end', window.__away); return 1; })()`);
  };
  /** 动作 → 触点节点：高级粮走小键，抚摸走立绘（图标只是备用入口），喂食/洗澡走对应属性圆钮。 */
  const hitNode = (petId, action) => {
    if (action === 'premium') {
      return `HabitatChip_${petId}`;
    }
    if (action === 'pet') {
      return `HabitatPortrait_${petId}`;
    }
    return `HabitatZone_${action === 'feed' ? 'hunger' : 'cleanliness'}_${petId}`;
  };
  const hit = (petId, action) => tap(hitNode(petId, action));
  /** 触点透明度：W25 之后"买不起"不再靠按钮文案表达，只有这一档可见度 + 点击后的 Toast。 */
  const opacity = (nm) =>
    ev(`(() => { const n = (${FIND})('${nm}'); const o = n && n.getComponent('cc.UIOpacity'); return o ? o.opacity : null; })()`);
  const label = (nm) => ev(`(() => { const n = (${FIND})('${nm}'); const c = n && n.getComponent('cc.Label'); return c ? c.string : null; })()`);
  const btnState = (nm) =>
    ev(`(() => {
      const n = (${FIND})('${nm}'); if (!n) return 'missing';
      const b = n.getComponent('cc.Button'); const l = n.getChildByName('${nm}Label');
      return JSON.stringify({ on: b ? b.interactable : null, text: l ? l.getComponent('cc.Label').string : null });
    })()`);
  const save = (path) => ev(`(() => { const s = JSON.parse(localStorage.getItem('pet_save_v1')); return ${path}; })()`);
  const anyPetState = (petId, field) =>
    ev(`(() => { const h = JSON.parse(localStorage.getItem('pet_save_v1')).habitat.find(x=>x.petId==='${petId}'); return h ? h.${field} : null; })()`);
  const petState = (field) => anyPetState('pet_husky', field);
  /** 阶段标签节点名是 `StageTag_<stage>`（不含 petId），文字又在它的 StageTagText 子节点里，所以按卡片往下找。 */
  const stageTag = (petId) =>
    ev(`(() => {
      const card = (${FIND})('HabitatCard_${petId}');
      if (!card) return null;
      let text = null;
      (function walk(n) {
        if (n.name.indexOf('StageTag_') === 0) { const t = n.getChildByName('StageTagText'); text = t ? t.getComponent('cc.Label').string : '?'; }
        n.children.forEach(walk);
      })(card);
      return text;
    })()`);
  const claimCalls = () => ev(`window.__calls.filter(c=>c==='claimHabitat').length`);
  const shot = async (file) => {
    const img = await cdp.call('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`${SHOT_DIR}/${file}.png`, Buffer.from(img.data, 'base64'));
    console.log('shot', file);
  };

  async function boot(cloudEnv, saveOverrides, waitMs = 4200) {
    // `pet_api_base_v1='off'`：源码里有自建 HTTP 默认地址（决策-6d），浏览器用例必须显式关掉这条通路，
    // 否则会去请求真线上后端、而且 mock 的 wx 没有 request；关掉后按 cloudEnv 决定走 mock 云还是本地模式。
    await ev(`${cloudEnv ? `localStorage.setItem('pet_cloud_env_v1','mock-env-id');` : `localStorage.removeItem('pet_cloud_env_v1');`}
      localStorage.setItem('pet_api_base_v1', 'off');
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
  /** 热区要单独等：卡片是逐个建的，只等 HabitatPanel 会在第一条热区还没挂上时返回。 */
  const readyCard = async (petId) => {
    if (!(await waitFor(`HabitatZone_hunger_${petId}`))) {
      throw new Error(`HabitatZone_hunger_${petId} not found`);
    }
    await sleep(700);
  };
  /** 打开面板并等到某只的触点就绪——W25 之后这就是"进入互动态"的全部步骤。 */
  const openCard = async (petId = 'pet_husky') => {
    await openPanel();
    await readyCard(petId);
  };

  // === 1. 小屋互动：扣费 / 免费路径 / 每日次数 / 满值 / 音效兜底 / 贴图覆盖 ===
  console.log('\n=== 1. 小屋互动（coins 1200 / hearts 16）===');
  await boot(true, {});
  judge(
    'L01',
    '大厅 HUD 与存档一致',
    (await label('CoinPillLabel')) === '1200' && (await label('HeartPillLabel')) === '16',
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
  await shot(`${OUT}-1-list`);
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

  await openCard('pet_husky');
  const fiveTargets = await ev(
    `['HabitatZone_hunger_pet_husky','HabitatZone_cleanliness_pet_husky','HabitatZone_mood_pet_husky','HabitatChip_pet_husky','HabitatPortrait_pet_husky'].map(nm => !!(${FIND})(nm)).join(',')`,
  );
  judge(
    'W23-2a',
    '五种互动触点齐备（喂食 / 洗澡 / 心情图标 + 高级粮小键 + 立绘）',
    fiveTargets === 'true,true,true,true,true',
    fiveTargets,
  );
  const before = { coins: await save('s.coins'), hearts: await save('s.hearts') };
  await ev('window.__tones = []');
  await hit('pet_husky', 'feed');
  await sleep(500);
  judge(
    'L21',
    '喂食扣 30 金币、饱食 +30（决策-4）',
    (await save('s.coins')) === before.coins - 30 && (await petState('hunger')) === 85,
    `coins ${before.coins}→${await save('s.coins')}, hunger 55→${await petState('hunger')}`,
  );
  await hit('pet_husky', 'premium');
  await sleep(400);
  // 飘字节点 0.9 s 自毁，且求值按源码顺序走：先抓飘字再抓其余，否则条件里排在后面的读取会拿到 null。
  const premium = { float: await label('FloatText'), hunger: await petState('hunger'), hearts: await save('s.hearts') };
  judge(
    'L26',
    '高级粮扣 8 爱心、饱食 +70 并夹到满值（85+70→100）',
    premium.hearts === before.hearts - 8 && premium.hunger === 100 && premium.float === '+70 饱食度',
    `hearts ${before.hearts}→${premium.hearts}, hunger 85→${premium.hunger}, float=${premium.float}`,
  );
  await hit('pet_husky', 'bath');
  await sleep(500);
  judge(
    'L22',
    '洗澡扣 20 金币 + 5 爱心、清洁 +35（决策-4：在 §2.2 的 20 金币之外加收 5 爱心）',
    (await save('s.coins')) === before.coins - 50 && (await save('s.hearts')) === before.hearts - 13 && (await petState('cleanliness')) === 75,
    `coins ${before.coins}→${await save('s.coins')} hearts ${before.hearts}→${await save('s.hearts')} clean 40→${await petState('cleanliness')}`,
  );
  const petSteps = [];
  for (let i = 0; i < 3; i++) {
    await hit('pet_husky', 'pet');
    await sleep(450);
    petSteps.push({ mood: await petState('mood'), count: await save('s.pettedCount') });
  }
  judge(
    'L23',
    '抚摸免费、每次心情 +10（决策-4），连点三次分别计 1/2/3 次',
    petSteps.map((s) => s.mood).join(',') === '65,75,85' && petSteps.map((s) => s.count).join(',') === '1,2,3',
    `coins 不变(${await save('s.coins')}) steps=${JSON.stringify(petSteps)}`,
  );
  const moodZone = await opacity('HabitatZone_mood_pet_husky');
  const quotaLine = await label('HabitatQuotaLabel');
  judge(
    'W23-2b',
    '三次用满后心情图标当场变暗、引导行同步写明「今日剩 0 次」（弹窗删除后没有按钮文案可写，决策-6b 改由透明度 + 引导行承担）',
    moodZone === ZONE_DIM && /今日剩 0 次/.test(String(quotaLine)),
    `zone=${moodZone} hint=${quotaLine}`,
  );
  await hit('pet_husky', 'pet');
  await sleep(450);
  judge(
    'B02',
    '变暗不拦事件，第 4 次点立绘仍被数据层拦住：不加值、不计数，只提示次数用尽',
    (await petState('mood')) === 85 && (await save('s.pettedCount')) === 3 && /今日抚摸次数已用完/.test(String(await label('ToastLabel'))),
    `mood=${await petState('mood')} count=${await save('s.pettedCount')} toast=${await label('ToastLabel')}`,
  );
  const tones = JSON.parse(await ev('JSON.stringify(window.__tones)'));
  const freqs = tones.map((t) => t.freq);
  judge(
    'S01',
    '六次放行各发一条合成哔声，三个 cue 音高互不相同；高级粮复用 feed 键所以与第一次同音高',
    freqs.length === 6 && new Set(freqs).size === 3 && freqs[0] === freqs[1],
    tones.map((t) => `${t.type}:${t.freq}`).join(' '),
  );
  await shot(`${OUT}-2-card-actions`);
  const coinsAtFull = await save('s.coins');
  await hit('pet_husky', 'feed');
  await sleep(450);
  judge(
    'L24',
    '属性满值只提示不扣费（饱食已 100，喂食不再扣 30 金币）',
    (await petState('hunger')) === 100 && (await save('s.coins')) === coinsAtFull && /已经吃饱啦/.test(String(await label('ToastLabel'))),
    `hunger=${await petState('hunger')} coins=${coinsAtFull}→${await save('s.coins')} toast=${await label('ToastLabel')}`,
  );
  await readyCard('pet_british');
  const sharedDim = await opacity('HabitatZone_mood_pet_british');
  await hit('pet_british', 'pet');
  await sleep(450);
  judge(
    'W23-1a',
    '每日 3 次是全局计数（方案 §2.1 字段挂 SaveData）：换一只没摸过的照样变暗、点了不加值',
    sharedDim === ZONE_DIM &&
      (await anyPetState('pet_british', 'mood')) === 60 &&
      /今日抚摸次数已用完/.test(String(await label('ToastLabel'))),
    `zone=${sharedDim} 奶豆 mood=${await anyPetState('pet_british', 'mood')} toast=${await label('ToastLabel')}`,
  );
  await shot(`${OUT}-2b-panel`);

  // === 1.5 W25 触点语义：点立绘=抚摸 / 长按立绘=高级粮 / 点图标=对应动作 / 拖动不误触 ===
  console.log('\n=== 1.5 触点语义（W25 P0-B）===');
  await boot(true, {});
  await openCard('pet_husky');
  const t15 = { coins: await save('s.coins'), hearts: await save('s.hearts') };
  await hit('pet_husky', 'pet');
  await sleep(400);
  // 飘字节点 0.9 s 后自毁：先一次性抓完快照再判定，且飘字排在最前——对象字面量按源码顺序 await，
  // 把它放最后等于让它多等四个往返，日志里就会印出误导性的 float=null。
  const s15 = {
    float: await label('FloatText'),
    mood: await petState('mood'),
    coins: await save('s.coins'),
    hearts: await save('s.hearts'),
    count: await save('s.pettedCount'),
  };
  judge(
    'W25-1a',
    '点立绘即抚摸（弹窗套娃删掉后的主入口）：心情 +10、分文不扣、计数与飘字同步',
    s15.mood === 65 && s15.coins === t15.coins && s15.hearts === t15.hearts && s15.count === 1 && s15.float === '+10 心情',
    `mood 55→${s15.mood} hearts=${s15.hearts} count=${s15.count} float=${s15.float}`,
  );
  await hold('HabitatPortrait_pet_husky');
  await sleep(700);
  judge(
    'W25-1b',
    '长按立绘即高级粮（拍板-3 的快捷方式）：扣 8 爱心、饱食 55+70→100，且不占用抚摸次数',
    (await save('s.hearts')) === t15.hearts - 8 && (await petState('hunger')) === 100 && (await save('s.pettedCount')) === 1,
    `hearts ${t15.hearts}→${await save('s.hearts')} hunger 55→${await petState('hunger')} count=${await save('s.pettedCount')}`,
  );
  await tap('HabitatZone_mood_pet_husky');
  await sleep(500);
  judge(
    'W25-1c',
    '点心情图标与点立绘是同一个动作：第 2 次抚摸照常 +10（图标即按钮，不是只读进度条）',
    (await petState('mood')) === 75 && (await save('s.pettedCount')) === 2,
    `mood→${await petState('mood')} count=${await save('s.pettedCount')}`,
  );
  const t15b = { coins: await save('s.coins'), hearts: await save('s.hearts'), mood: await petState('mood') };
  await dragFrom('HabitatPortrait_pet_husky');
  await sleep(500);
  judge(
    'W25-1d',
    '从立绘起手拖 200 px 是滚动不是点选：短按与长按都不触发，属性、计数与余额分文不动',
    (await petState('mood')) === t15b.mood &&
      (await save('s.pettedCount')) === 2 &&
      (await save('s.coins')) === t15b.coins &&
      (await save('s.hearts')) === t15b.hearts,
    `mood ${t15b.mood}→${await petState('mood')} count=${await save('s.pettedCount')} coins ${t15b.coins}→${await save('s.coins')} hearts ${t15b.hearts}→${await save('s.hearts')}`,
  );
  await shot(`${OUT}-2c-tap-semantic`);

  // === 2. 离线收益四分支 ===
  console.log('\n=== 2. 离线收益四分支 ===');
  const coinsPreClaim = await save('s.coins');
  await click('HabitatClaim');
  await sleep(400);
  const floatTxt = await label('FloatText');
  await shot(`${OUT}-3-claim-granted`);
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
  await shot(`${OUT}-3b-claim-granted-toast`);

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
  await shot(`${OUT}-4-claim-limited`);
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
  const b1Coins = await save('s.coins');
  await hit('pet_husky', 'feed');
  await sleep(500);
  judge(
    'B01',
    '断网小屋照常互动（本地扣 30 金币 + 本地属性，不发云端请求）',
    (await save('s.coins')) === b1Coins - 30 && (await claimCalls()) === 0,
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
  await readyCard('pet_husky');
  judge(
    'M22',
    '整页重载后饱食度与金币都不回初值（本地存档持久化）',
    (await petState('hunger')) === hungerPreReload && (await save('s.coins')) === coinsPreReload,
    `hunger ${hungerPreReload}→${await petState('hunger')} coins ${coinsPreReload}→${await save('s.coins')}`,
  );

  // === 4. 每日次数跨天重置：昨天用满 3 次，今天重新起算 ===
  console.log('\n=== 4. 抚摸次数跨天重置 ===');
  await boot(true, { pettedDay: dayKeyOf(T0 - 2 * DAY), pettedCount: 3 });
  await openCard();
  const cdCoins = await save('s.coins');
  const cdZone = await opacity('HabitatZone_mood_pet_husky');
  const cdHint = await label('HabitatQuotaLabel');
  judge(
    'W23-1b',
    '昨日计数满 3 也不算今天用完：心情图标全亮、引导行写明余量（今日剩 3 次）',
    cdZone === 255 && /今日剩 3 次/.test(String(cdHint)),
    `zone=${cdZone} hint=${cdHint}`,
  );
  await hit('pet_husky', 'pet');
  await sleep(500);
  judge(
    'B04',
    '昨天用满、今天不拦：心情照常 +10，计数改挂到今天并从 1 重起',
    (await petState('mood')) === 65 &&
      (await save('s.coins')) === cdCoins &&
      (await save('s.pettedDay')) === DAY_KEY &&
      (await save('s.pettedCount')) === 1,
    `mood 55→${await petState('mood')} day=${await save('s.pettedDay')} count=${await save('s.pettedCount')}`,
  );

  // === 5. 买不起：热区变暗 + 点了给原因 + 免费路径不断链 ===
  console.log('\n=== 5. 买不起时热区变暗，抚摸仍免费可点 ===');
  await boot(true, { coins: 5, hearts: 2 });
  await openCard();
  const dimFeed = await opacity('HabitatZone_hunger_pet_husky');
  const dimBath = await opacity('HabitatZone_cleanliness_pet_husky');
  const dimPremium = await opacity('HabitatChip_pet_husky');
  const litPet = await opacity('HabitatZone_mood_pet_husky');
  const shortageHint = await label('HabitatQuotaLabel');
  await shot(`${OUT}-5-shortage`);
  // 决策-6b 在 W25 的形态：图标钮没有文字可写原因，所以拆成两段——
  // 事前用透明度标「这一档现在不行」（动作名由图标自己表达），事后由 Toast 给完整原因。
  judge('L21b', '喂食热区金币不足（需 30）时变暗，不是消失', dimFeed === ZONE_DIM, `zone=${dimFeed}`);
  judge('L26b', '高级粮小键爱心不足（需 8）时变暗', dimPremium === ZONE_DIM, `chip=${dimPremium}`);
  judge('L22b', '洗澡热区金币先卡住（需 20，同一档还含 5 爱心）', dimBath === ZONE_DIM, `zone=${dimBath}`);
  judge(
    'L23b',
    '买不起时零成本路径（点立绘摸一摸 · 今日剩 3 次）仍然全亮',
    litPet === 255 && /今日剩 3 次/.test(String(shortageHint)),
    `zone=${litPet} hint=${shortageHint}`,
  );
  // 变暗只是可见度、不拦事件（没有 Button.interactable 可绕）：这里直接点暗掉的触点，验第二道防线——谓词自身的余额守卫。
  const coinsPreSpend = await save('s.coins');
  const heartsPreSpend = await save('s.hearts');
  await hit('pet_husky', 'feed');
  await sleep(500);
  judge(
    'L21c',
    '点了暗掉的喂食钮也不扣成负数，Toast 写明「金币不足（需 30）」',
    (await save('s.coins')) === coinsPreSpend && /金币不足（需 30）/.test(String(await label('ToastLabel'))),
    `coins ${coinsPreSpend}→${await save('s.coins')} toast=${await label('ToastLabel')}`,
  );
  await hit('pet_husky', 'premium');
  await sleep(500);
  judge(
    'L26c',
    '点了暗掉的高级粮小键同样分文不动，Toast 写明「爱心不足（需 8）」',
    (await save('s.hearts')) === heartsPreSpend && /爱心不足（需 8）/.test(String(await label('ToastLabel'))),
    `hearts ${heartsPreSpend}→${await save('s.hearts')} toast=${await label('ToastLabel')}`,
  );
  await hit('pet_husky', 'pet');
  await sleep(500);
  judge('L23c', '买不起时免费抚摸照样能加心情（零成本回访路径不断链）', (await petState('mood')) === 65, `mood→${await petState('mood')}`);

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

  // === 7. 老年小毛病必命中（决策-5：25% 概率、安抚 3 爱心、当天只收一次）===
  console.log('\n=== 7. 老年小毛病必命中用例 ===');
  console.log(`     今日日期键=${DAY_KEY}，反查命中品种=${STRUCK_PET || '（无）'}，安抚价=${AILMENT_COST} 爱心，概率=${AILMENT_ODDS}%`);
  if (!STRUCK_PET) {
    skip(
      'A01',
      '老年小毛病扣爱心',
      `20 只品种在 dayKey=${DAY_KEY} 下没有一个 hash 落在 ${AILMENT_ODDS}% 以内（约 3% 的日子会这样）；换一天重跑即可复现，不是代码缺陷`,
    );
  } else {
    await boot(true, { senior: STRUCK_PET });
    await openCard(STRUCK_PET);
    const struckTag = await stageTag(STRUCK_PET);
    const heartsPreStrike = await save('s.hearts');
    const coinsPreStrike = await save('s.coins');
    const moodPreStrike = await anyPetState(STRUCK_PET, 'mood');
    await hit(STRUCK_PET, 'pet');
    await sleep(400);
    // 同上：飘字与 Toast 都是短命节点，一次性按「飘字 → Toast → 存档」的顺序抓完再判定。
    const strike = {
      float: await label('FloatText'),
      toast: await label('ToastLabel'),
      mood: await anyPetState(STRUCK_PET, 'mood'),
      hearts: await save('s.hearts'),
    };
    judge(
      'A01',
      `老年 ${STRUCK_PET} 今日必命中：点立绘的免费抚摸照样扣 ${AILMENT_COST} 爱心，心情只按老年档 +5`,
      moodPreStrike === 70 &&
        strike.mood === 75 &&
        strike.hearts === heartsPreStrike - AILMENT_COST &&
        strike.float === '+5 心情' &&
        /安抚/.test(String(strike.toast)),
      `阶段标签=${struckTag} mood ${moodPreStrike}→${strike.mood} hearts ${heartsPreStrike}→${strike.hearts} float=${strike.float} toast=${strike.toast}`,
    );
    judge(
      'A02',
      `安抚日期键写入当天（soothedDay === ${DAY_KEY}）`,
      (await anyPetState(STRUCK_PET, 'soothedDay')) === DAY_KEY,
      `soothedDay=${await anyPetState(STRUCK_PET, 'soothedDay')}`,
    );
    judge('A04', '命中前提是老年档：卡片阶段标签确实写着「老年」', struckTag === '老年', String(struckTag));
    await shot(`${OUT}-7-ailment`);
    // 同一天第二次互动：规则本身的消耗照扣，但不再重复收安抚费。
    await hit(STRUCK_PET, 'feed');
    await sleep(600);
    judge(
      'A03',
      '当天不再重复安抚：第二次互动只扣喂食自己的 30 金币，爱心分文不动',
      (await save('s.hearts')) === strike.hearts &&
        (await save('s.coins')) === coinsPreStrike - 30 &&
        (await anyPetState(STRUCK_PET, 'hunger')) === 80,
      `hearts=${await save('s.hearts')} coins ${coinsPreStrike}→${await save('s.coins')} hunger 50→${await anyPetState(STRUCK_PET, 'hunger')}`,
    );
  }

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
