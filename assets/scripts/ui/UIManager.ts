// STATUS: scaffold, API frozen by architect on 2026-10-29
// API: UIManager, see docs/plan/08-客户端架构与状态机.md §4

export interface UIPage {
  readonly name: string;
  onOpen?(): void | Promise<void>;
  onClose?(): void | Promise<void>;
}

export class UIManager {
  private readonly stack: UIPage[] = [];
  private readonly maxDepth = 6;

  get depth(): number {
    return this.stack.length;
  }

  get top(): UIPage | null {
    return this.stack[this.stack.length - 1] ?? null;
  }

  async open(page: UIPage): Promise<void> {
    if (!page || !page.name) {
      return;
    }
    if (this.stack.length >= this.maxDepth) {
      await this.replace(page);
      return;
    }
    await page.onOpen?.();
    this.stack.push(page);
  }

  async close(): Promise<void> {
    const page = this.stack.pop();
    if (page) {
      await page.onClose?.();
    }
  }

  async replace(page: UIPage): Promise<void> {
    if (!page || !page.name) {
      return;
    }
    const current = this.stack.pop();
    if (current) {
      await current.onClose?.();
    }
    await page.onOpen?.();
    this.stack.push(page);
  }

  async clear(): Promise<void> {
    while (this.stack.length > 0) {
      await this.close();
    }
  }
}

export const uiManager = new UIManager();
