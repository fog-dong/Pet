# UI 质检（W9）

| 项目 | 内容 |
|---|---|
| 角色 | UI 质检（只读，不改代码、不修复） |
| 日期 | 2026-10-30 |
| 基线 | W9-4 `20972ef` + W9-5 `49e03a8` |
| 走查范围 | 隐私弹窗（同意态 / 拒绝页 / 只读态）、大厅「关 于」面板、Boot 启动页合规行、CaseIntro 医疗免责 |
| 规则 | ① 可点元素热区 ≥44×44 ② 640pt 小屏无文本裁切且正文可滚 ③ 安全区不被遮 ④ 客服未配置有空态说明 ⑤ 同屏文本块不重叠 |
| 度量口径 | 设计分辨率 1280×720（`assets/scenes/Boot.scene` Canvas UITransform），`addLabel` 为 `Overflow.RESIZE_HEIGHT` + `lineHeight = round(fontSize × 1.4)`，CJK 字宽按 1em 估；行数据取自 `assets/bundles/cases/config/cases.json` 真实文案 |

## 一、结论概览

| 规则 | 结果 |
|---|---|
| ① 热区 ≥44×44 | 通过（0 项） |
| ② 小屏无裁切 / 正文可滚 | 2 项警告 |
| ③ 安全区不被遮 | 1 项阻塞 + 1 项警告 |
| ④ 客服空态说明 | 通过（0 项） |
| ⑤ 同屏文本块不重叠 | 2 项警告 + 1 项提示 |

走查面板的静态坐标与真实文案长度逐屏计算，未发现裁切（`RESIZE_HEIGHT` 会自动增高换行），但发现**多处垂直余量接近 0**，文案或字号微调即会重叠；合规文案所在的启动页底部行完全没有安全区避让。

## 二、结构化结果

```json
{
  "audit": "UI质检-W9",
  "baseline": ["20972ef", "49e03a8"],
  "scenes": [
    {
      "scene": "PrivacyDialog(gate)",
      "warnings": [
        {
          "rule": "⑤同屏文本块不重叠",
          "node": "PrivacyCheckRow / CheckText",
          "message": "勾选整行 880×60 与其子 Label（size 24，宽 740，x=60）在几何上完全包含，热区判定依赖父节点 TOUCH_END，父矩形与子 Label 之间无间距约束；文本若加长到 740px 以上会从行右侧溢出（ySpan[-145,-111] 与父行 [-158,-98] 仅 13px 余量）。",
          "severity": "提示"
        }
      ]
    },
    {
      "scene": "PrivacyDialog(declined)",
      "warnings": [
        {
          "rule": "⑤同屏文本块不重叠",
          "node": "DeclineText / DeclineGuest",
          "message": "拒绝页 4 行正文按固定 y=170/90/40/0 排布。真实文案下 DeclineText 换 2 行占 y[56,124]，DeclineGuest 单行占 y[24.5,55.5]，上下沿间隙仅 0.5px；`PRIVACY_DECLINE_TEXT` 或 `PRIVACY_GUEST_TEXT` 任一加长 1 字即重叠。",
          "severity": "警告"
        },
        {
          "rule": "②小屏正文可滚",
          "node": "PrivacyDeclineBody",
          "message": "拒绝页不是 ScrollView（同意态/只读态的正文区才是），小屏（<640pt）与竖屏下 4 行说明无法滚动，只能靠换行增高，存在压到按钮行（y=-220）的风险。",
          "severity": "警告"
        }
      ]
    },
    {
      "scene": "AboutPanel(大厅·关 于)",
      "warnings": [
        {
          "rule": "②小屏正文可滚",
          "node": "AboutPanel",
          "message": "关于面板 5 段固定 y（235/170/100/0/-95）+ 按钮行 -220，正文不滚动。免责句实测 2 行 y[69,131]、忠告实测 2 行 y[-28,28]、客服兜底 1 行 y[-109,-81]，段间隙 41–53px 尚可，但忠告或兜底文案加长一行即与下一段重叠。",
          "severity": "警告"
        }
      ]
    },
    {
      "scene": "Boot(splash 合规行)",
      "warnings": [
        {
          "rule": "③安全区不被遮",
          "node": "BootSplashLegal",
          "message": "适龄提示 + 健康游戏忠告合成为单条 Label，y=-320、size 18、宽 1200，实测单行占 y[-332.5,-307.5]，距设计下沿（-360）仅 27.5px；该节点挂在 Boot 根节点上，未加 SafeArea/Widget，竖屏（`game.json: deviceOrientation=portrait`）与带底部指示条的机型极可能被遮，而这一行是提审必须可见的合规内容。",
          "severity": "阻塞"
        },
        {
          "rule": "②小屏无裁切",
          "node": "BootSplashLegal",
          "message": "整行文本 66 字以内才不换行（1200/18=66），当前 `AGE_RATING_TEXT` + 全角空格 + `HEALTH_GAME_NOTICE_TEXT` 实测 64 字，仅剩 2 字余量；一旦换行变 2 行，占 y[-345,-295]，距下沿余量降到 15px。",
          "severity": "警告"
        }
      ]
    },
    {
      "scene": "CaseIntro(医疗免责)",
      "warnings": [
        {
          "rule": "③安全区不被遮",
          "node": "MedicalNotice",
          "message": "免责句宽 440、x=-400，左沿到 -620，距设计左边（±640）仅 20px，是全场景最贴边的文本；竖屏适配（W13）未验证前存在被裁风险。",
          "severity": "警告"
        },
        {
          "rule": "①热区/布局",
          "node": "AcceptButton / SwapButton / BackButton",
          "message": "三个按钮 y=-120/-205/-290，垂直间距 85px 而按钮高 86px，上下沿实测重叠 1px（视觉贴合，点击无歧义但无呼吸间距）。尺寸 340×86 本身满足 ≥44×44。",
          "severity": "提示"
        }
      ]
    }
  ]
}
```

## 三、逐规则证据

### 规则① 可点元素热区 ≥44×44 — 通过

| 元素 | 实测尺寸 | 出处 |
|---|---|---|
| 隐私弹窗按钮（同意 / 暂不同意 / 重新阅读 / 仅体验基础内容 / 平台隐私指引 / 关闭） | 320×76 | `ui/PrivacyDialogKit.ts:9-25` |
| 勾选框图形 | 44×44 | `ui/PrivacyDialogKit.ts:34-52` |
| 勾选整行热区（含文字） | 880×60，`TOUCH_END` 绑在父矩形节点 | `ui/PrivacyDialog.ts:24-44` |
| 关于面板按钮（联系客服 / 关闭） | 320×76 | `ui/AboutPanel.ts:38-44` |
| 大厅四个入口（图鉴 / 排行榜 / 隐私与协议 / 关于） | 260×76 | `ui/Lobby.ts:50-53` |
| 病例页三按钮 | 340×86 | `game/CaseIntro.ts:50-77` |
| 排行榜分页按钮 | 190×64 | `ui/LeaderboardPanel.ts:34-39` |

没有裸文本链接：协议正文不可点，跳转统一走「平台隐私指引」按钮（不支持时回显提示），因此不存在「需用透明 Button 放大热区」的遗漏项。

### 规则② 640pt 无裁切 / 正文可滚 — 2 项警告

- 同意态与只读态正文走 `buildDocScroll`（`ui/PrivacyDialogKit.ts:55-88`，滚动区 880×270 + `Mask(GRAPHICS_RECT)`，内容按估算行高堆叠），符合「小屏可滚」。
- 所有 `addLabel` 均为 `Overflow.RESIZE_HEIGHT`（`ui/SceneUI.ts:84`），长文案自动换行增高，因此**没有硬裁切**；代价是垂直余量被吃掉，见拒绝页与关于面板两项警告。
- 拒绝页与关于面板的正文不可滚动，是本次唯一两处「小屏只能靠换行」的面板。

### 规则③ 安全区不被遮 — 1 项阻塞 + 1 项警告

- 隐私弹窗面板、关于面板均挂引擎 `SafeArea` 并 `updateArea()`（`ui/PrivacyDialog.ts:96`、`ui/AboutPanel.ts:32`）——面板内的标题与按钮行会随安全区收缩。
- Boot 的合规行与 CaseIntro 的免责句是**根节点上的裸 Label**，没有 SafeArea/Widget，且分别距设计边界 27.5px / 20px；这两处都是提审必须可见的内容，故列为阻塞（Boot 行）与警告（CaseIntro 句）。
- 上游背景：`game.json` 为 `deviceOrientation: "portrait"` 而所有面板按 1280×720 横屏坐标排布，即《架构质检-W8》W13；本项在真机复核前无法给出最终结论，但结构上缺少避让这一点已经成立。

### 规则④ 客服未配置空态 — 通过

`ui/AboutPanel.ts:45-47`：面板打开时若 `CUSTOMER_SERVICE.url` 为空即预填 `CUSTOMER_SERVICE.fallbackText`（「客服系统配置中，可通过公众号留言反馈。」）；点击后由 `net/Support.ts:15-45` 返回 `opened|unconfigured|unsupported|failed` 四态，非 `opened` 一律回显兜底文案（`supportFallback`）并记 `customer_service_result`，不会崩、不会静默。

### 规则⑤ 同屏文本块不重叠 — 2 项警告 + 1 项提示

计算方式：CJK 按 1em 字宽、`lineHeight = round(fontSize×1.4)`、`RESIZE_HEIGHT` 上下对称增高，逐对判定 y 区间与 x 区间的交集。真实文案（5 个病例的 story 15–23 字、symptoms 17–19 字）下 CaseIntro 无重叠：Story 占 y[32,68]，Symptoms 占 y[-37,-3]，MedicalNotice 占 y[-225,-175]，间隙 ≥19px。风险点集中在拒绝页（0.5px 间隙）与固定 y 的关于面板。

## 四、需要人工在真机确认（本单不修复）

1. 竖屏（portrait）下 `BootSplashLegal`、`MedicalNotice` 是否被底部指示条/圆角裁掉——对应阻塞项的定级确认。
2. iPhone SE（640pt 级小屏）与刘海机上，隐私弹窗「同意 / 暂不同意」两个按钮与勾选行是否完整可点。
3. 拒绝页四行说明在小屏上的实际换行结果（当前仅按 1em 字宽估算）。
4. 客服 URL 填入真实值后，`wx.openCustomerServiceChat` 在低版本基础库上的失败表现与兜底文案可见性。
