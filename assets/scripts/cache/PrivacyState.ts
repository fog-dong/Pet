// STATUS: implemented, W8-5 隐私同意状态本地存档（独立键，不改动存档结构）
import { sys } from 'cc';
import { LEGAL_VERSION } from '../config/LegalConfig';

const STORAGE_KEY = 'pet_privacy_v1';

interface PrivacyRecord {
  privacyAccepted: boolean;
  acceptedVersion: string;
}

function decode(raw: string | null): PrivacyRecord {
  if (!raw) {
    return { privacyAccepted: false, acceptedVersion: '' };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<PrivacyRecord>;
    return {
      privacyAccepted: parsed.privacyAccepted === true,
      acceptedVersion: typeof parsed.acceptedVersion === 'string' ? parsed.acceptedVersion : '',
    };
  } catch {
    return { privacyAccepted: false, acceptedVersion: '' };
  }
}

export class PrivacyStore {
  private record: PrivacyRecord | null = null;

  private current(): PrivacyRecord {
    if (!this.record) {
      this.record = decode(sys.localStorage.getItem(STORAGE_KEY));
    }
    return this.record;
  }

  /** 协议版本升级后视为未同意，需要重新弹窗。 */
  accepted(): boolean {
    const record = this.current();
    return record.privacyAccepted && record.acceptedVersion === LEGAL_VERSION;
  }

  markAccepted(): void {
    this.record = { privacyAccepted: true, acceptedVersion: LEGAL_VERSION };
    sys.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.record));
  }

  /** 撤回授权入口（客服或平台侧要求时可调用）。 */
  clear(): void {
    this.record = { privacyAccepted: false, acceptedVersion: '' };
    sys.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.record));
  }
}

export const PrivacyState = new PrivacyStore();
