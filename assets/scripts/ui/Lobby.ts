// STATUS: implemented, W26 P2-E 大厅装配（场景层交给 LobbyScene，底部 TAB 与内容坞交给 LobbyBottom，次级入口仍由 LobbyMenu 分派）
import { _decorator, Button, Component, Label, Node } from 'cc';
import { PrivacyState } from '../cache/PrivacyState';
import { Save } from '../cache/Save';
import { CharacterConfig } from '../config/CharacterConfig';
import { CONFIG_BUNDLE } from '../config/ConfigLoader';
import { PRIVACY_GUEST_TEXT } from '../config/LegalConfig';
import { refreshQuality } from '../core/BootCloud';
import { Res } from '../core/Res';
import { CharacterView } from '../game/CharacterView';
import { habitatList } from '../game/HabitatModel';
import { Profile } from '../net/Profile';
import { Track } from '../track/Track';
import { HudHandle } from './LobbyChrome';
import { openAchievementPanel } from './AchievementPanel';
import { setEarnJumpHandler } from './EarnGuide';
import type { LobbyTab } from './LobbyTabs';
import { LobbyAchievementsHandle, mountLobbyAchievements } from './LobbyAchievements';
import { LobbyBottomHandle, mountLobbyBottom } from './LobbyBottom';
import { LobbyMenuHost, openLobbyMenu } from './LobbyMenu';
import { openGachaFromLobby } from './LobbyStart';
import { lobbyDoctorSize, lobbyDoctorY } from './LobbyDockLayout';
import { LobbyHint } from './LobbyHint';
import { mountLobbyScene } from './LobbyScene';
import type { PetBandHandle } from './LobbyPetRow';
import { LeaderboardPanel } from './LeaderboardPanel';
import { SyncBadge } from './SyncBadge';

const { ccclass, property } = _decorator;

/** 红点定时：后院成熟与送养到点最短也是分钟级，30 秒一档足够亮得及时，又不值得为它开一条事件总线。 */
const ALERT_TICK_SEC = 30;

@ccclass('Lobby')
export class Lobby extends Component {
  @property(Label) coinsLabel: Label | null = null;
  @property(Label) heartsLabel: Label | null = null;
  @property(Button) startButton: Button | null = null;

  private hint: LobbyHint | null = null;
  private hud: HudHandle | null = null;
  private band: PetBandHandle | null = null;
  private dock: LobbyBottomHandle | null = null;
  private doctorSlot: Node | null = null;
  private achievements: LobbyAchievementsHandle | null = null;
  private readonly leaderboard = new LeaderboardPanel();
  private readonly syncBadge = new SyncBadge();

  protected start(): void {
    Save.load();
    // 资源不足指引条的落点：金币/爱心面板只管说「送到哪一格」，真跳转由大厅负责（成就直接开面板，少一次点击）。
    setEarnJumpHandler((tab) => this.goEarnTab(tab));
    this.hint = new LobbyHint(this.node);
    const scene = mountLobbyScene(this.node, (petId) => this.onMenuClick('HabitatButton', petId));
    this.doctorSlot = scene.doctorSlot;
    this.hud = scene.hud;
    this.band = scene.band;
    this.dock = mountLobbyBottom(this.node, {
      host: this.node,
      startButton: this.startButton,
      menu: (name, focusPetId) => this.onMenuClick(name, focusPetId),
      changed: () => this.refreshStats(),
    });
    this.achievements = mountLobbyAchievements(this.node, () => this.refreshStats());
    // 成就角标是后挂的，会把合规链压到下层：装配完再把它提回最顶（P2-E 模块二）。
    this.dock.raiseLinks();
    // 后院成熟与送养到点是墙钟事件：人停在大厅不动也得亮，所以定时只重画坞与红点，不重建散步带。
    this.schedule(this.tickDock, ALERT_TICK_SEC);
    this.hideLegacyStats();
    this.refreshStats();
    this.achievements.check();
    if (PrivacyState.isGuest()) {
      // 游客：不拉云资料、不碰排行榜，本地单局照常。
      Track.track('lobby_guest_mode');
      this.showHint(PRIVACY_GUEST_TEXT);
    } else {
      void Profile.refresh();
      void refreshQuality();
      // 进厅补发一次待同步结算（配置晚发布时金币延迟到账，这里给玩家一个可见提示）。
      this.syncBadge.mount(this.node);
      void this.syncBadge.drain();
    }
    void Track.flush();
    void Res.loadBundle(CONFIG_BUNDLE)
      .then(() => CharacterConfig.load())
      .then(() => {
        if (this.isValid && this.doctorSlot) {
          // 名字与心情角标在大厅没有信息量（角标还会压到主按钮上），统一关掉。
          // 医生站在前台后头，下半身被柜面切掉，地面阴影只会在台沿上留一块灰，索性不画。
          const doctor = CharacterView.mount(this.doctorSlot, 0, lobbyDoctorY(), lobbyDoctorSize(), false);
          doctor.showDoctor('doc_director');
          doctor.hideBadges();
        }
        // 角色表到位后再排散步带：品种属性要靠 pets.json 补齐，早于它就刷会按默认值落档。
        this.refreshBand();
      });
  }

  protected onDestroy(): void {
    setEarnJumpHandler(null);
    Res.release(CONFIG_BUNDLE);
  }

  protected onEnable(): void {
    this.startButton?.node.on(Button.EventType.CLICK, this.onStartClick, this);
  }

  protected onDisable(): void {
    this.startButton?.node.off(Button.EventType.CLICK, this.onStartClick, this);
  }

  private hideLegacyStats(): void {
    if (this.coinsLabel) {
      this.coinsLabel.node.active = false;
    }
    if (this.heartsLabel) {
      this.heartsLabel.node.active = false;
    }
  }

  private onMenuClick(name: string, focusPetId?: string): void {
    const host: LobbyMenuHost = {
      node: this.node,
      isValid: this.isValid,
      leaderboard: this.leaderboard,
      syncBadge: this.syncBadge,
      showHint: (text) => this.showHint(text),
      refreshStats: () => this.refreshStats(),
      checkMilestones: () => this.achievements?.check(),
    };
    openLobbyMenu(name, host, focusPetId);
  }

  refreshStats(): void {
    this.hud?.set(Save.coins, Save.hearts);
    this.dock?.refresh();
    this.refreshBand();
    this.achievements?.refresh();
  }

  /** 定时只做「重画读数 + 重算红点」，散步带不重建：玩家站着不动也能看见后院熟了、送养到点了。 */
  private tickDock(): void {
    this.dock?.refresh();
  }

  /** 指引条的落点：成就谱是可领即时到账，直接开面板；其余三格切到对应 TAB 就够玩家看见下一步。 */
  private goEarnTab(tab: LobbyTab): void {
    if (tab === 'achieve') {
      openAchievementPanel(this.node, () => this.refreshStats());
      return;
    }
    this.dock?.show(tab);
  }

  /** 散步带的重建判定在 LobbyPetRow 内部（人没变就跳过），这里只负责拿最新列表。 */
  private refreshBand(): void {
    if (this.band && CharacterConfig.ready) {
      this.band.refresh(habitatList());
    }
  }

  private onStartClick(): void {
    openGachaFromLobby(this.node, this);
  }

  /** 常驻提示交给玩家看的，只放一层，避免多句叠字。 */
  showHint(text: string): void {
    this.hint?.show(text);
  }
}
