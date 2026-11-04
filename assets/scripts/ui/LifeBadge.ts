// STATUS: implemented, W22-5 生命周期展示件（阶段标签 + 陪伴进度条 + 详情摘要；阈值一律来自 game/AgeSystem 读 pets.json）
// 红线：本文件只做展示换算，不参与任何经济计价（方案 §2.2.1 与红线 G4）。
import { Graphics, Label, Node, UITransform } from 'cc';
import type { HabitatPet } from '../cache/HabitatCodec';
import type { PetConfigItem } from '../config/CharacterConfig';
import { getAgeText, getLifeProgress, getLifeStage, lifespanText, STAGE_LABEL } from '../game/AgeSystem';
import type { LifeStage } from '../game/AgeSystem';
import { makeLabel } from './FontKit';
import { LIFE_TRACK, STAGE_TINT } from './Tokens';

const TAG_W = 62;
const TAG_H = 30;
const TAG_RADIUS = 15;
/** 3px 是「极细」的下限：再细在 720×1280 缩到手机上就看不清边界了。 */
const LIFE_BAR_H = 3;

/** 名字右侧的阶段小标签：浅底 + 同色系深字，槽位由调用方固定。 */
export function addStageTag(parent: Node, stage: LifeStage, x: number, y: number): void {
  const node = new Node(`StageTag_${stage}`);
  node.parent = parent;
  node.setPosition(x, y, 0);
  node.addComponent(UITransform).setContentSize(TAG_W, TAG_H);
  const graphics = node.addComponent(Graphics);
  graphics.fillColor = STAGE_TINT[stage].fill;
  graphics.roundRect(-TAG_W / 2, -TAG_H / 2, TAG_W, TAG_H, TAG_RADIUS);
  graphics.fill();
  makeLabel(node, 'StageTagText', STAGE_LABEL[stage], 0, {
    size: 20,
    width: TAG_W,
    color: STAGE_TINT[stage].text,
  });
}

/** 卡片底部的极细陪伴进度条：轨道永远画满，所以 0 进度也读得出「还没开始」。 */
export function addLifeBar(
  parent: Node,
  name: string,
  width: number,
  y: number,
  entry: HabitatPet,
  look: PetConfigItem | null,
): void {
  const node = new Node(name);
  node.parent = parent;
  node.setPosition(0, y, 0);
  node.addComponent(UITransform).setContentSize(width, LIFE_BAR_H);
  const graphics = node.addComponent(Graphics);
  graphics.fillColor = LIFE_TRACK;
  graphics.roundRect(-width / 2, -LIFE_BAR_H / 2, width, LIFE_BAR_H, LIFE_BAR_H / 2);
  graphics.fill();
  // 进度天然钳在 0-1：满格后停在 1.0，不是倒计时，所以颜色只跟随阶段。
  const ratio = getLifeProgress(entry.birthTimestamp, look);
  if (ratio > 0) {
    graphics.fillColor = STAGE_TINT[getLifeStage(entry.birthTimestamp, look)].text;
    graphics.roundRect(-width / 2, -LIFE_BAR_H / 2, Math.max(LIFE_BAR_H, width * ratio), LIFE_BAR_H, LIFE_BAR_H / 2);
    graphics.fill();
  }
}

/**
 * 卡片内的紧凑寿命两行：`陪伴 8 岁 4 个月` / `预计寿命：25 岁`，两个数字共用同一份阈值。
 * W25 P0-B 删掉互动弹窗后，这里是「预计寿命」唯一的露出口，所以改成两行贴名字下方，不再占整行宽度。
 */
export function addLifeCompact(
  parent: Node,
  name: string,
  x: number,
  y: number,
  entry: HabitatPet,
  look: PetConfigItem | null,
): void {
  makeLabel(parent, name, `陪伴 ${getAgeText(entry.birthTimestamp)}\n${lifespanText(look)}`, y, {
    size: 16,
    width: 190,
    x,
    align: Label.HorizontalAlign.LEFT,
    color: STAGE_TINT[getLifeStage(entry.birthTimestamp, look)].text,
  });
}
