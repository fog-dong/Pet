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
| 2026-11-10 | W30-1 习性动作：idle 档在呼吸间插走动/伸懒腰/舔爪（PetHabits + PetHabitPlan），大厅散步带与小屋卡片开启 | 已入库（f412774） |

## Preferences / conventions

- 所有 `tween(node)` 前若可能重入，先 `Tween.stopAllByTarget(node)`（连点不叠 scale）。
- 低端机降级走 `Quality.low`：去位移/粒子、时长减半、不启动循环，语义等同 `prefers-reduced-motion`。
- 立绘形变只改 `PetVisual.contentNode`；阴影是兄弟节点，必须单独跟手，否则会僵在半途。
- 入场位移固定 14px（`MotionKit.RISE`），stagger 0.06，总编排 ≤500ms。
- 常驻循环只允许 PetBehavior 的呼吸/摇尾与阴影呼吸，且必须可被抚摸打断后接回。
- 习性动作用「抽签纯函数 + Tween 编排 + 独立定时器」：tween 被打断（squash/chew）后定时器仍会拉起下一轮，生活线不会死。
- 习性幅度口径：位移 ±9px、旋转 ≤4°、缩放 ≤1.05；只在散步带与在小屋卡片开，图鉴/治疗/领养保持静态。

## Open issues

- （已解决 2026-11-10）无头构建缺 `cocos-js/`：根因是 `%TEMP%\CocosCreator\3.8.0\builder\engine\69d3bcfe...` 引擎缓存残缺（目录里只有空的 `assets`），删除该缓存条目后重建即产出完整引擎。
