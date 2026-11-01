// STATUS: implemented, W20-2/任务四 claimHabitat 离线收益幂等用例（连点只铸一次 / 当日额度 / 无领养宠物不铸币但消耗时间窗）
// API: createHabitatCases(ctx) → [{ title, run }]
'use strict';

const START_COINS = 100;
/** 与服务端常数对齐：4 金币/小时/只，3 只 × 3 小时 = 36 金币。 */
const COINS_PER_PET_HOUR = 4;
const PET_COUNT = 3;
const CLAIM_HOURS = 3;
const EXPECTED_COINS = CLAIM_HOURS * COINS_PER_PET_HOUR * PET_COUNT;
const HOUR_MS = 3600 * 1000;

async function seedAdopter(sdk, openid) {
  const db = sdk.database();
  await db.collection('users').doc(openid).set({
    data: { openid, revision: 0, resources: { coins: START_COINS, hearts: 0 }, flags: {} },
  });
  for (let i = 0; i < PET_COUNT; i += 1) {
    await db.collection('pets').add({ data: { petId: `pet_${openid}_${i}`, status: 'adopted', adoptedBy: openid } });
  }
}

function coinsOf(sdk, openid) {
  const resources = sdk.fieldOf('users', openid, 'resources') || {};
  return resources.coins;
}

function createHabitatCases(ctx) {
  const { sdk, loadFunction, shanghaiDate, check, show } = ctx;
  const hoursAgo = (hours) => Date.now() - hours * HOUR_MS;

  async function rapidTaps() {
    sdk.resetState();
    sdk.setOpenid('user_habitat_taps');
    await seedAdopter(sdk, 'user_habitat_taps');
    const fn = loadFunction('claimHabitat');
    const event = { lastClaimTime: hoursAgo(CLAIM_HOURS) };
    const responses = await Promise.all(Array.from({ length: 12 }, () => fn.main(event)));
    const minted = responses.filter((r) => r.code === 0 && r.data && r.data.coins > 0);
    show('12 路连点首路', responses[0]);
    check('12 路连点只有 1 路真正铸币（其余 hours=0、coins=0）',
      minted.length === 1 && minted[0].data.hours === CLAIM_HOURS && minted[0].data.coins === EXPECTED_COINS,
    `实际铸币 ${minted.length} 路`);
    check('金币只增加一次（100+36=136）', coinsOf(sdk, 'user_habitat_taps') === START_COINS + EXPECTED_COINS,
      `coins=${coinsOf(sdk, 'user_habitat_taps')}`);
    check('habitat_claims 只 1 行且 count=1',
      sdk.count('habitat_claims') === 1 && sdk.fieldOf('habitat_claims', `user_habitat_taps_${shanghaiDate()}`, 'count') === 1,
      `行数=${sdk.count('habitat_claims')}`);
    check('入参非法（字符串 lastClaimTime）返回 1002', (await fn.main({ lastClaimTime: '123' })).code === 1002);
  }

  async function dailyQuota() {
    sdk.resetState();
    sdk.setOpenid('user_habitat_quota');
    await seedAdopter(sdk, 'user_habitat_quota');
    const dayId = `user_habitat_quota_${shanghaiDate()}`;
    const lastClaimAt = hoursAgo(7);
    const db = sdk.database();
    await db.collection('habitat_state').doc('user_habitat_quota').set({ data: { lastClaimAt } });
    await db.collection('habitat_claims').doc(dayId).set({ data: { openid: 'user_habitat_quota', date: shanghaiDate(), count: 2, hours: 6, coins: 72 } });
    const response = await loadFunction('claimHabitat').main({ lastClaimTime: lastClaimAt });
    show('当日第 3 次', response);
    check('离线 7h 但当日已领 2 次 → 1003 RATE_LIMITED', response.code === 1003 && response.data === null);
    check('被频控时不入账、不推进起算点',
      coinsOf(sdk, 'user_habitat_quota') === START_COINS
      && sdk.fieldOf('habitat_state', 'user_habitat_quota', 'lastClaimAt') === lastClaimAt,
      `coins=${coinsOf(sdk, 'user_habitat_quota')}`);
  }

  async function noPets() {
    sdk.resetState();
    sdk.setOpenid('user_habitat_empty');
    const db = sdk.database();
    await db.collection('users').doc('user_habitat_empty').set({
      data: { openid: 'user_habitat_empty', revision: 0, resources: { coins: START_COINS, hearts: 0 }, flags: {} },
    });
    const response = await loadFunction('claimHabitat').main({ lastClaimTime: 0 });
    show('零领养', response);
    check('没有领养记录：hours 夹在 6、coins=0（骨架不凭空铸币）',
      response.code === 0 && response.data.hours === 6 && response.data.coins === 0,
      JSON.stringify(response.data));
    check('时间窗仍被消耗（lastClaimAt 落到服务端当前时间附近）',
      typeof sdk.fieldOf('habitat_state', 'user_habitat_empty', 'lastClaimAt') === 'number');
  }

  return [
    { title: '  [17] claimHabitat：同一 lastClaimTime 连点 12 路（幂等只铸一次）+ 非法入参', run: rapidTaps },
    { title: '  [18] claimHabitat：当日已领 2 次，第 3 次频控不入账', run: dailyQuota },
    { title: '  [19] claimHabitat：无领养宠物只算时长不铸币', run: noPets },
  ];
}

module.exports = { createHabitatCases, EXPECTED_COINS, PET_COUNT, CLAIM_HOURS };
