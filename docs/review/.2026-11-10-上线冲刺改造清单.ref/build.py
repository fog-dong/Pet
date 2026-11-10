# -*- coding: utf-8 -*-
"""生成《Demo 评审与上线冲刺改造清单》工作簿（看板 + 明细 + 计划 + 门槛）。"""
import datetime as dt
import os

try:
    import openpyxl
except ImportError:
    import subprocess
    import sys
    subprocess.check_call([sys.executable, "-m", "pip", "install", "--quiet", "openpyxl>=3.1.0"])
    import openpyxl

from openpyxl import Workbook
from openpyxl.formatting.rule import FormulaRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation


def xl_color(css_hex: str) -> str:
    value = css_hex.removeprefix("#").upper()
    if len(value) != 6:
        raise ValueError(f"Expected #RRGGBB, got: {css_hex}")
    return "FF" + value


XL_PRIMARY = xl_color("#70AD47")
XL_DARK = xl_color("#548235")
XL_LIGHT = xl_color("#E2EFDA")
XL_BORDER = xl_color("#BFBFBF")
XL_TEXT = xl_color("#1A1A1A")
XL_MUTED = xl_color("#595959")
XL_WHITE = xl_color("#FFFFFF")
XL_RED_FILL = xl_color("#FFC7CE")
XL_RED_TEXT = xl_color("#9C0006")
XL_YELLOW_FILL = xl_color("#FFEB9C")
XL_YELLOW_TEXT = xl_color("#9C6500")
XL_GRAY_FILL = xl_color("#F2F2F2")
XL_GREEN_TEXT = xl_color("#006100")

thin = Side(style="thin", color=XL_BORDER)
BOX = Border(left=thin, right=thin, top=thin, bottom=thin)

OUT = os.path.abspath("docs/review/2026-11-10-上线冲刺改造清单.xlsx")

wb = Workbook()
wb.properties.title = "Demo 评审与上线冲刺改造清单"
wb.properties.creator = "WorkBuddy"


def style_header(ws, row: int, cols: int, height: int = 30) -> None:
    for c in range(1, cols + 1):
        cell = ws.cell(row=row, column=c)
        cell.fill = PatternFill("solid", fgColor=XL_PRIMARY)
        cell.font = Font(name="微软雅黑", size=10.5, bold=True, color=XL_WHITE)
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = BOX
    ws.row_dimensions[row].height = height


def style_body(ws, first: int, last: int, cols: int, wrap_cols=()) -> None:
    for r in range(first, last + 1):
        for c in range(1, cols + 1):
            cell = ws.cell(row=r, column=c)
            cell.font = Font(name="微软雅黑", size=10, color=XL_TEXT)
            cell.border = BOX
            if c in wrap_cols:
                cell.alignment = Alignment(horizontal="left", vertical="top", wrap_text=True)
            else:
                cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)


def set_widths(ws, widths) -> None:
    for idx, width in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(idx)].width = width


# ---------------------------------------------------------------- 问题清单（明细）
problems = [
    # ID, 优先级, 模块, 问题, 证据/现状, 改造动作, 验收标准, 人日
    ("P0-01", "P0", "商业化", "广告占位文案外露，康复/结算/诊断多处显示“（广告暂未开放）”", "AdQuota.ts:55 拼接后缀；w19-recovery / w18-result 截图可见", "接入真实广告位；未配置时整条入口不渲染，禁止出现“暂未开放/敬请期待”", "全量截图搜不到“暂未开放”", 0.5),
    ("P0-02", "P0", "商业化", "支付链路全关，三处固定返回 PAY_UNAVAILABLE", "Pay.ts:26、createOrder/index.ts:47、payCallback/index.ts:36", "本版只上 IAA 则隐藏所有购买入口；若上 IAP，Android 接真实虚拟支付并做幂等发货", "全屏无价格/购买文案（iOS）", 0.5),
    ("P0-03", "P0", "合规", "协议与客服 URL 仍是 example.com 占位", "LegalConfig.ts 的 LEGAL_DOCS×3 + CUSTOMER_SERVICE", "替换真实 HTTPS H5 与微信客服会话 URL，跑 legalUrlsReady 自检", "关于页三份协议与客服均可真打开", 1.0),
    ("P0-04", "P0", "长线", "排行榜恒空，全仓无 leaderboard 写入方", "cloudfunctions/leaderboard 只读；无 collection('leaderboard').add", "接周榜写入（结算后异步），或先下架“成神榜”入口", "榜单有真实数据，或入口不存在", 2.0),
    ("P0-05", "P0", "技术", "真机 5 项性能未测（帧率/内存/DrawCall/4G 首屏/切后台）", "W15-性能回归项 §5 明确待人工执行", "低/中/高三台真机跑一轮，输出机型+截图+数值", "低端 ≥30fps、内存 ≤200MB、4G 首屏可接受", 2.0),
    ("P0-06", "P0", "技术", "全链路控制台 5 条报错，含 1 条 404 资源", "回归输出 collected=5：meta 警告×2、AudioContext×2、404×1", "定位 404 资源；首次手势后恢复 AudioContext；清理弃用 meta", "全链路回归 0 error、0 404", 1.0),
    ("P0-07", "P0", "UI", "三处文字/元素碰撞", "听诊“连击×2”压“不错，接住了”；启动页“适龄提示”压按钮；结算 toast 压按钮", "逐屏调整锚点与层级，纳入截图回归", "截图无重叠、无压字", 1.0),
    ("P0-08", "P0", "数据", "埋点队列已实现但未验证落库与看板", "Track.ts 有批量上报，未跑 14 事件核对", "按 03 §9 事件表跑一局，核对后台事件与属性", "14 个核心事件可在后台查到", 1.0),
    ("P0-09", "P0", "UI", "隐私弹窗按钮在无头环境无响应（待真机复核）", "节点存在、勾选 TOUCH_END 正常，但同意/暂不同意按钮点击无效", "真机复核；若复现，检查 Button 热区与遮挡层级", "真机可点，或确认是测试环境差异", 0.5),
    ("P1-01", "P1", "玩法", "治疗是“三行选项”的表单，不是有代价的决策", "w19-treatment / flow-10：药品/床位/时间三行 chip，选完直接开始", "治疗 2.0：3 个并发病症、4 个行动点、状态条实时变化、1 次补救", "单局 ≥3 个有代价决策；错药有可见后果", 8.0),
    ("P1-02", "P1", "玩法", "失败零成本、无限重试，紧张感被抹平", "Treatment.ts 不达标清空重选，无次数/资源成本", "失败改为转院：扣口碑、退半药、图鉴记“未救回”；仅 1 次免费重试", "失败后玩家能说出“我失去了它”", 3.0),
    ("P1-03", "P1", "玩法", "危重病例没有时间压力", "危重仅要求 3/3 全对，无倒计时", "危重加 60 秒倒计时 + 心跳声随剩余时间加速", "倒计时可感知、可失败", 2.0),
    ("P1-04", "P1", "情绪", "情绪顶点是 10–20 秒的进度条等待", "w19-recovery：约 90px 小图 + 进度条 + “还需 10 秒”", "康复互动化：3 次护理点击、三段姿态（蜷缩→抬头→站起）、叫声反馈", "康复页停留 ≥5 秒且有事可做", 5.0),
    ("P1-05", "P1", "情绪", "结算只有数字与星星，宠物不在场", "flow-13：星级+金币+爱心+文字，无宠物演出", "结算演出：蹭手 2 秒→逐颗出星→金币滚动→图鉴卡翻面", "录屏 10 秒内出现 3 个正反馈", 3.0),
    ("P1-06", "P1", "新手", "无新手引导，首局先抽卡再进病例", "启动→大厅→街头寻访→接诊，首次心跳在 40–60 秒后", "首局脚本：跳过抽卡，纸箱里的幼猫直接进病例，30 秒内首次听诊", "新号 30 秒内进入第一次操作", 4.0),
    ("P1-07", "P1", "音频", "0 条 BGM、无 UI 音、无环境音", "AudioConfig.ts 仅 9 条音效；大厅/诊断/结算接近静音", "3 条 BGM（大厅/诊疗/结算）+ 4 条 UI 音（点击/翻页/成功/失败）", "除静音键外全程有铺底", 2.0),
    ("P1-08", "P1", "表现", "反馈层薄：无震屏、无粒子爆发、无数字滚动、无转场", "有 MotionKit/ParticleKit，但关键节点未编排", "反馈预算：点击 0.96、成功 1 粒子+1 音、数值 200ms 滚动、切换 200ms 淡入+推镜", "每个交互都有声或动", 4.0),
    ("P1-09", "P1", "美术", "三套宠物画风并存，AI 生成痕迹明显", "英短 3D 毛绒 / 布偶写实 / 橘猫扁平；高光、胡须、爪垫不一致", "统一“黏土玩具”语言：光照方向、描边、色温、透明底；20 只重绘或统一后处理", "同屏 3 只无风格冲突", 6.0),
    ("P1-10", "P1", "UI", "按钮无主次，每屏没有唯一主行为", "大厅“街头寻访”与“医院扩建”等宽同色；诊断页返回键与主操作同权重", "每屏 1 个珊瑚色主按钮，其余降为次级（描边/浅底）", "任意截图 1 秒内能找到主按钮", 1.0),
    ("P1-11", "P1", "UI", "构图重心过高，诊断/领养/治疗下半屏大片空白", "w25-p1b-xray、flow-12 下半屏 40% 为空", "底部放宠物特写+状态条或“下一步”提示，纵向三段式构图", "无 >25% 的纯空区域", 2.0),
    ("P1-12", "P1", "叙事", "病例介绍是静态图+文字，缺少分镜", "w19-caseintro：宠物贴图+病情卡+两个按钮", "病例页加 1 个 2 秒入场（宠物发抖/呼吸）+ 症状逐个浮现", "病例页有演出，不是静态海报", 3.0),
    ("P2-01", "P2", "长线", "没有每日目标，玩家不知道今天该干什么", "全仓无 dailyTask/todayGoal", "大厅“今日救助目标”3 条（完成 1 例/护理 1 次/收 1 次菜），完成给 1 次免费寻访", "次日回访有明确理由", 3.0),
    ("P2-02", "P2", "长线", "没有 7 日节奏与登录奖励", "无签到、无 7 日配置", "第 1/3/5/7 天各一个目标，奖励配置化", "7 天内容可配置、可验收", 3.0),
    ("P2-03", "P2", "商业化", "广告点位过多且未分级", "AdConfig 7 个场景全占位", "先接 5 个高频点位（康复加速/诊断线索/结算双倍/免费寻访/补药），单日上限 8 次", "广告渗透 25%–35%，失败瞬间不弹", 3.0),
    ("P2-04", "P2", "商业化", "Android 无内购，ARPPU 缺一条腿", "createOrder 全返回 PAY_UNAVAILABLE", "6 元首充 + 30 元月卡（先做 2 个 SKU），沙箱跑通下单→回调→发货", "沙箱三单幂等通过", 5.0),
    ("P2-05", "P2", "传播", "缺少可分享的领养证书图片", "分享率未测，无出图能力", "领养完成生成证书图（宠物+名字+寄语+二维码）", "分享率 ≥8%", 3.0),
    ("P2-06", "P2", "长线", "图鉴没有进度感", "CodexPanel 是列表，无总量进度", "顶部“救助进度 12/20”与下一只未解锁剪影", "大厅/图鉴可见进度", 1.0),
    ("P2-07", "P2", "长线", "医院升级只是一个按钮，缺少可见成长", "Lobby 的“医院扩建”与寻访同权重", "改成诊室扩建进度条（3 个诊室分段点亮）", "等级提升有可见变化", 2.0),
    ("P2-08", "P2", "内容", "20 个病例文案同质，缺少记忆点", "cases.json 每例结构相同，缺个性化一句", "每例补 1 句“它为什么来到这里”，共 20 句", "玩家能记住至少 3 个病例", 2.0),
]

ws = wb.active
ws.title = "评审总览"
ws.sheet_properties.tabColor = "70AD47"

ws.merge_cells("A1:E1")
t = ws["A1"]
t.value = "萌宠救助日记 · Demo 评审与上线冲刺改造清单"
t.fill = PatternFill("solid", fgColor=XL_DARK)
t.font = Font(name="微软雅黑", size=16, bold=True, color=XL_WHITE)
t.alignment = Alignment(horizontal="center", vertical="center")
ws.row_dimensions[1].height = 42

ws.merge_cells("A2:E2")
s = ws["A2"]
s.value = "评审对象：build/web-mobile-w32（2026-11-10 20:10）｜ 方法：源码走查 + 390×844 全链路实跑 + 16 张流程截图"
s.font = Font(name="微软雅黑", size=9.5, color=XL_MUTED)
s.alignment = Alignment(horizontal="center", vertical="center")
ws.row_dimensions[2].height = 24

# KPI 卡片（数值在脚本内一次算好写入，避免无重算引擎时预览空白）
DIMS = [
    ("功能完整度", 82, 0.30, "8 场景、20 病例、3 类诊断、治疗/康复/领养/图鉴/小屋/后院/送养/寻访/成就全部跑通"),
    ("单局可玩性", 52, 0.20, "治疗是三行选项；失败零成本无限重试；诊断只占 20–40 秒"),
    ("表现力", 45, 0.10, "有动效工具，但关键节点没有演出编排"),
    ("音频", 25, 0.08, "9 条音效、0 条 BGM、无 UI 音"),
    ("美术一致性", 48, 0.10, "三套宠物画风并存；UI 是通用奶油色卡片"),
    ("情感叙事", 55, 0.05, "领养寄语写得好，但演出缺位"),
    ("长线目标", 50, 0.07, "有成就/图鉴/后院，无每日目标与 7 日节奏"),
    ("商业化", 20, 0.05, "7 个广告位占位；支付三处关闭"),
    ("技术质量", 72, 0.05, "tsc 0 错误、回归脚本齐全；控制台仍有 5 条报错"),
]
QUALITY = round(sum(score * weight for _, score, weight, _ in DIMS))
P0_COUNT = sum(1 for p in problems if p[1] == "P0")
MANDAYS = sum(p[7] for p in problems)

GATES = [
    ("首局完成率", 0.70, None, "%", "≥", "进入病例到结算的比例；埋点 case_start → case_result"),
    ("首日留存 D1", 0.35, None, "%", "≥", "次日回访 / 首日新增"),
    ("7 日留存 D7", 0.12, None, "%", "≥", "有每日目标后再看"),
    ("单局时长", 5.5, None, "分钟", "≤", "中位数；超过 6 分钟复盘"),
    ("三星率", 0.45, None, "%", "≤", "过低挫败、过高无挑战（目标 30%–45%）"),
    ("广告渗透", 0.25, None, "%", "≥", "当日看过至少 1 次激励视频的 DAU 占比"),
    ("分享率", 0.08, None, "%", "≥", "领养证书是主要抓手"),
    ("低端机帧率", 30, None, "fps", "≥", "低端 Android 真机，单局 30 秒不明显掉帧"),
    ("崩溃率", 0.005, None, "%", "≤", "平台后台 + 自建上报"),
    ("P0 阻断项", 0, P0_COUNT, "个", "≤", "问题清单中优先级为 P0 的未关闭项"),
    ("主包体积", 4, 3.54, "MB", "≤", "最近一次微信构建主包 3,716,567 B，上限 4 MB"),
    ("BGM 条数", 3, 0, "条", "≥", "大厅/诊疗/结算各一条"),
    ("真实广告点位", 5, 0, "个", "≥", "康复加速/诊断线索/结算双倍/免费寻访/补药"),
    ("控制台 error", 0, 1, "条", "≤", "全链路回归，当前含 1 条 404"),
    ("排行榜写入", 1, 0, "个", "≥", "有写入方，或入口已下架"),
]


def gate_status(g) -> str:
    _, target, current, _, direction, _ = g
    if current is None:
        return "待测"
    ok = current >= target if direction == "≥" else current <= target
    return "达标" if ok else "未达标"


EVALUATED = [g for g in GATES if g[2] is not None]
PASS_RATE = sum(1 for g in EVALUATED if gate_status(g) == "达标") / len(EVALUATED)

cards = [
    ("A3", "综合品质分", QUALITY, "满分 100"),
    ("B3", "P0 阻断项", P0_COUNT, "不解决不能提审"),
    ("C3", "改造总人日", MANDAYS, "按单人估算"),
    ("D3", "门槛达标率", PASS_RATE, f"已评估 {len(EVALUATED)} 项"),
]
for cell, label, formula, note in cards:
    col = cell[0]
    ws[f"{col}3"] = label
    ws[f"{col}3"].font = Font(name="微软雅黑", size=9.5, color=XL_MUTED)
    ws[f"{col}3"].alignment = Alignment(horizontal="center", vertical="center")
    ws[f"{col}4"] = formula
    ws[f"{col}4"].font = Font(name="微软雅黑", size=24, bold=True, color=XL_DARK)
    ws[f"{col}4"].alignment = Alignment(horizontal="center", vertical="center")
    ws[f"{col}5"] = note
    ws[f"{col}5"].font = Font(name="微软雅黑", size=8.5, color=XL_MUTED)
    ws[f"{col}5"].alignment = Alignment(horizontal="center", vertical="center")
ws["D4"].number_format = "0%"

ws.row_dimensions[3].height = 22
ws.row_dimensions[4].height = 40
ws.row_dimensions[5].height = 20

# 维度评分
ws["A7"] = "维度"
ws["B7"] = "分数"
ws["C7"] = "权重"
ws["D7"] = "加权分"
ws["E7"] = "评分依据"
style_header(ws, 7, 5)

dims = DIMS
for i, (name, score, weight, reason) in enumerate(dims):
    r = 8 + i
    ws[f"A{r}"] = name
    ws[f"B{r}"] = score
    ws[f"C{r}"] = weight
    ws[f"C{r}"].number_format = "0%"
    ws[f"D{r}"] = round(score * weight, 1)
    ws[f"E{r}"] = reason
style_body(ws, 8, 16, 5, wrap_cols=(5,))
for r in range(8, 17):
    ws.row_dimensions[r].height = 30

ws["A17"] = "合计"
ws["B17"] = "—"
ws["C17"] = 1.0
ws["D17"] = QUALITY
ws["E17"] = "综合品质分约 57：功能及格、手感与音画拖后腿"
for c in range(1, 6):
    cell = ws.cell(row=17, column=c)
    cell.fill = PatternFill("solid", fgColor=XL_LIGHT)
    cell.font = Font(name="微软雅黑", size=10.5, bold=True, color=XL_DARK)
    cell.border = BOX
    cell.alignment = Alignment(horizontal="center" if c < 5 else "left", vertical="center")
ws["C17"].number_format = "0%"
ws.row_dimensions[17].height = 26

# 三个优先动作
ws.merge_cells("A19:E19")
ws["A19"] = "如果只做三件事"
ws["A19"].fill = PatternFill("solid", fgColor=XL_PRIMARY)
ws["A19"].font = Font(name="微软雅黑", size=11, bold=True, color=XL_WHITE)
ws["A19"].alignment = Alignment(horizontal="left", vertical="center")
ws.row_dimensions[19].height = 26

actions = [
    ("1", "治疗 2.0 + 危重倒计时", "把“选择题”变成“有代价的决策”，让玩家第一次感到“我可能救不活它”。"),
    ("2", "康复与结算演出", "把“等待”变成“回报”，做出玩家愿意截图分享的 10 秒。"),
    ("3", "首局 30 秒脚本 + BGM", "把“路过”变成“留下”，先解决前 30 秒的流失。"),
]
for i, (num, title, desc) in enumerate(actions):
    r = 20 + i
    ws[f"A{r}"] = num
    ws.merge_cells(f"B{r}:C{r}")
    ws[f"B{r}"] = title
    ws[f"B{r}"].font = Font(name="微软雅黑", size=10.5, bold=True, color=XL_TEXT)
    ws.merge_cells(f"D{r}:E{r}")
    ws[f"D{r}"] = desc
    ws[f"D{r}"].font = Font(name="微软雅黑", size=9.5, color=XL_MUTED)
    for c in range(1, 6):
        cell = ws.cell(row=r, column=c)
        cell.border = BOX
        cell.alignment = Alignment(horizontal="center" if c == 1 else "left", vertical="center", wrap_text=True)
    ws.row_dimensions[r].height = 30

ws.merge_cells("A24:E24")
ws["A24"] = ("结论：不是“没做完”，是“做完了没做透”。系统广度已经够，缺的是单局手感、情绪演出、声音与目标感；"
             "先把 P0 清零，再按 Sprint 1→2 推进，25 个工作日后具备提审条件。")
ws["A24"].font = Font(name="微软雅黑", size=10, color=XL_TEXT)
ws["A24"].alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)
ws["A24"].fill = PatternFill("solid", fgColor=XL_GRAY_FILL)
ws.row_dimensions[24].height = 44

set_widths(ws, [14, 16, 16, 16, 62])

# ---------------------------------------------------------------- 问题清单
ws2 = wb.create_sheet("问题清单")
ws2.sheet_properties.tabColor = "548235"
headers = ["ID", "优先级", "模块", "问题", "证据 / 现状", "改造动作", "验收标准", "人日", "状态", "对应阶段"]
for i, h in enumerate(headers, start=1):
    ws2.cell(row=1, column=i, value=h)
style_header(ws2, 1, len(headers))

stage_map = {"P0": "Sprint 0", "P1": "Sprint 1", "P2": "Sprint 2"}
P0_STAGE = {
    "P0-01": "Sprint 0",
    "P0-02": "Sprint 2",
    "P0-03": "Sprint 3",
    "P0-04": "Sprint 2",
    "P0-05": "Sprint 0",
    "P0-06": "Sprint 0",
    "P0-07": "Sprint 0",
    "P0-08": "Sprint 3",
    "P0-09": "Sprint 0",
}
for i, row in enumerate(problems):
    r = 2 + i
    pid, priority, module, issue, evidence, action, accept, days = row
    ws2.cell(row=r, column=1, value=pid)
    ws2.cell(row=r, column=2, value=priority)
    ws2.cell(row=r, column=3, value=module)
    ws2.cell(row=r, column=4, value=issue)
    ws2.cell(row=r, column=5, value=evidence)
    ws2.cell(row=r, column=6, value=action)
    ws2.cell(row=r, column=7, value=accept)
    ws2.cell(row=r, column=8, value=days)
    ws2.cell(row=r, column=9, value="未开始")
    ws2.cell(row=r, column=10, value=P0_STAGE.get(pid, stage_map[priority]))

last = len(problems) + 1
style_body(ws2, 2, last, len(headers), wrap_cols=(4, 5, 6, 7))
for r in range(2, last + 1):
    ws2.row_dimensions[r].height = 52
set_widths(ws2, [9, 8, 9, 30, 34, 38, 26, 6, 9, 11])

ws2.freeze_panes = "A2"
ws2.auto_filter.ref = f"A1:J{last}"

dv_p = DataValidation(type="list", formula1='"P0,P1,P2"', allow_blank=False)
dv_s = DataValidation(type="list", formula1='"未开始,进行中,已完成,阻塞"', allow_blank=False)
ws2.add_data_validation(dv_p)
ws2.add_data_validation(dv_s)
dv_p.add(f"B2:B{last}")
dv_s.add(f"I2:I{last}")

ws2.conditional_formatting.add(
    f"B2:B{last}",
    FormulaRule(formula=['$B2="P0"'], fill=PatternFill("solid", fgColor=XL_RED_FILL), font=Font(color=XL_RED_TEXT, bold=True)),
)
ws2.conditional_formatting.add(
    f"B2:B{last}",
    FormulaRule(formula=['$B2="P1"'], fill=PatternFill("solid", fgColor=XL_YELLOW_FILL), font=Font(color=XL_YELLOW_TEXT, bold=True)),
)
ws2.conditional_formatting.add(
    f"B2:B{last}",
    FormulaRule(formula=['$B2="P2"'], fill=PatternFill("solid", fgColor=XL_GRAY_FILL), font=Font(color=XL_MUTED)),
)
ws2.conditional_formatting.add(
    f"I2:I{last}",
    FormulaRule(formula=['$I2="已完成"'], fill=PatternFill("solid", fgColor=XL_LIGHT), font=Font(color=XL_GREEN_TEXT, bold=True)),
)
ws2.conditional_formatting.add(
    f"I2:I{last}",
    FormulaRule(formula=['$I2="阻塞"'], fill=PatternFill("solid", fgColor=XL_RED_FILL), font=Font(color=XL_RED_TEXT)),
)

# ---------------------------------------------------------------- 执行计划
ws3 = wb.create_sheet("执行计划")
ws3.sheet_properties.tabColor = "70AD47"
plan_headers = ["序号", "任务", "阶段", "负责人", "开始日期", "结束日期", "持续天数", "依赖", "交付物", "状态"]
for i, h in enumerate(plan_headers, start=1):
    ws3.cell(row=1, column=i, value=h)
style_header(ws3, 1, len(plan_headers))

D = dt.date
plan = [
    ("清理“暂未开放”文案与入口", "Sprint 0 止血", "客户端", D(2026, 11, 11), D(2026, 11, 11), "P0-01", "未配置即不渲染的广告入口", "未开始"),
    ("修 3 处文字/元素碰撞", "Sprint 0 止血", "客户端", D(2026, 11, 11), D(2026, 11, 12), "P0-07", "听诊/启动/结算截图", "未开始"),
    ("补大厅 BGM + 4 条 UI 音", "Sprint 0 止血", "音频", D(2026, 11, 11), D(2026, 11, 13), "P1-07", "3 条 BGM + 4 条 UI 音", "未开始"),
    ("定位 404、清零控制台", "Sprint 0 止血", "客户端", D(2026, 11, 12), D(2026, 11, 12), "P0-06", "0 error 回归输出", "未开始"),
    ("三机性能基线", "Sprint 0 止血", "QA", D(2026, 11, 12), D(2026, 11, 13), "P0-05", "低/中/高三机报告", "未开始"),
    ("治疗 2.0 规则与配置", "Sprint 1 手感", "策划", D(2026, 11, 14), D(2026, 11, 16), "P1-01", "3 病症/4 行动点配置表", "未开始"),
    ("治疗 2.0 表现与结算", "Sprint 1 手感", "客户端", D(2026, 11, 17), D(2026, 11, 21), "治疗规则", "状态条 + 补救窗口", "未开始"),
    ("转院失败链路", "Sprint 1 手感", "客户端", D(2026, 11, 18), D(2026, 11, 21), "P1-02", "扣口碑/退药/图鉴记录", "未开始"),
    ("康复互动化", "Sprint 1 手感", "客户端", D(2026, 11, 18), D(2026, 11, 22), "P1-04", "3 次护理 + 三段姿态", "未开始"),
    ("结算演出", "Sprint 1 手感", "客户端", D(2026, 11, 20), D(2026, 11, 23), "P1-05", "蹭手/逐星/滚动/翻卡", "未开始"),
    ("首局 30 秒脚本", "Sprint 1 手感", "策划+客户端", D(2026, 11, 16), D(2026, 11, 20), "P1-06", "首局不抽卡、30 秒首操作", "未开始"),
    ("反馈预算落地", "Sprint 1 手感", "客户端", D(2026, 11, 19), D(2026, 11, 23), "P1-08", "点击/成功/失败/转场四类", "未开始"),
    ("广告 5 点位接入", "Sprint 2 商业化", "客户端+运营", D(2026, 11, 24), D(2026, 11, 28), "P0-01", "5 个真实广告位 + 频控", "未开始"),
    ("Android 支付沙箱", "Sprint 2 商业化", "服务端", D(2026, 11, 24), D(2026, 12, 1), "P0-02", "首充/月卡两 SKU 闭环", "未开始"),
    ("每日目标 3 条", "Sprint 2 长线", "客户端", D(2026, 11, 25), D(2026, 11, 28), "P2-01", "今日目标面板 + 奖励", "未开始"),
    ("7 日节奏与登录奖励", "Sprint 2 长线", "策划", D(2026, 11, 26), D(2026, 12, 1), "P2-02", "7 日配置表", "未开始"),
    ("图鉴/医院进度可视化", "Sprint 2 长线", "客户端", D(2026, 11, 28), D(2026, 12, 2), "P2-06", "12/20 进度 + 诊室分段", "未开始"),
    ("领养证书分享图", "Sprint 2 传播", "客户端", D(2026, 11, 29), D(2026, 12, 3), "P2-05", "证书出图 + 分享埋点", "未开始"),
    ("排行榜写入或下架", "Sprint 2 长线", "服务端", D(2026, 11, 24), D(2026, 11, 26), "P0-04", "周榜有数据或入口移除", "未开始"),
    ("全量回归 + 真机复测", "Sprint 3 提审", "QA", D(2026, 12, 4), D(2026, 12, 5), "Sprint 1/2", "回归报告 + 录屏", "未开始"),
    ("埋点核对 14 事件", "Sprint 3 提审", "数据", D(2026, 12, 4), D(2026, 12, 5), "P0-08", "事件后台截图", "未开始"),
    ("提审素材 10 张", "Sprint 3 提审", "制作人", D(2026, 12, 5), D(2026, 12, 7), "Sprint 0-2", "截图 + 文案 + 隐私说明", "未开始"),
    ("灰度 10%→50%→100%", "Sprint 3 提审", "制作人", D(2026, 12, 8), D(2026, 12, 10), "全量回归", "灰度记录与回滚预案", "未开始"),
]
for i, (task, phase, owner, start, end, dep, deliver, status) in enumerate(plan):
    r = 2 + i
    ws3.cell(row=r, column=1, value=i + 1)
    ws3.cell(row=r, column=2, value=task)
    ws3.cell(row=r, column=3, value=phase)
    ws3.cell(row=r, column=4, value=owner)
    ws3.cell(row=r, column=5, value=start)
    ws3.cell(row=r, column=6, value=end)
    ws3.cell(row=r, column=7, value=(end - start).days + 1)
    ws3.cell(row=r, column=8, value=dep)
    ws3.cell(row=r, column=9, value=deliver)
    ws3.cell(row=r, column=10, value=status)

plan_last = len(plan) + 1
style_body(ws3, 2, plan_last, len(plan_headers), wrap_cols=(2, 8, 9))
for r in range(2, plan_last + 1):
    ws3.cell(row=r, column=5).number_format = "yyyy-mm-dd"
    ws3.cell(row=r, column=6).number_format = "yyyy-mm-dd"
    ws3.cell(row=r, column=7).number_format = "0"
    ws3.row_dimensions[r].height = 34
set_widths(ws3, [6, 26, 14, 12, 12, 12, 9, 14, 28, 9])
ws3.freeze_panes = "A2"
ws3.auto_filter.ref = f"A1:J{plan_last}"

dv_s3 = DataValidation(type="list", formula1='"未开始,进行中,已完成,阻塞"', allow_blank=False)
ws3.add_data_validation(dv_s3)
dv_s3.add(f"J2:J{plan_last}")
ws3.conditional_formatting.add(
    f"J2:J{plan_last}",
    FormulaRule(formula=['$J2="已完成"'], fill=PatternFill("solid", fgColor=XL_LIGHT), font=Font(color=XL_GREEN_TEXT, bold=True)),
)
ws3.conditional_formatting.add(
    f"J2:J{plan_last}",
    FormulaRule(formula=['$J2="进行中"'], fill=PatternFill("solid", fgColor=XL_YELLOW_FILL), font=Font(color=XL_YELLOW_TEXT)),
)

# ---------------------------------------------------------------- 上线门槛
ws4 = wb.create_sheet("上线门槛")
ws4.sheet_properties.tabColor = "548235"
gate_headers = ["指标", "目标值", "当前值", "单位", "方向", "状态", "测量方法 / 备注"]
for i, h in enumerate(gate_headers, start=1):
    ws4.cell(row=1, column=i, value=h)
style_header(ws4, 1, len(gate_headers))

gates = GATES
for i, (name, target, current, unit, direction, note) in enumerate(gates):
    r = 2 + i
    ws4.cell(row=r, column=1, value=name)
    ws4.cell(row=r, column=2, value=target)
    if current is not None:
        ws4.cell(row=r, column=3, value=current)
    ws4.cell(row=r, column=4, value=unit)
    ws4.cell(row=r, column=5, value=direction)
    ws4.cell(row=r, column=6, value=gate_status((name, target, current, unit, direction, note)))
    ws4.cell(row=r, column=7, value=note)
    if unit == "%":
        ws4.cell(row=r, column=2).number_format = "0.0%"
        if current is not None:
            ws4.cell(row=r, column=3).number_format = "0.0%"

gate_last = len(gates) + 1
style_body(ws4, 2, gate_last, len(gate_headers), wrap_cols=(7,))
for r in range(2, gate_last + 1):
    ws4.row_dimensions[r].height = 30
set_widths(ws4, [20, 11, 10, 7, 7, 10, 56])
ws4.freeze_panes = "A2"

ws4.conditional_formatting.add(
    f"F2:F{gate_last}",
    FormulaRule(formula=['$F2="达标"'], fill=PatternFill("solid", fgColor=XL_LIGHT), font=Font(color=XL_GREEN_TEXT, bold=True)),
)
ws4.conditional_formatting.add(
    f"F2:F{gate_last}",
    FormulaRule(formula=['$F2="未达标"'], fill=PatternFill("solid", fgColor=XL_RED_FILL), font=Font(color=XL_RED_TEXT, bold=True)),
)
ws4.conditional_formatting.add(
    f"F2:F{gate_last}",
    FormulaRule(formula=['$F2="待测"'], fill=PatternFill("solid", fgColor=XL_YELLOW_FILL), font=Font(color=XL_YELLOW_TEXT)),
)

wb.save(OUT)
print("saved", OUT)
