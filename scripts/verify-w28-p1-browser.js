// STATUS: implemented, W28 P1 三条收尾验收（CDP 驱动 web-mobile 构建；只读本地存档，不碰线上）
// 覆盖：P1-1 缺驱虫药剂时护理面板有可点出路、P1-2 缺爱心时小屋引导行换成获取指引、
// P1-3 装修买不起的行直接禁用并写「差 N 金币」，以及三处「资源够了就不该出现指引」的反例。
// W31 追加：装修小店 4 套大卡 / 差额卡角 / 双联预览（大厅 + 小屋）/ 差额态置灰不弹确认 / 有钱档恢复原价。
// W31 再追加：真买下樱花 → 存档 habitatTheme=sakura 且金币扣到 3680 → 退出小屋截大厅换色图。
// W32 追加：大厅房间层（窗 / 走时挂钟 / 光柱）与封面宠（最新领养站在柜台后、带呼吸习性、散步带不重复）。
// 前置：本地起 web-mobile 构建静态服务 + headless Chrome 开 CDP 端口。
// 用法：node scripts/verify-w28-p1-browser.js <CDP端口> <站点端口> <截图前缀>
'use strict';

const fs = require('fs');

const CDP_PORT = Number(process.argv[2] || 9458);
const PORT = Number(process.argv[3] || 8103);
const OUT = process.argv[4] || 'w28p1';
const SHOT_DIR = process.env.SHOT_DIR || 'build';
fs.mkdirSync(SHOT_DIR, { recursive: true });
const W = Number(process.env.CDP_W || 720);
const H = Number(process.env.CDP_H || 1280);
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
 * 种子默认「三样都缺」：hearts 2 买不起 8 爱心高级粮、coins 80 买不起 320 樱花小筑、items 空即没驱虫药剂。
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
      // birth 可逐只覆盖：封面宠判定靠「最晚到家」，同批种子必须能造出新旧差。
      birthTimestamp: (opts.birth && opts.birth[petId]) || now - 86400000,
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
  // P0-6：全链路的非 2xx / 加载失败都要留痕，不再只靠肉眼数控制台。
  const netBad = [];
  cdp.on('Network.responseReceived', (p) => {
    if (p.response && p.response.status >= 400) netBad.push(`${p.response.status} ${p.response.url}`);
  });
  cdp.on('Network.loadingFailed', (p) => netBad.push(`${p.errorText}${p.blockedReason ? ' ' + p.blockedReason : ''}`));
  const consoleErrors = [];
  cdp.on('Runtime.consoleAPICalled', (p) => {
    if (p.type !== 'error') return;
    const text = (p.args || []).map((a) => a.value || a.description || a.unserializableValue || '').join(' ');
    consoleErrors.push(String(text).slice(0, 200));
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
  const countThemes = () =>
    ev(`(() => {
      let total = 0;
      const walk = (n) => {
        if (n.name.startsWith('ThemePick_')) total++;
        n.children.forEach(walk);
      };
      const s = cc.director.getScene();
      if (s) walk(s);
      return total;
    })()`);
  const countCoverPets = () =>
    ev(`(() => {
      let total = 0;
      const walk = (n) => {
        if (n.name.startsWith('LobbyCoverPet_')) total++;
        n.children.forEach(walk);
      };
      const s = cc.director.getScene();
      if (s) walk(s);
      return total;
    })()`);
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

  console.log('\n=== 5. 装修 B2/B4：四套大卡 + 差额不下架 + 预览里置灰但给出路 ===');
  await boot({});
  await openHabitat();
  await click('HabitatThemeEntry');
  if (!(await waitFor('ThemePanel', 12000))) throw new Error('装修弹窗没打开');
  await sleep(700);
  judge('W16', '四套主题都在（奶油 / 樱花 / 海盐 / 森林）', await countThemes() === 4, `现有=${await countThemes()}`);
  const sakuraBadge = await label('ThemeBadgeText_sakura');
  judge('W17', '樱花卡角写「差 240 金币」（320−80，当场算差额）', sakuraBadge === '差 240 金币', `文案=${sakuraBadge}`);
  const seaBadge = await label('ThemeBadgeText_sea');
  judge('W18', '海盐同样是差额口径（480−80）', seaBadge === '差 400 金币', `文案=${seaBadge}`);
  judge('W19', '默认主题是「使用中」而非价格', (await label('ThemeBadgeText_clinic')) === '使用中', `文案=${await label('ThemeBadgeText_clinic')}`);
  judge('W20', '买不起的卡仍可点开预览（不下架）', (await interactable('ThemePick_sakura')) === true, `interactable=${await interactable('ThemePick_sakura')}`);
  await shot(`${OUT}-3-theme-lack`);
  const coinsBefore = await label('ThemeCoins');
  await click('ThemePick_sakura');
  if (!(await waitFor('ThemePreview', 12000))) throw new Error('双联预览没打开');
  await sleep(600);
  const lobbyMini = await has('MiniLobbyCard');
  const roomMini = await has('MiniRoomCard');
  judge('W21', '预览是双联：大厅 + 小屋两块同时在', lobbyMini && roomMini, `大厅=${lobbyMini} 小屋=${roomMini}`);
  judge('W22', '差额态主按钮保留动作名并写差额', (await label('ThemeBuy')) === '购买主题（差 240）', `文案=${await label('ThemeBuy')}`);
  judge('W23', '差额态主按钮禁用', (await interactable('ThemeBuy')) === false, `interactable=${await interactable('ThemeBuy')}`);
  judge('W24', '差额态给唯一出路（去后院赚金币）', (await has('ThemeBuyGuide')) === true, `ThemeBuyGuide=${await has('ThemeBuyGuide')}`);
  await shot(`${OUT}-4-theme-preview-lack`);
  await click('ThemeBuy');
  await sleep(600);
  judge('W25', '禁用后点下去不弹确认（旧缺口）', (await has('ChoicePanel')) === false, `ChoicePanel=${await has('ChoicePanel')}`);
  judge('W26', '金币分文未动', (await label('ThemeCoins')) === coinsBefore, `${coinsBefore} → ${await label('ThemeCoins')}`);
  await click('ThemePreviewBack');
  await sleep(500);

  console.log('\n=== 6. 反例：钱够了恢复原价、预览可购买、不硬塞指引 ===');
  await boot({ coins: 4000 });
  await openHabitat();
  await click('HabitatThemeEntry');
  if (!(await waitFor('ThemePanel', 12000))) throw new Error('装修弹窗没打开（有钱档）');
  await sleep(700);
  judge('W27', '买得起时卡角回到「320 金币」', (await label('ThemeBadgeText_sakura')) === '320 金币', `文案=${await label('ThemeBadgeText_sakura')}`);
  judge('W28', '全档买得起时副标题归位（不硬塞指引）', (await has('ThemeSubtitle')) === true, `ThemeSubtitle=${await has('ThemeSubtitle')}`);
  await shot(`${OUT}-5-theme-afford-grid`);
  await click('ThemePick_sakura');
  if (!(await waitFor('ThemePreview', 12000))) throw new Error('双联预览没打开（有钱档）');
  await sleep(600);
  judge('W29', '买得起时主按钮可点', (await interactable('ThemeBuy')) === true, `interactable=${await interactable('ThemeBuy')}`);
  judge('W30', '买得起时不再出现差额指引', (await has('ThemeBuyGuide')) === false, `ThemeBuyGuide=${await has('ThemeBuyGuide')}`);
  await shot(`${OUT}-6-theme-preview-afford`);
  await click('ThemeBuy');
  await sleep(500);
  judge('W31', '可购买时先弹二次确认（320 不是小数目）', (await has('ChoicePanel')) === true, `ChoicePanel=${await has('ChoicePanel')}`);
  // 确认层盖在预览上：先「再想想」收回，再退回网格、关掉小店。
  await click('ChoiceAction1');
  await sleep(400);
  judge('W32', '取消后确认层收起且预览还在', (await has('ChoicePanel')) === false && (await has('ThemePreview')) === true, `ChoicePanel=${await has('ChoicePanel')} ThemePreview=${await has('ThemePreview')}`);
  await click('ThemePreviewBack');
  await sleep(500);
  await click('ThemeClose');
  await sleep(600);

  console.log('\n=== 7. B5：真买下樱花 → 存档切主题 → 大厅底板同步 ===');
  await boot({ coins: 4000 });
  await openHabitat();
  await click('HabitatThemeEntry');
  if (!(await waitFor('ThemePanel', 12000))) throw new Error('装修弹窗没打开（买下档）');
  await sleep(700);
  await click('ThemePick_sakura');
  if (!(await waitFor('ThemePreview', 12000))) throw new Error('双联预览没打开（买下档）');
  await sleep(600);
  await click('ThemeBuy');
  await sleep(500);
  if (!(await has('ChoicePanel'))) throw new Error('购买确认层没出现（买下档）');
  await click('ChoiceAction0');
  await sleep(900);
  const saved = await ev(`(() => {
    try {
      const s = JSON.parse(localStorage.getItem('pet_save_v1') || '{}');
      return JSON.stringify({ theme: s.habitatTheme, coins: s.coins, owned: s.habitatThemes || [] });
    } catch (e) { return 'ERR'; }
  })()`);
  const applied = JSON.parse(saved);
  judge('W34', '确认买下后存档切成樱花（habitatTheme=sakura）', applied.theme === 'sakura', `存档=${saved}`);
  judge('W35', '金币 4000→3680 且樱花进入已购列表', applied.coins === 3680 && applied.owned.includes('sakura'), `coins=${applied.coins} owned=${applied.owned.join(',')}`);
  await click('HabitatClose');
  await sleep(1000);
  judge('W36', '退出小屋回到大厅（面板已收起）', (await live('HabitatPanel')) !== true && (await ev(SCENE)) === 'Lobby', `面板=${await live('HabitatPanel')} 场景=${await ev(SCENE)}`);
  await shot(`${OUT}-7-theme-applied-lobby`);

  console.log('\n=== 8. W32：大厅不再是一面空墙，最新领养的那只站上封面位 ===');
  const now = Date.now();
  await boot({ birth: { pet_husky: now - 86400000 * 9, pet_british: now - 3600000 } });
  judge('X1', '房间层三件都在：窗 / 挂钟 / 窗光', (await has('LobbyWindow')) && (await has('LobbyClock')) && (await has('LobbyWindowLight')), `窗=${await has('LobbyWindow')} 钟=${await has('LobbyClock')} 光=${await has('LobbyWindowLight')}`);
  const secAngle = () =>
    ev(`(() => { const n = (${FIND})('LobbyClockSecond'); return n ? n.angle : null; })()`);
  const a1 = await secAngle();
  await sleep(1300);
  const a2 = await secAngle();
  judge('X2', '秒针在走（真实时间起转，不是画上去的刻度）', a1 !== null && a2 !== null && Math.abs(a2 - a1) >= 4, `${a1} → ${a2}`);
  judge('X3', '封面是最近领养的布偶（旧的金毛不占封面）', (await has('LobbyCoverPet_pet_british')) === true && (await has('LobbyCoverPet_pet_husky')) === false, `布偶=${await has('LobbyCoverPet_pet_british')} 金毛=${await has('LobbyCoverPet_pet_husky')}`);
  const breathScale = () =>
    ev(`(() => { const n = (${FIND})('LobbyCoverPet_pet_british'); if (!n) return null; const c = n.getChildByName('Content'); return c ? Math.round(c.scale.x * 10000) / 10000 : null; })()`);
  const s1 = await breathScale();
  await sleep(1200);
  const s2 = await breathScale();
  judge('X4', '封面宠在呼吸/习性循环（不是一张贴图定在那儿）', s1 !== null && s2 !== null && s1 !== s2, `scale ${s1} → ${s2}`);
  judge('X5', '同一只不会同屏出现两次：散步带只剩金毛', (await has('LobbyPet_pet_husky')) === true && (await has('LobbyPet_pet_british')) === false, `金毛=${await has('LobbyPet_pet_husky')} 布偶=${await has('LobbyPet_pet_british')}`);
  judge('X6', '两只有宠时不再挂空带立牌', (await has('LobbyPetBandEmpty')) === false, `空牌=${await has('LobbyPetBandEmpty')}`);
  await shot(`${OUT}-8-lobby-cover-pet`);
  await tap('LobbyCoverPet_pet_british');
  if (!(await waitFor('HabitatPanel', 12000))) throw new Error('点封面宠没开小屋');
  await sleep(700);
  judge('X7', '点封面宠直接进小屋（门面也是入口）', (await has('HabitatPanel')) === true, `小屋=${await has('HabitatPanel')}`);

  console.log('\n=== 9. 反例：一只都没领养时，封面位空着、空带立牌回来 ===');
  await boot({ pets: [] });
  judge('X8', '没宠物时封面位真的空着（不留占位立绘）', (await countCoverPets()) === 0, `封面宠=${await countCoverPets()}`);
  judge('X9', '没宠物时散步带回到「去救一只」立牌', (await has('LobbyPetBandEmpty')) === true, `空牌=${await has('LobbyPetBandEmpty')}`);
  judge('X10', '房间层照常（空档也不该是一块死墙）', (await has('LobbyWindow')) && (await has('LobbyClock')), `窗=${await has('LobbyWindow')}`);
  await shot(`${OUT}-9-lobby-empty-room`);

  const noisy = errors.filter((e) => !e.includes('apple-mobile-web-app-capable'));
  console.log('=== console errors (' + errors.length + ') ===');
  noisy.slice(0, 25).forEach((e) => console.log(e));
  judge('W33', '全流程无红色报错（忽略 Cocos meta 弃用警告）', noisy.length === 0, `collected=${errors.length}`);
  judge('N1', '全链路无 4xx/5xx 资源请求', netBad.length === 0, netBad.slice(0, 6).join(' | '));
  judge('N2', '全链路无 console.error 输出', consoleErrors.length === 0, consoleErrors.slice(0, 6).join(' | '));

  report();
  cdp.close();
  process.exit(process.exitCode || 0);
})().catch((e) => {
  console.error('ABORT ' + (e.message || e));
  process.exit(1);
});
