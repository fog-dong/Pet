// STATUS: implemented, W15-3 getConfig 画质档位回归（quality 必须在配置白名单内，否则远程开关永远读不到）
// API: createConfigCases(ctx) → [{ title, run }]
'use strict';

function createConfigCases(ctx) {
  const { sdk, loadFunction, check, show } = ctx;

  async function qualityConfigReturned() {
    sdk.resetState();
    sdk.setOpenid('user_cfg_quality');
    await sdk.database().collection('config').doc('cfg_quality_v1').set({
      data: {
        configKey: 'quality',
        version: 1,
        payload: 'low',
        status: 'active',
        grayPercent: 100,
      },
    });
    const fn = loadFunction('getConfig');
    const response = await fn.main({ version: 0 });
    show('getConfig(version=0)', response);
    check('configs.quality 下发 low',
      response.code === 0 && response.data !== null && response.data.configs.quality === 'low',
      `configs=${JSON.stringify(response.data && response.data.configs)}`);

    const cached = await fn.main({ version: 1 });
    show('getConfig(version=1)', cached);
    check('版本号一致时不下发重复配置',
      cached.code === 0 && cached.data !== null && Object.keys(cached.data.configs).length === 0,
      `configs=${JSON.stringify(cached.data && cached.data.configs)}`);
  }

  return [
    { title: '  [16] getConfig：quality 档位可远程下发（画质开关有效）', run: qualityConfigReturned },
  ];
}

module.exports = { createConfigCases };
