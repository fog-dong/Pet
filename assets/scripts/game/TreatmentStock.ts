// STATUS: implemented, W25 P2-A 治疗事务：多选药品扣库存，任一不足整单退回
import { Hospital } from './Hospital';

/**
 * 按顺序扣完所有选中的药。
 * 返回第一味库存不足的药名，并在返回前把已扣的部分整单退回；全部扣成功返回空串。
 */
export function takeMedicines(names: readonly string[]): string {
  const used: string[] = [];
  for (const name of names) {
    if (Hospital.useMedicine(name)) {
      used.push(name);
      continue;
    }
    refundMedicines(used);
    return name;
  }
  return '';
}

/** 退回一整单药品：占床失败等后续步骤回滚时用，避免半扣。 */
export function refundMedicines(used: readonly string[]): void {
  for (const name of used) {
    Hospital.addMedicine(name, 1);
  }
}
