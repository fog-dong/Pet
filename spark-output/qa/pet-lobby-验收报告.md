# 设计验收报告 — 大厅（Lobby）

**验收目标**：大厅场景 `Lobby`（720×1280 设计帧），对照设计源 `docs/plan/W16-视觉与交互重构方案.md` §2（Token 表 / 五层模型 / 光影规范 / 九宫格）
**验收时间**：2026-10-31
**验收模式**：自动比对（读设计源 + 实现源码）+ 运行时截图复核（CDP 720×1280 / DPR 2，`build/shot-lobby-720x1280.png`）
**实现端点**：`build/web-mobile-w16`、`build/wechatgame-release`（均已按 `startScene=Boot` 重建）

## 总览

| 严重度 | 数量 | 已修复 |
| --- | --- | --- |
| 🔴 Blocker | 1 | 1 |
| 🟠 Major | 0 | — |
| 🟡 Minor | 3 | 0 |

**通过维度**（无 deviation）：颜色、字体、圆角与阴影、交互态、状态完整性、可访问性
**Check finding 解决率**：无上游 Check 上下文（0 / 0）

运行时复核结论：修复后截图只有一层 UI —— HUD 胶囊贴安全区左上、logo/主按钮/医生居中、2×2 菜单等宽等高地落在前台桌上、底部提示不压任何元素，与生产者描述的“放大 + 层级错乱 + 重叠”现象已不再复现。

## Deviations（按维度分组，按严重度排序）

### 响应式 / 适配 (Responsive) — 1 项

1. **[blocker] ✅ 已修复** 淡入淡出常驻层自带相机，把整屏 UI 又画了一遍
   - 设计源：W16 §2.2 五层模型要求单一相机 + 单一 Canvas 输出，层级只靠 siblingIndex 表达
   - 实现：`PageFade` 是常驻节点，自建 `Canvas` + `Camera(priority=100, clearFlags=DEPTH_ONLY)`，`visibility` 含 `UI_2D`，与主 UI 同层
   - 差异：同一套 UI 被两台 orthoHeight 不同的相机各画一次 → 视觉上“被放大镜照过 / 按钮压人 / 植物挡资源条”
   - 修复：淡出层独占 `Layers.Enum.UI_3D`（8388608），主相机 visibility 不含该层（已实装，`assets/scripts/core/PageFade.ts:124`、`:128`）
   - 位置：[PageFade.ts:124](file:///C:/Users/15181/Desktop/%E9%A1%B9%E7%9B%AE/pet/assets/scripts/core/PageFade.ts#L124)
   - 验证：重建后 CDP 截图单层；淡出仍可见（200ms 全屏暗），`Lobby → CaseIntro` 转场正常
   - 关联 Check finding：—

### 间距 (Spacing) — 2 项

2. **[minor]** 资源 HUD 胶囊固定 200 宽，三位数会挤压图标
   - 设计源：W16 §2.1 要求资源条随内容自适应，数字区留余量
   - 实现：`addPill(parent, name, 0, 200, 64, ...)` 固定宽 200，数字 label 固定宽 116
   - 差异：`999` 及以上（金币溢出保护触发后）文本会顶到色点/胶囊右缘
   - 修复建议：按文案宽度取 `max(200, labelWidth + 96)`，或数字区右对齐并给 `Layout` 自适应
   - 位置：[LobbyChrome.ts:40](file:///C:/Users/15181/Desktop/%E9%A1%B9%E7%9B%AE/pet/assets/scripts/ui/LobbyChrome.ts#L40)
   - 关联 Check finding：—

3. **[minor]** 2×2 次级菜单用常量 x/y 手工定位，未走 Grid Layout 容器
   - 设计源：W16 §2.2 交互件层要求等宽等高、按网格排布
   - 实现：`MENU_X = 115` + `index % 2` / `index < 2` 计算 x、y
   - 差异：当前视觉等宽等高（214×78）无错位，但增删项或改文案需手改坐标，缺少容器约束
   - 修复建议：包一层 `Layout(type=GRID, resizeMode=CHILDREN)`，按钮只设 `size + spacing`
   - 位置：[LobbyChrome.ts:54](file:///C:/Users/15181/Desktop/%E9%A1%B9%E7%9B%AE/pet/assets/scripts/ui/LobbyChrome.ts#L54)
   - 关联 Check finding：—

### 图标与图片 (Assets) — 1 项

4. **[minor]** 大厅医生立绘 240px，低于“约 300px、站得更靠下居中”的目标
   - 设计源：W16 大厅视觉分区（医生为画面重心，约占屏高 1/4）
   - 实现：`CharacterView.mount(this.doctorSlot, 0, 40, 240)`，立绘边长 240
   - 差异：240 vs ~300（−20%），医生在 1280 高屏上略显单薄，与前台上沿留白偏大
   - 修复建议：边长改 296，`doctorSlot` 的 y 从 10 下调到约 −10，保持脚不压前台桌
   - 位置：[Lobby.ts:66](file:///C:/Users/15181/Desktop/%E9%A1%B9%E7%9B%AE/pet/assets/scripts/ui/Lobby.ts#L66)
   - 关联 Check finding：—

## 9 维度核对

| 维度 | 结论 | 说明 |
| --- | --- | --- |
| 间距 Spacing | ⚠️ 2 minor | 网格与留白视觉正确，HUD 宽度与菜单定位未走容器/token |
| 颜色 Color | ✅ 通过 | 全部取 `COLORS`（clay/sage/gold/danger/ink…），无裸 hex |
| 字体 Typography | ✅ 通过 | 系统字兜底（W16 §2.5 选项 B），字号走 26/38/40 档 |
| 圆角与阴影 Radius & Shadow | ✅ 通过 | `RADIUS.card 16 / button 24`，轻阴影 12% 黑 |
| 图标与图片 Assets | ⚠️ 1 minor | 立绘尺寸低于设计意图 |
| 交互态 Interaction States | ✅ 通过 | `decorateButton` 统一按压/释放（0.12/0.18s）+ 禁用态 |
| 状态完整性 State Coverage | ✅ 通过 | 游客/登录双态、同步角标、空资源 0 值均有渲染 |
| 响应式 Responsive | ✅ 通过（已修） | 双击相机重复渲染已消除；720×1280 与窗口缩放均单层输出 |
| 可访问性 Accessibility | ✅ 通过 | 触控目标 ≥ 78px，文字对比度 ink on paper ≥ 8:1 |

## 修复优先级建议

- **必须修复**：0 项（唯一 blocker 已修复并验证）
- **建议修复**：3 项 minor —— 医生 240→296（画面重心）、HUD 胶囊自适应宽度（999+ 溢出）、菜单改 Grid Layout 容器（可维护性）
- **可延后**：无
