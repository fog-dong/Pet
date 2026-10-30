// STATUS: implemented, W5 云存档推送（revision 乐观锁；冲突按 09 §5.1 以服务端为准）
import { sys } from 'cc';
import { Net } from './Net';
import { readPendingSave, writePendingSave } from '../cache/PendingSync';
import { COPY } from '../config/CopyText';
import { Track } from '../track/Track';

const REV_KEY = 'pet_cloud_rev_v1';

export interface PushResult {
  ok: boolean;
  /** true 表示命中 1004，本地快照被丢弃，已采用服务端 revision。 */
  stale: boolean;
  revision: number;
}

interface SaveGameData {
  revision: number;
  serverTime: number;
}

function readRevision(): number {
  const raw = sys.localStorage.getItem(REV_KEY);
  const value = raw ? Number(raw) : 0;
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function writeRevision(revision: number): void {
  sys.localStorage.setItem(REV_KEY, String(revision));
}

export async function pushSave(snapshot: Record<string, unknown>): Promise<PushResult> {
  const revision = readRevision() + 1;
  if (!Net.ready) {
    writePendingSave({ revision, snapshot });
    return { ok: false, stale: false, revision: readRevision() };
  }
  const response = await Net.call<SaveGameData>('saveGame', { revision, snapshot });
  if (response.code === 0) {
    writeRevision(revision);
    writePendingSave(null);
    return { ok: true, stale: false, revision };
  }
  if (response.code === 1004 && response.data) {
    writeRevision(response.data.revision);
    writePendingSave(null);
    Track.track('save_conflict', { local: revision, server: response.data.revision });
    return { ok: false, stale: true, revision: response.data.revision };
  }
  if (response.code !== 1002) {
    writePendingSave({ revision, snapshot });
    Track.track('save_queued', { code: response.code });
  }
  return { ok: false, stale: false, revision: readRevision() };
}

export async function retryPendingSave(): Promise<boolean> {
  const pending = readPendingSave();
  if (!pending || !Net.ready) {
    return false;
  }
  const result = await pushSave(pending.snapshot);
  if (result.ok) {
    Track.track('pending_save_flushed', { revision: result.revision });
  }
  return result.ok;
}

export function pushHint(result: PushResult): string {
  if (result.ok) {
    return '';
  }
  return result.stale ? '云端存档已更新，本地结算已同步' : COPY.weakNetwork;
}
