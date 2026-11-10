# W27-UI 精装与交互反馈规范

| 项目 | 内容 |
|---|---|
| 版本 | v1.0（已随 P3-UI 模块一~三落地） |
| 日期 | 2026-11-06 |
| 触发 | 制作人 P3-UI 指令：「游戏在 UI 表现和交互细节上依然像"程序员原型"，缺乏商业游戏的包装感」 |
| 依据 | `docs/plan/W16-视觉与交互重构方案.md`（Token 唯一口径）、`16-美术风格资产规范与买量素材.md`（色板 §4 / UI §6，冻结）、`可玩性升级实施方案.md` §4.2（Playful 动效档）、`AGENTS.md` |
| 状态 | **已生效**。后续迭代若与本文件冲突，以本文件为准；本文件与冻结文档冲突处（仅色板）以冻结文档为准 |

> 一句话口径：**这一轮没有新增一张贴图**。所有"包装感"都来自既有的 Graphics 绘制、Tokens 取值、Tween 时长三件套。下次有人想靠"加张图"来解决质感问题，说明他没读完本文件。

---

## 0. 结论先行（三条硬规则）

1. **质感不来自贴图，来自"层次件"**：阴影 + 圆角 + 图标字形 + 选中态 + 纸卡底纹 + 分层动效，六件齐全才算"商业游戏的一个面板"。少任何一件，读起来就是色块拼贴。
2. **可点的东西必须有按下反馈，一秒都不能等**：任何注册了 `click` / `touch-end` 的节点，必须同时绑 `bindPressEffect`（cc.Button 类，0.96）或 `bindChipPress`（自绘热区，0.94）。这是 P0 级，不是建议。
3. **"点不动"永远要给出路**：置灰只说"金币不足"是断点。置灰必须同时给（a）动作名不消失，（b）一条可点的获取指引胶囊。

---

## 1. 唯一取值口径（禁止现写数字与色号）

| 类别 | 唯一来源 | 键位 |
|---|---|---|
| 色板 | [Tokens.ts:19](file:///C:/Users/15181/Desktop/项目/pet/assets/scripts/ui/Tokens.ts#L19) `HEX` | cream / floor / wall / skirt / clay / sage / mist / ink / sub / paper / danger / gold / shadow / **alert** |
| 共用色实例 | [Tokens.ts:41](file:///C:/Users/15181/Desktop/项目/pet/assets/scripts/ui/Tokens.ts#L41) `COLORS` | 含 `white` / `disabled` / `disabledText` / `overlay` |
| 半透明 | [Tokens.ts:5](file:///C:/Users/15181/Desktop/项目/pet/assets/scripts/ui/Tokens.ts#L5) `tint(hex, alpha)` | 需要 alpha 时用它，不写 `new Color(r,g,b,a)` |
| 圆角 | [Tokens.ts:60](file:///C:/Users/15181/Desktop/项目/pet/assets/scripts/ui/Tokens.ts#L60) `RADIUS` | card 16 / button 24 |
| 间距 | [Tokens.ts:76](file:///C:/Users/15181/Desktop/项目/pet/assets/scripts/ui/Tokens.ts#L76) `GAP` | xs 8 / sm 12 / md 16 / lg 24 / xl 32 |
| 动效时长 | [Tokens.ts:82](file:///C:/Users/15181/Desktop/项目/pet/assets/scripts/ui/Tokens.ts#L82) `DURATION` | press .1 / release .18 / card .24 / fadeIn .25 / fadeOut .18 / tabSwap .2 / squashOut .26 / crisisBeat .21 … |
| 阶段色 | [Tokens.ts:67](file:///C:/Users/15181/Desktop/项目/pet/assets/scripts/ui/Tokens.ts#L67) `STAGE_TINT` | baby / adult / senior（与 `game/AgeSystem` 的 `LifeStage` 一一对应） |

**允许的例外**：仅 `STAGE_TINT` 与 `EARN` 类派生色这类"同色系深/浅一档"的派生值可写十六进制，且必须写注释说明它派生自哪一档。正文色、按钮色、卡片色出现裸十六进制即视为回退成色块风。

**告警色分工**（易错点）：`danger`（#C97B6E，terracotta）用于正文告警文字；`alert`（#E4573D）**只给红点与角标**——danger 压在 clay 选中态上跳不出来，红点的职责就是被看见。

---

## 2. 组件 API 面（只能用这些，不要再造第二套）

| 目的 | 用这个 | 不要用 |
|---|---|---|
| 卡片 / 底板 | `PanelKit.addCard`（自带阴影）、`addPill`、`addDivider`、`addTitleBar`、`createBox`、`paintRound` | 裸 `addRect` 当卡片 |
| 按钮 | `UIButton.addUIButton`（内含 `bindPressEffect`）、置灰用 `setUIButtonState(btn, enabled, actionText)` | 自己 `addComponent(Button)` 而不绑反馈 |
| 自绘热区（列表里可拖动的场景） | `HabitatTapActions.bindTapZone` / `bindTapOrHold` **+ 必须再调** `HabitatChip.bindChipPress` | 只绑 tap-zone 不给按下反馈 |
| 图标 | `GlyphShapes`（11 种字形）+ `GlyphKit.drawGlyph` / `addGlyphBadge` / `addGlyphNode`，按钮内图标用 `ButtonIcon.attachButtonIcon` | 用 Emoji 或文字当图标 |
| 入场 / 反馈动效 | `MotionKit.playStaggerIn` / `settleEntrance` / `squash` / `chew`；面板开合用 `PanelMotion.enterPanel` / `leavePanel` | 面板 `destroy()` 硬切 |
| 文字 | `FontKit.makeLabel` / `SceneUI.addLabel` | 手写 Label 不设 width |
| 资源缺口出路 | `EarnGuide.addEarnGuide(host, y, kind, onClose, name)` + `game/EarnRoutes.earnRoute` | 只 toast 一句"金币不足" |
| 引导红点 | `RedDot.attachRedDot(父节点, 名字)` + `game/LobbyAlerts.lobbyAlerts` | 自己画圆、或把红点做成按钮的兄弟节点 |

**图标字形清单**（[GlyphShapes.ts:5](file:///C:/Users/15181/Desktop/项目/pet/assets/scripts/ui/GlyphShapes.ts#L5)）：`medicine | bed | time | trophy | paw | sprout | water | lock | coin | heart | sparkle`。要加第 12 种就在这个文件加 painter，不要在业务文件里现画。

---

## 3. 质感六规约（每个新面板逐条对）

| # | 规约 | 反例（色块风） | 正确做法 |
|---|---|---|---|
| R1 | 有底板就要有影 | `addRect` 贴一块纯色 | 走 `addCard`（它顺带生成 `${panel.name}Shadow` 兄弟节点） |
| R2 | 圆角走 `RADIUS` | `roundRect(..., 26)` 各处随手写 | card 16 / button 24；卡片内小件用 12 |
| R3 | 动作有图标 | 三颗胶囊只写文字 | `attachButtonIcon` 挂 `GlyphKind`；徽章必须是按钮的**子节点** |
| R4 | 选中态看得见 | 选中与未选中同色 | 选中态换 `clay` + `attachButtonIcon(btn, kind, true)`，未选中降饱和 |
| R5 | 长内容给纸卡条 | 一行行字直接浮在面板上 | `addCard(..., { color: COLORS.paper, shadow: false })` 当条，行间 `addDivider` |
| R6 | 状态变化给分层动效 | 数字直接跳变 | 主层（`card`/`tabSwap`）+ 次层（图标/徽章 30–50% 幅度）+ 环境层（可选） |

**两条 Cocos 特有的坑（踩过，别再踩）**：

1. **同一节点只能挂一个 `Graphics`**。3.8 下两个 Graphics 的绘制顺序不保证；而 `setUIButtonState` / `paintRound` 每次都会 `graphics.clear()`。所以角标、图标、红点一律做成**子节点**，否则一刷新就被擦掉。
2. **`addCard` 的阴影是卡片的兄弟节点**。缩放/位移卡片必须把 `${panel.name}Shadow` 一起带上，否则落位前会单独露出一块暗角（`PanelMotion.lift` 就是这么处理的）。

---

## 4. 交互反馈规约（P0-1 的固化）

- cc.Button 类可点件：按下 `scale → 0.96` 用 `DURATION.press`，抬手 `→ 1` 用 `DURATION.release` + `backOut`（[UIButton.ts:22](file:///C:/Users/15181/Desktop/项目/pet/assets/scripts/ui/UIButton.ts#L22)、`:101` `bindPressEffect`）。
- 自绘热区：同上，但幅度 `0.94`（[HabitatChip.ts](file:///C:/Users/15181/Desktop/项目/pet/assets/scripts/ui/HabitatChip.ts) `bindChipPress`）。**列表可拖动场景不要挂 `cc.Button`**，走位移阈值 `TAP_SLOP`，避免拖动误触发。
- 立绘这类"点了会有世界反应"的：按下反馈可以由反应动画承担（`HabitatFeedback.squash` / `tossTo`），但必须确认点了之后 0.1 秒内有东西在动。
- **自检命令**（当前项目实测：5 处裸 `addComponent(Button)`，5 处全部紧跟 `bindPressEffect`；4 处 `bindTapZone` 全部紧跟 `bindChipPress`）：

```bash
grep -rn "addComponent(Button)" assets/scripts | grep -v UIButton.ts   # 每处下一行必须是 bindPressEffect
grep -rn "bindTapZone(" assets/scripts | grep -v "export function"      # 同函数内必须再调 bindChipPress
```

---

## 5. 红点规约（P0-2 的固化）

**口径只有一条**：红点 = "有一件事等你收，收了就灭"。

| 亮 | 不亮 |
|---|---|
| 后院有成熟作物可收 | 诊疗 TAB（没有累积待收对象） |
| 送养审核到点可领感谢金 | 宠物照护度低（那是常驻读数，不是红点） |
| 成就谱有可领档位 | 已完成 / 已领取的成就 |

- 判定一律走 [LobbyAlerts.ts:21](file:///C:/Users/15181/Desktop/项目/pet/assets/scripts/game/LobbyAlerts.ts#L21) `lobbyAlerts(signals)`（纯函数，不碰 `cc` 与存档，可直接在 Node 下回归）。UI 侧不许自己写 `if (garden.some(...))`。
- 1 件画圆点，多件画数字胶囊，99 以上收口为 `99+`。
- 渲染挂成 TAB 按钮的**子节点**（见 §3 坑 1）。
- 墙钟事件（成熟、到点）必须在大厅也刷：`Lobby` 有 30 秒定时只重算坞摘要与红点，不重建散步带。
- **反模式**：常驻红点等于没有红点。天天亮只会训练玩家无视它。

---

## 6. 资源缺口规约（P0-3 的固化）

置灰按钮不是终点，必须有出路：

1. 置灰时**不换文案**，仍显示动作名（W24-1 定下的口径），副行给原因，原因文字用 `danger`。
2. 同时挂一条可点的获取指引胶囊：`addEarnGuide(host, y, 'coins' | 'hearts', onClose, name)`。
3. 路线按**到账速度**排序（[EarnRoutes.ts:22](file:///C:/Users/15181/Desktop/项目/pet/assets/scripts/game/EarnRoutes.ts#L22)）：可领成就 > 到点的送养感谢金 > 接诊病例。
4. **红线**：指引绝不指向广告或付费入口。缺资源时把玩家推去看广告，留存直接反噬。
5. 跳转前必须先摘掉当前遮罩（医院/装修弹窗都自带全屏 `BlockInputEvents`），否则跳了看不见——装修弹窗可从屋内打开，所以调用点要传 `closeHabitatPanel`，只关弹窗不够。
6. 指引条出现时**顶掉同一条 y 上的副标题**，不留两行字。

现状缺口（P1，见 §8）：日常护理面板的驱虫（缺药剂）与高级粮（缺爱心）只有 toast，没挂指引条。

---

## 7. 面板开合规约（P0-4 的固化）

所有全屏遮罩面板统一走 [PanelMotion.ts](file:///C:/Users/15181/Desktop/项目/pet/assets/scripts/ui/PanelMotion.ts)：

- **开**：遮罩 `UIOpacity` 0→255 用 `fadeIn`(0.25s) `quadOut`；卡片连同它的影子从下方 18px、0.97 缩放 `backOut` 落位（`DURATION.card`）。口径与大厅 TAB 换页 [LobbyDock.ts:70](file:///C:/Users/15181/Desktop/项目/pet/assets/scripts/ui/LobbyDock.ts#L70) 一致。
- **关**：淡出 0.18s（`fadeOut` / `quadIn`）**播完才 `destroy()`**；淡出期间**保留** `BlockInputEvents`。0.18 秒的输入锁没人感觉得到，但放开会让点在将亡面板上的按钮误触发一次。
- **中途重开不冲突**：新遮罩 `setSiblingIndex(children.length - 1)` 压在正在淡出的旧遮罩之上，旧遮罩淡出完自行销毁，不会叠两层。
- 换主题会走一次"关旧开新"，因此会重放开合动画——这是接受的行为，不要为此特判。
- **低端机（`Quality.low`）直接落终态**，不播动画，也不留在半透明。

已接入 7 处：医院、护理、小屋、后院、送养、成就谱（开合两端分别在 `AchievementKit` / `AchievementPanel`）。新增面板必须接入，不接受 `overlay.destroy()` 硬切。

**验收口径（写死，防止下次误判成"没动效"）**：无 GPU 的 headless Chrome 只有 ~8 FPS，帧间隔 100–200ms，而淡出只有 180ms——整段过渡正好塞在两帧之间时，采样物理上落不进去。所以淡出的判据是二选一：（a）采到 `op < 255` 的中间值；或（b）"最后可见帧 → 首次不见帧"的跨距 > 淡出时长（确认是帧饥饿），此时改由销毁时机举证（点击当帧遮罩仍在 + 销毁晚于 150ms）。当场 `destroy()` 的实现两条都过不了：t=0 那一帧遮罩就没了。采样必须走 `requestAnimationFrame`（tween 按帧推进，页内定时器在无头环境能漂到两三百毫秒，比整段淡出还长），触发必须和计时在同一个 JS turn 里（否则 CDP 单程 100ms 已经把淡出走掉大半）。

---

## 8. UX 走查问题清单（2026-11-06 一轮全功能点走查）

按"休闲游戏玩家从头玩一遍"的视角走查，四项重点全过。P0 已直接修完，P1 只登记不阻断。

### 已修（P0）

| # | 问题 | 修复 | 提交 |
|---|---|---|---|
| P0-1 | 六处可点件按下毫无回话（大厅文字链、隐私勾选行与弹窗按钮、关于页协议行、寻访纸箱、小屋三枚属性圆钮） | 复用 `bindPressEffect` / `bindChipPress`，不新建规范、不加贴图 | `87addd8` |
| P0-2 | 后院成熟 / 送养到点 / 成就可领完全没有引导，玩家不翻面板就永远不知道有东西可收 | `game/LobbyAlerts`（纯函数判定）+ `ui/RedDot`（Graphics 自绘，子节点挂载）+ 大厅 30 秒定时刷新 + `HEX.alert` | `d7f0efa` |
| P0-3 | 金币不足时按钮只是死色块，没有"去哪获取"的快捷指引 | `game/EarnRoutes`（按到账速度排序）+ `ui/EarnGuide`（可点胶囊）接入医院扩建与小屋装修；红线禁止指向广告/付费 | `4c636ff` |
| P0-4 | 面板开关是 `destroy()` 硬切，大厅→后院→小屋读起来一顿一顿 | `ui/PanelMotion.enterPanel` / `leavePanel`，遮罩淡入 + 卡片上浮落位，关闭淡出后再销毁 | 本次提交 |

### P1 台账（W27 登记 → W28 拍板收口）

| # | 问题 | 证据 | 建议 | W28 状态 |
|---|---|---|---|---|
| P1-1 | 日常护理面板置灰只给原因，不给出路：驱虫缺药剂时写着"消耗 1 支驱虫药剂（后院合成）"，但那句话不可点 | [CarePanel.ts:71](file:///C:/Users/15181/Desktop/项目/pet/assets/scripts/ui/CarePanel.ts#L71) + [CareCard.ts:38](file:///C:/Users/15181/Desktop/项目/pet/assets/scripts/ui/CareCard.ts#L38) | 复用 `addEarnGuide`，新增 `hearts` 之外的第三种 `kind`（指向后院）；纯 UI 接线，不改数据层 | ✅ 已修：`EarnRoutes` 加 `medicine` 档（恒指后院，不看可领成就，因为成就只发金币/爱心），[CarePanel.ts:81](file:///C:/Users/15181/Desktop/项目/pet/assets/scripts/ui/CarePanel.ts#L81) 在驱虫卡正下方 y=-215 挂 `CareDewormGuide`（宽 330 与卡同宽），`stock<=0` 才亮 |
| P1-2 | 高级粮缺爱心时只降饱和 + toast，玩家要退出小屋才知道去哪拿爱心 | [HabitatChip.ts:48](file:///C:/Users/15181/Desktop/项目/pet/assets/scripts/ui/HabitatChip.ts#L48)、[HabitatTapActions.ts:115](file:///C:/Users/15181/Desktop/项目/pet/assets/scripts/ui/HabitatTapActions.ts#L115) | 同 P1-1，`shortfallText` 已给出原因，缺的只是可点出路 | ✅ 已修：新文件 [HabitatShortfallGuide.ts](file:///C:/Users/15181/Desktop/项目/pet/assets/scripts/ui/HabitatShortfallGuide.ts) 占用引导行那一格（y=272），缺爱心时亮 `HabitatHeartsGuide` 并把 `HabitatQuotaLabel` 隐藏，行刷新时 `sync()` 装载/卸载；滚动提示迁入 [HabitatList.ts:44](file:///C:/Users/15181/Desktop/项目/pet/assets/scripts/ui/HabitatList.ts#L44) |
| P1-3 | 装修档位按钮在"买不起"时仍是金色可点，要连点两次（购买 → 确认弹窗）才知道钱不够；指引条只在整面板全买不起时出现 | [HabitatThemeRow.ts:60](file:///C:/Users/15181/Desktop/项目/pet/assets/scripts/ui/HabitatThemeRow.ts#L60)（只有 `current` 会 `setUIButtonState(false)`，见 :64）、[HabitatThemePanel.ts:69](file:///C:/Users/15181/Desktop/项目/pet/assets/scripts/ui/HabitatThemePanel.ts#L69) | 买不起的行按 `disabled` 渲染 + 文案改成"差 N 金币"，避免二次确认后落空 | ✅ 已修：数据层 `themeShortfall()`（[HabitatThemes.ts:60](file:///C:/Users/15181/Desktop/项目/pet/assets/scripts/game/HabitatThemes.ts#L60)），UI 只做两件事——文案 `差 N 金币` + `setUIButtonState(false)`；点击回调再拦一道 `themeShortfall>0` 直接 return，任何派发路径都到不了确认弹窗 |
| P1-4 | 后院地块点击失败（未到成熟 / 缺水）只有 toast，无红点以外的前置提示 | [GardenPlotCard.ts:108](file:///C:/Users/15181/Desktop/项目/pet/assets/scripts/ui/GardenPlotCard.ts#L108) | 缺口是草药/金币可同屏收获，优先级判低；只在成熟时靠 P0-2 红点引导即可 | ⬜ 维持不修（拍板：P1-4 优先级判低，红点已覆盖成熟提示） |

---

## 9. 回归自检（改 UI 必跑，缺一不算验完）

1. `tsc --noEmit`（根）+ `-p tsconfig.scaffold.json` + `-p cloudfunctions/tsconfig.json` 三绿。
2. 无头构建 `web-mobile`（新 `outputName`，不复用旧目录）。
3. 浏览器验收脚本（CDP 驱动，720×1280）：
   - `node scripts/verify-panel-motion-browser.js <CDP端口> <站点端口> w27motion` — 面板开合 7 条断言 × 6 块面板 + 重开不叠层 + 淡出截图 + TAB 换页回归 + 全程无报错，共 48 条，本轮实测 **48 PASS / 0 FAIL**；
   - `node scripts/verify-earn-guide-browser.js <CDP> <站点> <前缀>` — 资源指引 14 条，本轮回归实测 **14 PASS / 0 FAIL**；
   - 红点：`node scripts/verify-alerts.js`（纯函数判定）+ `node scripts/verify-alerts-browser.js <CDP> <站点> <前缀>`（大厅实截图）。
   - 口径见 §7 末段：判定一律做成帧率无关（"是否采到中间值 / 点击当帧遮罩是否还在"），不得要求"至少 N 个中间帧"。
4. **肉眼确认截图**（纪律：tsc 与构建通过不等于 UI 修好，必须看 720×1280 图）：至少 治疗后院面板、成就谱（含新称号）、大厅带红点 三张。
5. §4 的两条 grep 自检命令各跑一遍，新增可点件不得出现在"漏绑"名单里。

---

## 10. 反模式对照（下次评审直接引用）

- ❌ 「先加个圆角图片顶一下」→ 本轮零新增贴图，质感全部走 Graphics + Tokens + Tween。
- ❌ `overlay.destroy()` 直接关面板 → 走 `leavePanel`，淡出完再销毁。
- ❌ 按钮置灰写死"金币不足" → `setUIButtonState(btn, false, 动作名)` + 指引条。
- ❌ 把红点做成按钮的兄弟节点 / 同一节点挂第二个 Graphics → 会被 `graphics.clear()` 擦掉。
- ❌ 只缩卡片不缩影子 → 落位前露暗角。
- ❌ UI 里现写 `0.3` 秒、`#E4573D`、`26` 圆角 → 一律回 Tokens 取，取不到就补进 Tokens 并说明档位。
- ❌ 常驻红点 → 红点只在"收了就灭"的事件上亮。
