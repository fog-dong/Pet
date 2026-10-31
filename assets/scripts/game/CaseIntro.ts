// STATUS: implemented, W9-5 病例介绍页（含医疗虚构免责固定句）；W16 P1 诊室场景 + 软垫 + 纸卡 + 彩色分诊 chip
import { _decorator, Color, Component, Node } from 'cc';
import { CaseConfig } from '../config/CaseConfig';
import { CharacterConfig } from '../config/CharacterConfig';
import { COPY } from '../config/CopyText';
import { MEDICAL_DISCLAIMER_TEXT } from '../config/LegalConfig';
import { CaseSession } from './CaseSession';
import { CharacterView } from './CharacterView';
import { GameState } from '../core/GameFSM';
import { goState } from '../core/SceneFlow';
import { fadeToScene } from '../core/PageFade';
import { mountBackButton } from '../ui/BackButton';
import { addDecor, mountBackdrop } from '../ui/Backdrop';
import { addCard, addPill } from '../ui/PanelKit';
import { addButton, addLabel, PALETTE } from '../ui/SceneUI';
import { fitWidth } from '../ui/ScreenMetrics';
import { paintSceneBackground } from '../ui/ScreenTheme';
import { COLORS } from '../ui/Tokens';

const { ccclass } = _decorator;

const SEVERITY_TEXT: Record<string, string> = {
  normal: '普通',
  urgent: '紧急',
  critical: '危重',
};

const SEVERITY_COLOR: Record<string, Color> = {
  normal: COLORS.sage,
  urgent: COLORS.clay,
  critical: COLORS.danger,
};

const CUSHION_Y = 170;
const PET_Y = 282;

@ccclass('CaseIntro')
export class CaseIntro extends Component {
  protected start(): void {
    // 「换一例」直接重进本场景，不经过 SceneFlow，这里补一次底色。
    paintSceneBackground();
    const item = CaseSession.current;
    if (!item) {
      void goState(GameState.Lobby, 'Lobby');
      return;
    }

    const root = this.node;
    mountBackdrop(root, 'room');
    mountBackButton(root, () => {
      void goState(GameState.Lobby, 'Lobby');
    });
    addLabel(root, 'PageTitle', '接 诊', 548, { size: 44 });
    addLabel(root, 'PetName', `${item.petName}（${item.breed}）`, 486, { size: 34 });
    // 宠物坐在软垫上：软垫先挂，宠物后挂，脚底压住垫子上沿。
    this.mountSeverity(root, item.severity);
    addDecor(root, 'ui_cushion', CUSHION_Y, 320);
    this.mountPet(item.petId);
    this.mountStoryCard(root, item.story, item.symptoms);
    // 医疗虚构免责固定句：每个病例都会经过这一屏，文案只在 LegalConfig 维护。
    addLabel(root, 'MedicalNotice', MEDICAL_DISCLAIMER_TEXT, -556, {
      size: 18,
      color: PALETTE.sub,
      width: fitWidth(620, 50),
    });
    addButton(root, 'AcceptButton', COPY.caseIntroStart, -284, () => {
      void goState(GameState.Diagnosis, 'Diagnosis');
    }, PALETTE.primary, 440, 88);
    addButton(
      root,
      'SwapButton',
      '换一例',
      -378,
      () => {
        const next = CaseConfig.random(item.caseId);
        if (!next) {
          return;
        }
        CaseSession.start(next);
        void fadeToScene('CaseIntro');
      },
      PALETTE.secondary,
      440,
      80,
    );
  }

  /** 分诊等级改成彩色 chip：普通=鼠尾草、紧急=陶土、危重=低饱和暖红。 */
  private mountSeverity(parent: Node, severity: string): void {
    const color = SEVERITY_COLOR[severity] ?? COLORS.sage;
    const chip = addPill(parent, 'SeverityChip', 428, 240, 54, color);
    addLabel(chip, 'SeverityLabel', `分诊等级 · ${SEVERITY_TEXT[severity] ?? severity}`, 0, {
      size: 24,
      width: 220,
      color: COLORS.white,
    });
  }

  /** 故事与症状收进一张纸卡，不再散在页面上。 */
  private mountStoryCard(parent: Node, story: string, symptoms: readonly string[]): void {
    const card = addCard(parent, 'StoryCard', -110, 620, 240);
    addLabel(card, 'StoryTitle', '病情记录', 92, { size: 22, color: PALETTE.sub });
    addLabel(card, 'Story', story, 16, {
      size: 24,
      width: 560,
      color: COLORS.ink,
    });
    addLabel(card, 'Symptoms', `症状：${symptoms.join(' · ')}`, -80, {
      size: 22,
      color: PALETTE.sub,
      width: 560,
    });
  }

  private mountPet(petId: string): void {
    const view = CharacterView.mount(this.node, 0, PET_Y, 220);
    view.showPet(petId, 'sick');
    // 标题行已写宠物名，分诊 chip 已写等级，立绘角标再画一遍就叠字了。
    view.hideBadges();
    // 配置没就绪时先画兜底色块，加载完再重绘，别让进页有一段时间没有宠物。
    if (!CharacterConfig.ready) {
      void CharacterConfig.load().then(() => {
        if (this.isValid) {
          view.showPet(petId, 'sick');
        }
      });
    }
  }
}
