// STATUS: implemented, W10-5/W21 adEvent 并发用例；W11-1 加 assist 并发用例并拆出本文件
// API: createRaceCases(ctx) → [{ title, run }]
'use strict';

function createRaceCases(ctx) {
  const { sdk, loadFunction, shanghaiDate, check, results } = ctx;
  const dailyId = (openid) => `${openid}_${shanghaiDate()}`;

  async function adEventRace() {
    sdk.resetState();
    sdk.setOpenid('user_race');
    const fn = loadFunction('adEvent');
    const events = Array.from({ length: 12 }, (_, i) => ({ adSessionId: `race-${i}`, adUnitId: 'adunit_test', scene: 'extra_check', isEnded: true }));
    const responses = await Promise.all(events.map((event) => fn.main(event)));
    const granted = responses.filter((r) => r.data && r.data.granted).map((r) => r.data.todayCount).sort((a, b) => a - b);
    const expected = Array.from({ length: 10 }, (_, i) => i + 1);
    const count = sdk.fieldOf('ad_daily', dailyId('user_race'), 'count');
    check('恰好 10 次 granted=true（并发不越当日上限）', granted.length === 10, `实际 ${granted.length} 次`);
    check('todayCount 为 1..10 且无重复', JSON.stringify(granted) === JSON.stringify(expected), `实际 ${granted.join(',')}`);
    check('ad_daily.count 停在 10（超限的 2 次不占额度）', count === 10, `实际 count=${count}`);
    const rows = sdk.rows('ad_events');
    check('ad_events 12 行全落库、其中 2 行 granted=false',
      rows.length === 12 && rows.filter((r) => r.granted === false).length === 2, `实际 ${rows.length} 行`);
  }

  async function adEventDuplicate() {
    sdk.resetState();
    sdk.setOpenid('user_dup');
    const fn = loadFunction('adEvent');
    const dup = { adSessionId: 'session-dup', adUnitId: 'adunit_test', scene: 'extra_check', isEnded: true };
    const twice = await Promise.all([fn.main(dup), fn.main(dup)]);
    const count = sdk.fieldOf('ad_daily', dailyId('user_dup'), 'count');
    check('两次都 granted=true 且 todayCount 恒为 1',
      twice.every((r) => r.code === 0 && r.data && r.data.granted === true && r.data.todayCount === 1));
    check('重复会话不双计：ad_daily.count=1 且仅 1 行',
      count === 1 && sdk.count('ad_events') === 1, `count=${count} 行数=${sdk.count('ad_events')}`);
  }

  async function assistSameFriend() {
    sdk.resetState();
    sdk.setOpenid('user_same');
    const fn = loadFunction('assist');
    const event = { friendOpenid: 'friend_same', resourceType: 'heart', nonce: 'n-same' };
    const responses = await Promise.all(Array.from({ length: 12 }, () => fn.main(event)));
    const granted = responses.filter((r) => r.data && r.data.granted === true).length;
    const already = responses.filter((r) => r.data && r.data.reason === 'ALREADY_ASSISTED').length;
    const count = sdk.fieldOf('assist_daily', dailyId('user_same'), 'count');
    check('12 路同一好友只有 1 路 granted=true', granted === 1, `实际 ${granted} 次`);
    check('其余 11 路均为 ALREADY_ASSISTED', already === 11, `实际 ${already} 次`);
    check('assist_pairs 仅 1 条、assist_daily.count=1',
      sdk.count('assist_pairs') === 1 && count === 1, `pair=${sdk.count('assist_pairs')} count=${count}`);
  }

  async function assistManyFriends() {
    sdk.resetState();
    sdk.setOpenid('user_many');
    const fn = loadFunction('assist');
    const events = Array.from({ length: 12 }, (_, i) => ({ friendOpenid: `friend_${i}`, resourceType: 'heart', nonce: `n-${i}` }));
    const responses = await Promise.all(events.map((event) => fn.main(event)));
    const granted = responses.filter((r) => r.data && r.data.granted === true).length;
    const limited = responses.filter((r) => r.code === 1005 && r.msg === 'TODAY_ASSIST_LIMIT').length;
    const count = sdk.fieldOf('assist_daily', dailyId('user_many'), 'count');
    check('恰好 5 次 granted=true（12 路不同好友不越每日上限）', granted === 5, `实际 ${granted} 次`);
    check('其余 7 路返回 1005 TODAY_ASSIST_LIMIT', limited === 7, `实际 ${limited} 次`);
    check('assist_daily.count 停在 5、assist_pairs 只留 5 条（超限不留脏对）',
      count === 5 && sdk.count('assist_pairs') === 5, `count=${count} pair=${sdk.count('assist_pairs')}`);
  }

  results.push('    注：并发用例依赖 mock-cloud-transaction.js 把事务 handler 串行化，等价于真实 SDK 的冲突重试。');
  return [
    { title: '  [4] adEvent 并发：12 个不同 adSessionId 同时上报（全局上限 10）', run: adEventRace },
    { title: '  [5] adEvent 并发：同一 adSessionId 同时上报 2 次', run: adEventDuplicate },
    { title: '  [6] assist 并发：同一好友同时上报 12 次', run: assistSameFriend },
    { title: '  [7] assist 并发：12 个不同好友同时上报（每日上限 5）', run: assistManyFriends },
  ];
}

module.exports = { createRaceCases };
