// STATUS: implemented, W15-1 saveGame 安全回归（快照里的 resources 不得写入 users）；W25 P2-A3 口碑落库与镜像
// API: createSaveCases(ctx) → [{ title, run }]
'use strict';

function createSaveCases(ctx) {
  const { sdk, loadFunction, check, show } = ctx;

  async function snapshotResourcesIgnored() {
    sdk.resetState();
    sdk.setOpenid('user_save_guard');
    const db = sdk.database();
    await db.collection('users').doc('user_save_guard').set({
      data: {
        openid: 'user_save_guard',
        revision: 0,
        resources: { coins: 100, hearts: 5, medicine: { 健胃药: 3 } },
        flags: {},
      },
    });
    const fn = loadFunction('saveGame');
    // 模拟被改过的客户端：快照里塞入远超正常的金币/爱心/药品。
    const forged = {
      revision: 1,
      snapshot: {
        level: 2,
        beds: 3,
        adoptionSlots: 4,
        resources: { coins: 999999, hearts: 999999, medicine: { 健胃药: 999999 } },
      },
    };
    const response = await fn.main(forged);
    show('篡改快照后首次保存', response);
    const resources = sdk.fieldOf('users', 'user_save_guard', 'resources') || {};
    check('saveGame 正常接受医院状态（level=2、beds=3）', response.code === 0
      && sdk.fieldOf('hospital_state', 'user_save_guard', 'level') === 2
      && sdk.fieldOf('hospital_state', 'user_save_guard', 'beds') === 3,
    `code=${response.code} level=${sdk.fieldOf('hospital_state', 'user_save_guard', 'level')}`);
    check('users.resources 不被客户端快照改写（金币仍 100、爱心仍 5）',
      resources.coins === 100 && resources.hearts === 5,
    `coins=${resources.coins} hearts=${resources.hearts}`);
    check('药品库存不随快照进入云端（仍为 3）', resources.medicine && resources.medicine['健胃药'] === 3,
      `medicine=${JSON.stringify(resources.medicine)}`);

    const replay = await fn.main(forged);
    show('同 revision 重放', replay);
    check('乐观锁仍生效：同 revision 返回 1004', replay.code === 1004, `code=${replay.code}`);
    const after = sdk.fieldOf('users', 'user_save_guard', 'resources') || {};
    check('重放后 resources 仍未变化', after.coins === 100 && after.hearts === 5,
      `coins=${after.coins} hearts=${after.hearts}`);
  }

  async function reputationLandsAndMirrors() {
    sdk.resetState();
    sdk.setOpenid('user_reputation');
    const db = sdk.database();
    await db.collection('users').doc('user_reputation').set({
      data: { openid: 'user_reputation', revision: 0, reputation: 3, resources: { coins: 10, hearts: 1 } },
    });
    const fn = loadFunction('saveGame');

    const accepted = await fn.main({ revision: 1, snapshot: { level: 1, beds: 2, adoptionSlots: 1, reputation: 8 } });
    show('客户端口碑 8 上报', accepted);
    check('口碑落 hospital_state.reputation',
      accepted.code === 0 && sdk.fieldOf('hospital_state', 'user_reputation', 'reputation') === 8,
    `code=${accepted.code} state=${sdk.fieldOf('hospital_state', 'user_reputation', 'reputation')}`);
    check('同事务镜像 users.reputation（10 §3.2「与 users 同步」，getProfile 两处都在读）',
      sdk.fieldOf('users', 'user_reputation', 'reputation') === 8,
    `users=${sdk.fieldOf('users', 'user_reputation', 'reputation')}`);

    const negative = await fn.main({ revision: 2, snapshot: { reputation: -1 } });
    check('负口碑整包判 1002，云端口碑不被脏写',
      negative.code === 1002 && sdk.fieldOf('hospital_state', 'user_reputation', 'reputation') === 8,
    `code=${negative.code} state=${sdk.fieldOf('hospital_state', 'user_reputation', 'reputation')}`);

    const legacy = await fn.main({ revision: 3, snapshot: { level: 2 } });
    check('不带 reputation 的旧快照只改等级，云端口碑保持原值',
      legacy.code === 0 && sdk.fieldOf('hospital_state', 'user_reputation', 'reputation') === 8
        && sdk.fieldOf('hospital_state', 'user_reputation', 'level') === 2,
    `code=${legacy.code} state=${sdk.fieldOf('hospital_state', 'user_reputation', 'reputation')}`);
  }

  return [
    { title: '  [15] saveGame：快照 resources 被忽略，客户端不能直写云端金币', run: snapshotResourcesIgnored },
    { title: '  [15b] saveGame：口碑落 hospital_state 并镜像 users，负值整包拒绝', run: reputationLandsAndMirrors },
  ];
}

module.exports = { createSaveCases };
