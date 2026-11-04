// STATUS: implemented, W25 P2-D 卡片动作转接（护理/送养面板都挂在遮罩下，行刷新回调由小屋面板提供）
import { Label, Node } from 'cc';
import { HabitatPet } from '../cache/HabitatCodec';
import { openCarePanel } from './CarePanel';
import { applyStats, HabitatRow } from './HabitatRows';
import { habitatHintText } from './HabitatTapActions';
import { openRehomePanel } from './RehomePanel';

/** entry 为空表示只有资源/审核状态变化（如送养被拒），属性条不必重画。 */
export type RowRefresh = (row: HabitatRow, entry?: HabitatPet) => void;

/** 小屋面板把 rows / hint / 资源回调包成读取器，三个面板复用同一套刷新口径。 */
export function makeRowRefresh(
  list: () => HabitatRow[],
  hint: () => Label | null,
  changed: () => (() => void) | undefined,
): RowRefresh {
  return (row, entry) => {
    if (entry) {
      applyStats(row.stats, entry);
    }
    list().forEach((item) => item.syncAfford());
    const label = hint();
    if (label && label.isValid) {
      label.string = habitatHintText();
    }
    const notify = changed();
    if (notify) {
      notify();
    }
  };
}

export function openCareFromRow(host: Node, row: HabitatRow, refresh: RowRefresh): void {
  openCarePanel(host, row.entry.petId, (entry) => refresh(row, entry));
}

export function openRehomeFromRow(host: Node, row: HabitatRow, refresh: RowRefresh, reskin: () => void): void {
  openRehomePanel(host, row.entry.petId, () => refresh(row), reskin);
}
