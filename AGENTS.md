# AGENTS.md — 宠物医院小游戏多角色协作约束

## 0. 当前阶段

- 只做 W1–W2 工程骨架：目录、状态机、网络层、广告/支付占位、云函数骨架。
- 不实现完整玩法，不接真实广告，不接真实虚拟支付，不部署线上环境。
- 唯一口径：`docs/plan/00-项目总览与执行边界.md` 第 16 节 + 三份冻结文件。其他文档只能引用，不得复制第二套口径。
- **工程状态（2026-10-29）**：Cocos Creator 3.8 工程脚手架（`settings/`、根 `tsconfig.json`、根 `package.json`、`.creator/`）已并入根目录；`assets/**/*.meta` 与 `temp/` 尚未生成，首次在开发机打开工程时由 Creator 自动生成。安装与校验详情见 `docs/plan/环境安装报告.md`、`docs/plan/工程完整性检查.md`。

## 1. 七条硬约束

1. **只读冻结文档**：接口、集合、字段以 `docs/plan/08-客户端架构与状态机.md`、`09-服务端架构与云存档.md`、`10-数据结构与配置表.md` 与 `docs/plan/接口冻结清单.md`、`集合与索引冻结.md` 为准；不得自行发明接口、集合或字段。
2. **TypeScript 严格模式**：只写 TypeScript；禁止裸 `any`（平台无类型 API 必须先声明最小接口）；所有网络请求必须有超时与重试；所有写操作必须带幂等键。
3. **业务层禁止直连平台 API**：业务代码不得直接调用 `wx.cloud.callFunction`、`wx.createRewardedVideoAd`、`wx.requestMidasPayment`；必须分别走 `net/Net.ts`、`net/Ad.ts`、`net/Pay.ts`。
4. **iOS 支付占位**：W1–W4 的 `Pay.createOrder` 与云函数 `payCallback` 只能返回 `PAY_UNAVAILABLE`；不得调用真实虚拟支付，不得引导站外支付，不得绕过平台政策。
5. **包体与内存**：主包 ≤4MB；总分包 ≤30MB；内存目标 ≤200MB，低端机 ≤250MB。新增资源前先确认分包归属。
6. **不提交生成物**：禁止提交 `library/`、`temp/`、`build/`、`local/`、`node_modules/`、`.editor/`、`.meta-cache/`、`*.log`、`.DS_Store`；必须保留 `assets/**/*.ts`、`assets/**/*.meta`、`settings/`、根 `tsconfig.json`、根 `package.json`。
7. **先蓝图后代码**：每个编码任务先输出 2–3 句实现蓝图（改哪些文件、依赖哪个冻结接口、如何验证），再写代码；不得跳过蓝图直接大改。

## 1.1 工程完整性约束

- 所有 `assets/` 下的文件必须包含对应的 `.meta` 文件，且 `.meta` 必须提交到 Git。
- `settings/` 目录由 Cocos Creator 编辑器生成，必须提交（不含 `library/temp/build/local`）。
- 根目录 `tsconfig.json` 必须存在且 `"types"` 包含 `"cocos"`。

以上任一项不满足时，不得声称“Cocos 工程已就绪”；repo-integrator 的最终验证只能输出“等待 `.meta` 后二次验证”。不得手工编造 `.meta` UUID。

## 2. 目录约定

| 目录 | 用途 |
|---|---|
| `assets/scripts/core/` | 启动、GameFSM、事件总线、通用基类 |
| `assets/scripts/ui/` | 页面与弹窗管理、UI 基类；不持有业务数据 |
| `assets/scripts/game/` | 单局流程与玩法编排；不直接调平台 API |
| `assets/scripts/net/` | `Net.ts`、`Ad.ts`、`Pay.ts`；唯一平台网络/广告/支付出口 |
| `assets/scripts/cache/` | 本地快照、登录态、配置缓存 |
| `assets/scripts/track/` | 埋点队列与上报；不采集敏感信息 |
| `assets/scripts/config/` | 配置加载、版本校验、本地兜底 |
| `cloudfunctions/{functionName}/index.ts` | 单个云函数入口；openid 只从上下文取 |
| `docs/plan/` | 规划与冻结文档；代码不得反向修改口径 |

**禁止：** 在 `assets/scripts` 下新建第二套网络库、第二套状态管理、第二套配置系统。

## 3. 统一接口约定

- 云函数返回：`{ code: number, msg: string, data: T | null, serverTime?: number }`。
- 客户端请求：`Net.call<T>(name, data, options?)`，默认超时 8000ms、重试 2 次。
- 广告：`Ad.showRewarded(scene)`，W1 只返回占位结果，不接真实广告位 ID。
- 支付：`Pay.createOrder(sku)`，W1–W4 返回 `{ code: 'PAY_UNAVAILABLE' }`。
- 资源：`Res.loadBundle(name)` / `Res.release(tag)`，按页面引用计数释放。
- 埋点：`Track.track(event, props?)`，失败不阻塞玩法。

## 4. 编码规范

- 每个文件头部：`// STATUS: scaffold, API frozen by architect on 2026-10-29`（业务实现后改为 `implemented`）。
- 单文件 ≤150 行；超过先拆分，不靠压缩行数规避。
- 文件、类、函数使用英文命名；注释与文档使用中文。
- 禁止 `console.log` 留在提交中；调试信息走 `Track` 或删除。
- 提交前运行 `tsc --noEmit`；类型错误未清零不得提交。
- 不硬编码密钥、appid、广告位 ID、商户号、价格；全部走配置或服务端。

## 5. 交付检查

- [ ] 改动只涉及允许目录，未新增第二套基础设施。
- [ ] 接口、集合、字段可在冻结文件中逐项对应。
- [ ] 无真实支付、无真实广告、无线上部署操作。
- [ ] 主包/分包/内存口径未被突破。
- [ ] `tsc --noEmit` 通过。
- [ ] 提交信息说明“改了什么、为什么、如何验证”。

## 6. Git 约定

- 远程：`https://github.com/fog-dong/Pet.git`。
- 首次同步必须先 `git clone` 再落盘，不得在空目录 `git init` 后覆盖远程。
- 冲突时 `git pull --rebase`；**禁止 force push**。
- 不提交任何密钥、证书、真实用户数据与本地环境配置。
