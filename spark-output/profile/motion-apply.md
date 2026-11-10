# motion-apply profile — 萌宠救助日记

## Stack

- Cocos Creator 3.8.0 + TypeScript strict，微信小游戏（非 Web）。
- 动效出口只有 `cc.Tween`；没有 React / 没有 DOM / 不装 ReactBits。
- 常量统一在 `assets/scripts/ui/Tokens.ts` 的 `DURATION`，禁止第二套动效常量文件。

## Scene / tonality

- scene = dashboard（游戏 HUD，按 DASHBOARD 强度上限执行）。
- Personality = Playful（制作人 2026-11-03 拍板-2）：backOut 回弹 + quadOut 位移，quick 0.09–0.12 / standard 0.18–0.26 / slow 0.45–0.90。
- 签名段：压扁 → 回弹过头 → 收住；overshoot 10–20%。

## History

| 日期 | 动作 | 结果 |
| --- | --- | --- |
| 2026-11-08 | P0-A 动效地基：DURATION 扩表 + ParticleKit | 已入库 |
| 2026-11-10 | motion-apply 链式落地：补 4 个缺口（阴影跟随、散步带 bandIn/backOut、抛投 anticipation、洗澡微缩） | 已入库（W29） |

## Preferences / conventions

- 所有 `tween(node)` 前若可能重入，先 `Tween.stopAllByTarget(node)`（连点不叠 scale）。
- 低端机降级走 `Quality.low`：去位移/粒子、时长减半、不启动循环，语义等同 `prefers-reduced-motion`。
- 立绘形变只改 `PetVisual.contentNode`；阴影是兄弟节点，必须单独跟手，否则会僵在半途。
- 入场位移固定 14px（`MotionKit.RISE`），stagger 0.06，总编排 ≤500ms。
- 常驻循环只允许 PetBehavior 的呼吸/摇尾与阴影呼吸，且必须可被抚摸打断后接回。

## Open issues

- 无头构建（2026-11-10，web-mobile）未产出 `cocos-js` 引擎文件，预览时用同版本旧构建补齐；下次构建先核对引擎拷贝任务。
