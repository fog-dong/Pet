// STATUS: implemented, W16 P0 常驻淡入淡出层（persist Canvas + 独立相机），goState 转场不再黑闪
import {
  BlockInputEvents,
  Camera,
  Canvas,
  Color,
  director,
  Graphics,
  Layers,
  Node,
  Tween,
  tween,
  UIOpacity,
  UITransform,
} from 'cc';
import { Quality } from '../config/Quality';
import { DURATION } from '../ui/Tokens';

let root: Node | null = null;
let opacity: UIOpacity | null = null;
let blocking: BlockInputEvents | null = null;
let broken = false;
let busy = false;

/** Boot 启动时调一次：先建常驻层，后面每次切场景都只是淡入淡出。 */
export function prepareFade(): void {
  ensureRoot();
  setOpacity(0, false);
}

export function fadeToScene(sceneName: string): Promise<boolean> {
  if (!sceneName) {
    return Promise.resolve(false);
  }
  if (broken || busy || !ensureRoot()) {
    return loadDirect(sceneName);
  }
  const out = Quality.low ? 0 : DURATION.fadeOut;
  return fadeOut(out)
    .then(() => loadDirect(sceneName))
    .then((ok) => fadeIn(Quality.low ? 0.15 : DURATION.fadeIn).then(() => ok));
}

function loadDirect(sceneName: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const launched = director.loadScene(sceneName, (error) => resolve(!error));
    if (!launched) {
      resolve(false);
    }
  });
}

function fadeOut(duration: number): Promise<void> {
  return new Promise<void>((resolve) => {
    if (!opacity) {
      resolve();
      return;
    }
    busy = true;
    setOpacity(opacity.opacity, true);
    Tween.stopAllByTarget(opacity);
    tween(opacity).to(duration, { opacity: 255 }).call(() => resolve()).start();
  });
}

function fadeIn(duration: number): Promise<void> {
  return new Promise<void>((resolve) => {
    if (!opacity) {
      busy = false;
      resolve();
      return;
    }
    Tween.stopAllByTarget(opacity);
    // 新场景第一帧必须先全遮住，再淡出；否则切场景瞬间会闪一帧裸画面。
    opacity.opacity = 255;
    tween(opacity)
      .to(duration, { opacity: 0 })
      .call(() => {
        setOpacity(0, false);
        busy = false;
        resolve();
      })
      .start();
  });
}

function setOpacity(value: number, block: boolean): void {
  if (opacity) {
    opacity.opacity = value;
  }
  if (blocking) {
    blocking.enabled = block;
  }
}

function ensureRoot(): boolean {
  if (broken) {
    return false;
  }
  if (root && root.isValid && opacity && blocking) {
    return true;
  }
  const scene = director.getScene();
  if (!scene) {
    return false;
  }
  try {
    const node = new Node('PageFadeRoot');
    scene.addChild(node);
    director.addPersistRootNode(node);
    const canvas = node.addComponent(Canvas);
    const camNode = new Node('PageFadeCamera');
    camNode.parent = node;
    camNode.setPosition(0, 0, 1000);
    const camera = camNode.addComponent(Camera);
    camera.projection = Camera.ProjectionType.ORTHO;
    camera.orthoHeight = 640;
    camera.near = 0.1;
    camera.far = 2000;
    camera.clearFlags = Camera.ClearFlag.DEPTH_ONLY;
    camera.priority = 100;
    // 独立图层 + 只渲染这一层：否则这台相机也会把主 Canvas 的 UI 再画一遍，
    // 两个不同 orthoHeight 的副本叠在一起，按钮/装饰会错位重叠。
    camera.visibility = Layers.Enum.UI_3D;
    canvas.cameraComponent = camera;
    canvas.alignCanvasWithScreen = true;
    const quad = new Node('FadeQuad');
    quad.layer = Layers.Enum.UI_3D;
    quad.parent = node;
    quad.addComponent(UITransform).setContentSize(2400, 2400);
    const graphics = quad.addComponent(Graphics);
    graphics.fillColor = new Color(26, 20, 16, 255);
    graphics.rect(-1200, -1200, 2400, 2400);
    graphics.fill();
    const uiOpacity = quad.addComponent(UIOpacity);
    uiOpacity.opacity = 0;
    const block = quad.addComponent(BlockInputEvents);
    block.enabled = false;
    root = node;
    opacity = uiOpacity;
    blocking = block;
    return true;
  } catch {
    broken = true;
    return false;
  }
}
