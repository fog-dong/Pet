// STATUS: implemented, W18-2 医院面板（等级 / 床位 / 领养位 / 金币扩建 / 医生入驻占位）
import { BlockInputEvents, Color, Node } from 'cc';
import { Save } from '../cache/Save';
import { Hospital } from '../game/Hospital';
import { DOCTORS } from '../game/HospitalLevels';
import { Track } from '../track/Track';
import { addLabel, addRect, PALETTE } from './SceneUI';
import { addCard, addDivider } from './PanelKit';
import { screenHeight, screenWidth } from './ScreenMetrics';
import { addUIButton, setUIButtonState } from './UIButton';
import { COLORS } from './Tokens';

let overlay: Node | null = null;

function close(): void {
  if (overlay) {
    overlay.destroy();
  }
  overlay = null;
}

/** 07 §3.1 扩建入口：金币唯一消耗点，医生表先做入驻展示（排班与加成留给 P2）。 */
export function openHospitalPanel(parent: Node, onChanged: () => void): void {
  close();
  Track.track('hospital_panel_open', { level: Hospital.level });
  overlay = addRect(parent, 'HospitalOverlay', 0, screenWidth(), screenHeight(), new Color(0, 0, 0, 150));
  overlay.addComponent(BlockInputEvents);
  overlay.setSiblingIndex(parent.children.length - 1);
  const config = Hospital.levelConfig;
  const panel = addCard(overlay, 'HospitalPanel', 0, 660, 820, { color: PALETTE.panel });
  addLabel(panel, 'HospitalTitle', `医 院 · Lv.${config.level}`, 350, { size: 34 });
  addLabel(panel, 'HospitalUnlock', config.unlock, 298, { size: 24, color: PALETTE.primary });
  addDivider(panel, 262, 560);
  addLabel(panel, 'HospitalBeds', `床位 ${Hospital.bedsOccupied}/${Hospital.bedsOwned}`, 222, { size: 26 });
  addLabel(panel, 'HospitalSlots', `领养位 ${Hospital.adoptedCount}/${Hospital.slots}`, 222, {
    size: 26,
    x: 220,
  });
  buildUpgrade(panel, parent, onChanged);
  addLabel(panel, 'HospitalCoins', `当前金币 ${Save.coins}`, -55, { size: 24, color: PALETTE.sub });
  addDivider(panel, -100, 560);
  buildDoctors(panel);
  addUIButton(panel, 'HospitalClose', '关 闭', () => close(), {
    y: -352,
    width: 340,
    height: 76,
    color: COLORS.sage,
    fontSize: 28,
  });
}

function buildUpgrade(panel: Node, host: Node, onChanged: () => void): void {
  const next = Hospital.nextLevel;
  if (!next) {
    addLabel(panel, 'HospitalNext', '已达最高等级，感谢你把小院越办越好', 150, { size: 24 });
    return;
  }
  const affordable = Save.coins >= next.cost;
  addLabel(panel, 'HospitalNext', `下一级 Lv.${next.level} · ${next.unlock}`, 155, { size: 24 });
  const button = addUIButton(panel, 'HospitalUpgrade', '', () => {
    if (Hospital.upgrade()) {
      Track.track('hospital_upgrade', { level: Hospital.level, cost: next.cost });
      onChanged();
      openHospitalPanel(host, onChanged);
      return;
    }
    Track.track('hospital_upgrade_denied', { cost: next.cost, coins: Save.coins });
  }, { y: 62, width: 380, height: 86, color: PALETTE.secondary, fontSize: 28 });
  setUIButtonState(
    button,
    affordable,
    affordable ? `升级 · ${next.cost} 金币` : `金币不足（需 ${next.cost}）`,
    PALETTE.secondary,
  );
}

/** 医生按等级入驻；本轮只展示，不接问诊加成。 */
function buildDoctors(panel: Node): void {
  addLabel(panel, 'HospitalDoctorTitle', '医生团队（P2 开放排班）', -140, { size: 24, color: PALETTE.sub });
  DOCTORS.forEach((doctor, index) => {
    const x = index % 2 === 0 ? -150 : 150;
    const y = -182 - Math.floor(index / 2) * 42;
    const entered = Hospital.level >= doctor.level;
    const text = entered ? `${doctor.name} · 已入驻` : `${doctor.name} · Lv.${doctor.level} 入驻`;
    addLabel(panel, `HospitalDoctor${index}`, text, y, {
      size: 22,
      x,
      color: entered ? PALETTE.text : PALETTE.sub,
    });
  });
}
