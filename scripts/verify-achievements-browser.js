// STATUS: implemented, W27 P3-UI 成就 UI 核验（CDP 驱动 web-mobile 构建；纯本地存档，不碰线上）
// 覆盖：大厅称号条入口与可领数、面板六组三档、打开即复位到顶 + 滚动范围是真列表高、
// 领取入账与幂等（第二次点击不重复发）、里程碑专名（不再读成「一档二档三档」）、
// 回厅里程碑弹窗（计数器跨进厅对比）、盲盒券只出稀有以上。
// 前置：本地起 web-mobile 构建静态服务 + headless Chrome 开 CDP 端口。
// 用法：node scripts/verify-achievements-browser.js <CDP端口> <站点端口> <截图前缀>
'use strict';

const fs = require('fs');

const CDP_PORT = Number(process.argv[2] || 9448);
const PORT = Number(process.argv[3] || 8095);
const OUT = process.argv[4] || 'w25b2';
const SHOT_DIR = process.env.SHOT_DIR || 'build';
fs.mkdirSync(SHOT_DIR, { recursive: true });
const W = 720;
const H = 1280;
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

// 两路云函数只要走通，成就全程只读本地存档。
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
 * 种子：casesDone 25 / reputation 320 → 悬壶、口碑各两档；gardenPlanted 4、rehomeCount 1 各一档；
 * gachaDraws 4 留一次寻访到 5，回厅时「寻访 · 街角探路」成为新可领。合计可领 6 档。
 * petsSeen 留空：第一只必是新宠，可直接「立即接诊」再放弃回厅。
 * 稀有券 2 张：两次都走券抽卡，钉住「只出稀有以上」与用尽后入口消失。
 */
function seedSave() {
  return JSON.stringify({
    coins: 1200,
    hearts: 4,
    petsSeen: [],
    petsAdopted: [],
    adoptedAt: {},
    habitat: [],
    bestStars: {},
    casesDone: 25,
    items: { item_ticket_rare: 2 },
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
    reputation: 320,
    counters: { gardenPlanted: 4, nailCare: 0, rehomeCount: 1, gachaDraws: 4 },
    achievementsClaimed: [],
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

  // 表达式报错必须抛出来：吞成 undefined 会让 JSON.parse 报「不是合法 JSON」，看不出真因。
  const ev = (expr) =>
    cdp.call('Runtime.evaluate', { expression: expr, returnByValue: true }).then((r) => {
      if (r.exceptionDetails) {
        const d = r.exceptionDetails.exception || {};
        throw new Error(`页内表达式报错：${String(d.description || r.exceptionDetails.text).split('\n')[0]}`);
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
  const shot = async (file) => {
    const img = await cdp.call('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`${SHOT_DIR}/${file}.png`, Buffer.from(img.data, 'base64'));
    console.log('shot', file);
  };
  /** 面板里全部可点领取的档位按钮：已领取的档位是胶囊节点，没有 Button。 */
  const claimChips = () =>
    ev(`(() => {
      const out = [];
      const walk = (n) => {
        if (n.name.startsWith('AchievementChip-') && n.getComponent('cc.Button')) out.push(n.name);
        n.children.forEach(walk);
      };
      const s = cc.director.getScene();
      if (s) walk(s);
      return JSON.stringify(out);
    })()`);
  const waitText = async (nm, includes, ms = 12000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const text = await label(nm);
      if (text && String(text).includes(includes)) return text;
      await sleep(150);
    }
    return null;
  };
  /**
   * ScrollView 现场：滚动范围 + 当前偏移 + 两张卡片是否落在视口里。
   * range 必须 > 0——等于 0 就是「content 高只给到视口高」，列表被当成弹性位移整段弹回，
   * 玩家看到的正是「一打开就往上滚」。
   */
  const scrollState = () =>
    ev(`(() => {
      const s = (${FIND})('AchievementScroll');
      if (!s) return null;
      const sc = s.getComponent('cc.ScrollView');
      const off = sc.getScrollOffset();
      const range = sc.getMaxScrollOffset();
      const mid = s.worldPosition.y;
      const half = s.getComponent('cc.UITransform').contentSize.height / 2;
      const shown = (nm) => {
        const n = (${FIND})(nm);
        return !!n && Math.abs(n.worldPosition.y - mid) <= half + 92;
      };
      return JSON.stringify({
        range: Math.round(range.y),
        offset: Math.round(Math.abs(off.y)),
        top: shown('AchievementCard-medic'),
        bottom: shown('AchievementCard-repute'),
      });
    })()`);

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
  }

  console.log('\n=== 1. 大厅称号条入口 ===');
  await boot();
  const entry = await label('AchievementTitleText');
  judge('A01', '大厅右上角称号条显示称号且报可领数', /称号.*可领6/.test(String(entry)), `文案=${entry}`);
  await shot(`${OUT}-1-lobby`);

  await tap('AchievementTitle');
  if (!(await waitFor('AchievementPanel', 8000))) throw new Error('称号条点击未打开成就面板');
  await sleep(700);
  const bar = await label('AchievementTitleBarText');
  judge('A02', '面板标题条显示称号与已领满组数', String(bar).includes('已领满 0/6 组'), `文案=${bar}`);
  const groups = ['medic', 'grower', 'guardian', 'homework', 'seeker', 'repute'];
  const cards = [];
  for (const id of groups) cards.push(await has(`AchievementCard-${id}`));
  judge('A03', '六组成就卡片全部渲染', cards.every(Boolean), `命中=${cards.filter(Boolean).length}/6`);
  const chipsBefore = JSON.parse(await claimChips());
  judge(
    'A04',
    '可领档位与种子计数器一致（悬壶2 + 口碑2 + 躬耕1 + 送家1）',
    chipsBefore.length === 6,
    `可领=${chipsBefore.join(',')}`,
  );
  const opened = JSON.parse(await scrollState());
  judge(
    'A04b',
    '打开面板即停在顶部：偏移 0、滚动范围 > 0、首卡可见末卡隐藏',
    opened.offset === 0 && opened.range > 0 && opened.top === true && opened.bottom === false,
    `偏移=${opened.offset} 范围=${opened.range} 首=${opened.top} 末=${opened.bottom}`,
  );
  await shot(`${OUT}-2-panel`);

  console.log('\n=== 2. 领取入账与幂等 ===');
  const coinsBefore = await save('s.coins');
  await click('AchievementChip-medic-0');
  if (!(await waitFor('MilestoneCard', 5000))) throw new Error('领取后没有庆祝弹窗');
  await sleep(350);
  const claimLine = await label('MilestoneLine0');
  const claimReward = await label('MilestoneLine1');
  const popupTitle = await label('MilestoneTitle');
  judge(
    'A05',
    '领取弹窗带里程碑专名与到账奖励',
    popupTitle === '领 取 成 功' && claimLine === '悬壶 · 实习兽医' && claimReward === '+200 金币',
    `标题=${popupTitle} 行=${claimLine}/${claimReward}`,
  );
  const coinsAfter = await save('s.coins');
  const claimed = await save('(s.achievementsClaimed || []).join(",")');
  const hud = await label('CoinPillLabel');
  judge(
    'A06',
    '金币与领取记录同一次落盘，HUD 同步刷新',
    coinsAfter === coinsBefore + 200 && String(claimed).includes('medic#1') && String(hud) === String(coinsAfter),
    `金币 ${coinsBefore}→${coinsAfter} 记录=${claimed} HUD=${hud}`,
  );
  await shot(`${OUT}-3-claim`);

  await click('MilestoneLater');
  await sleep(400);
  const chipText = await label('AchievementChip-medic-0Label');
  const hint = await label('AchievementHint');
  judge('A07', '已领档位就地变成「已 领」胶囊并给文字回执', chipText === '实习兽医 · 已 领' && String(hint).includes('领取成功'), `胶囊=${chipText} 回执=${hint}`);
  const coinsIdem = await save('s.coins');
  await tap('AchievementChip-medic-0');
  await sleep(500);
  judge('A08', '再点已领档位不重复发奖', (await save('s.coins')) === coinsIdem, `金币=${coinsIdem}`);
  const chipsAfter = JSON.parse(await claimChips());
  judge('A09', '可领档位减一（6 → 5）', chipsAfter.length === 5, `剩余=${chipsAfter.join(',')}`);

  await click('AchievementClose');
  await sleep(500);
  const entryAfter = await label('AchievementTitleText');
  judge('A10', '关闭面板后称号条可领数同步减一', /可领5/.test(String(entryAfter)), `文案=${entryAfter}`);

  console.log('\n=== 3. 稀有券寻访（只出稀有以上）+ 回厅里程碑 ===');
  await click('StartButton');
  if (!(await waitFor('GachaTicket', 15000))) throw new Error('寻访出价区没就绪');
  const ticketLabel = await label('GachaTicketLabel');
  judge('A11', '出价区按存档显示稀有券张数', ticketLabel === '稀有券 ×2', `按钮=${ticketLabel}`);
  await shot(`${OUT}-4-offer-ticket`);

  await click('GachaTicket');
  if (!(await waitText('GachaHint', '只可能遇见稀有或传说', 10000))) throw new Error('用券后没进限档提示');
  judge('A12', '用券寻访时提示限定稀有与传说', true, '提示=只可能遇见稀有或传说');
  await click('GachaBox');
  if (!(await waitFor('GachaName', 8000))) throw new Error('券寻访结果卡没出来');
  const tier1 = await label('GachaTierLabel');
  const ticketsLeft = await save('(s.items && s.items.item_ticket_rare) || 0');
  judge(
    'A13',
    '第一张券开箱只出稀有/传说且券 −1',
    ['稀有', '传说'].includes(String(tier1)) && ticketsLeft === 1,
    `稀有度=${tier1} 券=${ticketsLeft}`,
  );
  const primary = await label('GachaPrimaryLabel');
  judge('A14', '空图鉴首抽必为新宠（可立即接诊）', primary === '立即接诊', `按钮=${primary}`);
  await click('GachaPrimary');
  if (!(await waitFor('AcceptButton', 12000))) throw new Error('没进接诊页');
  await click('BackButton');
  if (!(await waitFor('StartButton', 10000))) throw new Error('放弃后没回大厅');
  const milestone = await waitFor('MilestoneCard', 8000);
  const line0 = milestone ? await label('MilestoneLine0') : null;
  const mHint = milestone ? await label('MilestoneHint') : null;
  judge(
    'A15',
    '回厅弹里程碑并点名新达成的里程碑',
    milestone === true && line0 === '寻访 · 街角探路' && String(mHint).includes('新达成 1 个成就'),
    `弹窗=${milestone} 行=${line0} 提示=${mHint}`,
  );
  await shot(`${OUT}-5-milestone`);

  await click('MilestoneGo');
  if (!(await waitFor('AchievementPanel', 8000))) throw new Error('里程碑「去领取」没打开面板');
  await sleep(600);
  const seekerClaim = await ev(
    `(() => { const n = (${FIND})('AchievementChip-seeker-0'); return !!(n && n.getComponent('cc.Button')); })()`,
  );
  judge('A16', '「去领取」打开面板且「街角探路」已可领', seekerClaim === true, `可点=${seekerClaim}`);
  const seekerText = await label('AchievementChip-seeker-0Label');
  judge('A16b', '可领胶囊同样读作里程碑专名而不是档位序号', seekerText === '街角探路 · 领 取', `胶囊=${seekerText}`);
  const entryMid = await label('AchievementTitleText');
  judge('A17', '新可领计入称号条（5 → 6）', /可领6/.test(String(entryMid)), `文案=${entryMid}`);
  const reopened = JSON.parse(await scrollState());
  judge(
    'A18',
    '再次打开面板偏移仍归零（不把上次停留位置带进来）',
    reopened.offset === 0 && reopened.range > 0,
    `偏移=${reopened.offset} 范围=${reopened.range}`,
  );
  const moved = await ev(
    `(() => { const n = (${FIND})('AchievementScroll'); const s = n && n.getComponent('cc.ScrollView'); if (!s) return 0; s.scrollToBottom(0); return 1; })()`,
  );
  await sleep(700);
  const bottom = JSON.parse(await scrollState());
  await shot(`${OUT}-6-panel-bottom`);
  judge(
    'A18b',
    '滚到底后末卡进视口、偏移等于滚动范围（滚动范围是真列表高不是视口高）',
    moved === 1 && bottom.bottom === true && Math.abs(bottom.offset - bottom.range) <= 2,
    `偏移=${bottom.offset} 范围=${bottom.range} 末卡=${bottom.bottom}`,
  );

  console.log('\n=== 4. 券用尽后入口消失 ===');
  await click('AchievementClose');
  await sleep(500);
  await click('StartButton');
  if (!(await waitFor('GachaTicket', 15000))) throw new Error('第二次寻访出价区没就绪');
  const ticketLabel2 = await label('GachaTicketLabel');
  judge('A19', '剩 1 张券时入口仍在并显示张数', ticketLabel2 === '稀有券 ×1', `按钮=${ticketLabel2}`);
  await click('GachaTicket');
  if (!(await waitText('GachaHint', '只可能遇见稀有或传说', 10000))) throw new Error('第二张券没进限档提示');
  await click('GachaBox');
  if (!(await waitFor('GachaName', 8000))) throw new Error('第二张券结果卡没出来');
  const tier2 = await label('GachaTierLabel');
  const ticketsZero = await save('(s.items && s.items.item_ticket_rare) || 0');
  judge(
    'A20',
    '第二张券同样只出稀有/传说且券归零',
    ['稀有', '传说'].includes(String(tier2)) && ticketsZero === 0,
    `稀有度=${tier2} 券=${ticketsZero}`,
  );
  await click('GachaSecondary');
  await sleep(600);
  await click('StartButton');
  if (!(await waitText('GachaHint', '花点金币', 15000))) throw new Error('券用尽后出价区没就绪');
  await sleep(400);
  const ticketRowVisible = await ev(
    `(() => { const n = (${FIND})('GachaTicketRow'); return !!(n && n.activeInHierarchy); })()`,
  );
  judge('A21', '券为 0 时出价区不再显示券入口', ticketRowVisible === false, `可见=${ticketRowVisible}`);
  await shot(`${OUT}-7-offer-no-ticket`);

  const noisy = errors.filter((e) => !e.includes('apple-mobile-web-app-capable'));
  console.log('=== console errors (' + errors.length + ') ===');
  errors.slice(0, 25).forEach((e) => console.log(e));
  judge('A22', '全流程无红色报错（忽略 Cocos meta 弃用警告）', noisy.length === 0, `collected=${errors.length}`);

  report();
  cdp.close();
  process.exit(process.exitCode || 0);
})().catch((e) => {
  console.error('ABORT ' + (e.message || e));
  process.exit(1);
});
