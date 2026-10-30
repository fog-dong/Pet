// STATUS: implemented, W5 分享出口（仅用户主动点击触发；非微信环境返回 false，不抛错）
export interface ShareOptions {
  title: string;
  imageUrl?: string;
  query?: string;
}

export class ShareClient {
  get available(): boolean {
    return typeof wx !== 'undefined' && typeof wx.shareAppMessage === 'function';
  }

  /** 由页面按钮点击调用；不注册被动分享，不做强制分享。 */
  toFriend(options: ShareOptions): boolean {
    if (!this.available) {
      return false;
    }
    wx.shareAppMessage({ title: options.title, imageUrl: options.imageUrl, query: options.query });
    return true;
  }
}

export const Share = new ShareClient();
