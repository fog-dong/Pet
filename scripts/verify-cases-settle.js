// STATUS: implemented, W12-3 服务端结算用例（首通倍率 / 二刷 / 并发只写一次 / 主键唯一）
// API: seedCaseFixture / createSettleCases(ctx) → [{ title, run }]
'use strict';

const CASE_ID = 'case_cat_cold';
const SESSION_ONE = 'session-fixed-0001';
const START_COINS = 100;
const START_HEARTS = 5;
/** 与服务端公式对齐的期望值：base 60 金币 / 2 爱心，2 星 → 首通 72 / 3 爱心，二刷 48 / 2 爱心。 */
const CASE_FIXTURE = {
  version: 1,
  cases: [{
    caseId: CASE_ID,
    petSpecies: 'cat',
    petName: '橘子',
    severity: 'normal',
    treatment: { correct: { medicine: '健胃药', bed: '门诊', time: '正常' } },
    baseRewards: { coins: 60, hearts: 2, affection: 1 },
  }],
};

function caseEvent(caseSessionId) {
  return {
    caseSessionId,
    caseId: CASE_ID,
    diagnosis: { type: 'auscultation', stars: 3, mistakes: 0, durationMs: 18000 },
    // 药正确 + 床正确 → verified=2，healing=3 只加 1 → 3 分；康复字段缺失按 1 星 → 总星 (3+3+1)/3 ≈ 2。
    treatment: { result: 'success', medicineUsed: ['健胃药'], bedUsed: false, healing: 3 },
    durationMs: 42000,
  };
}

async function seedCaseFixture(sdk, openid) {
  const db = sdk.database();
  await db.collection('users').doc(openid).set({
    data: {
      openid,
      revision: 0,
      resources: { coins: START_COINS, hearts: START_HEARTS, beds: 0, medicine: {} },
      flags: {},
    },
  });
  await db.collection('config').add({
    data: { _id: 'cfg_cases_v1', configKey: 'cases', version: 1, status: 'active', payload: CASE_FIXTURE },
  });
}

function coinsOf(sdk, openid) {
  const resources = sdk.fieldOf('users', openid, 'resources') || {};
  return resources.coins;
}

function createSettleCases(ctx) {
  const { sdk, loadFunction, check, show } = ctx;

  async function secondClear() {
    sdk.resetState();
    sdk.setOpenid('user_settle_twice');
    await seedCaseFixture(sdk, 'user_settle_twice');
    const fn = loadFunction('syncCaseResult');
    const first = await fn.main(caseEvent(SESSION_ONE));
    const second = await fn.main(caseEvent('session-fixed-0002'));
    show('首通', first);
    show('二刷', second);
    check('首通 firstClear=true、2 星、72 金币', first.data && first.data.result.firstClear === true
      && first.data.result.stars === 2 && first.data.rewards.coins === 72,
    first.data ? `firstClear=${first.data.result.firstClear} stars=${first.data.result.stars} coins=${first.data.rewards.coins}` : '无数据');
    check('二刷 firstClear=false 且不再乘 1.5（48 金币）', second.data && second.data.result.firstClear === false
      && second.data.rewards.coins === 48,
    second.data ? `firstClear=${second.data.result.firstClear} coins=${second.data.rewards.coins}` : '无数据');
    check('两局合计只加一次首通倍率：金币 100+72+48=220、爱心 5+2+2=9',
      coinsOf(sdk, 'user_settle_twice') === 220
      && sdk.fieldOf('users', 'user_settle_twice', 'resources').hearts === 9,
    `coins=${coinsOf(sdk, 'user_settle_twice')} hearts=${sdk.fieldOf('users', 'user_settle_twice', 'resources').hearts}`);
    check('pets_cases 两局各 1 条、caseStars 记最高星 2',
      sdk.count('pets_cases') === 2
      && sdk.fieldOf('users', 'user_settle_twice', 'flags').caseStars[CASE_ID] === 2,
    `行数=${sdk.count('pets_cases')}`);
  }

  async function concurrentSameSession() {
    sdk.resetState();
    sdk.setOpenid('user_settle_race');
    await seedCaseFixture(sdk, 'user_settle_race');
    const fn = loadFunction('syncCaseResult');
    const responses = await Promise.all(Array.from({ length: 12 }, () => fn.main(caseEvent(SESSION_ONE))));
    const succeeded = responses.filter((r) => r.code === 0).length;
    const coins = coinsOf(sdk, 'user_settle_race');
    check('12 路同一单局全部 code=0', succeeded === 12, `实际 ${succeeded} 路`);
    check('并发只写 1 条 pets_cases', sdk.count('pets_cases') === 1, `实际 ${sdk.count('pets_cases')} 条`);
    check('金币只增加一次（100+72=172），爱心只加一次（5+2=7）',
      coins === 172 && sdk.fieldOf('users', 'user_settle_race', 'resources').hearts === 7,
    `coins=${coins} hearts=${sdk.fieldOf('users', 'user_settle_race', 'resources').hearts}`);
    const replay = await fn.main(caseEvent(SESSION_ONE));
    check('重放返回历史结果且不再入账', replay.code === 0 && replay.data.rewards.coins === 72 && coinsOf(sdk, 'user_settle_race') === 172);

    let blocked = false;
    try {
      await sdk.database().collection('pets_cases').add({ data: { _id: `user_settle_race:${SESSION_ONE}` } });
    } catch {
      blocked = true;
    }
    check('主键 openid:caseSessionId 唯一：绕过结算直写同一单局被拒', blocked);
  }

  return [
    { title: '  [13] syncCaseResult：同一 caseId 换会话二刷（首通倍率只给一次）', run: secondClear },
    { title: '  [14] syncCaseResult：同一会话并发 12 路 + 主键唯一', run: concurrentSameSession },
  ];
}

module.exports = { createSettleCases, seedCaseFixture, CASE_ID, SESSION_ONE, START_COINS, START_HEARTS };
