// STATUS: implemented, W32-1 大厅房间层：窗 + 暖光柱 + 走时挂钟 + 光尘，把 logo 与前台之间的空墙变成「活着的房间」
// 挂钟指针按真实时间起转，光柱与光尘常驻缓慢呼吸；低画质只保留静态构图，省掉所有 tween。
import { Color, Graphics, Node, UIOpacity, Vec3, tween } from 'cc';
import { Quality } from '../config/Quality';
import { lobbyDeskEdgeY, lobbyRoomH } from './LobbyDockLayout';
import { paintBeam, paintClockFace, paintHand, paintWindow } from './LobbyRoomArt';
import { screenWidth } from './ScreenMetrics';
import { createNode } from './SceneUI';

/** 窗压左墙、钟挂右墙，都要让开中间的医生与两侧绿植：窗底与钟底都落在绿植顶沿之上。 */
const WIN_W_RATIO = 0.8;
const WIN_H_RATIO = 0.78;
const WIN_Y_RATIO = 0.6;
const CLOCK_Y_RATIO = 0.66;
const SIDE_MARGIN = 32;
const BEAM_W_RATIO = 1.1;
const BEAM_H_RATIO = 0.72;
/** 光柱 3.4s 一呼一吸：比宠物呼吸慢一档，才不会和立绘抢节奏。 */
const BEAM_BREATH = 3.4;
const DUST_STEP = 4.6;
const DUST = [
  { x: -0.28, y: 0.16, delay: 0 },
  { x: -0.02, y: -0.12, delay: 1.1 },
  { x: 0.22, y: 0.3, delay: 2.2 },
  { x: 0.1, y: -0.34, delay: 3.2 },
];

function clamp(min: number, value: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function mountLobbyRoom(backdrop: Node): void {
  const h = lobbyRoomH();
  const base = lobbyDeskEdgeY();
  const half = screenWidth() / 2;
  const winW = clamp(120, h * WIN_W_RATIO, 176);
  const winH = winW * WIN_H_RATIO;
  const winX = -half + SIDE_MARGIN + winW / 2;
  const winY = base + h * WIN_Y_RATIO;
  const win = createNode(backdrop, 'LobbyWindow', winY, winW, winH);
  win.setPosition(winX, winY, 0);
  paintWindow(win, winW, winH);

  const radius = clamp(34, h * 0.21, 46);
  const clockX = half - SIDE_MARGIN - radius;
  const clockY = base + h * CLOCK_Y_RATIO;
  const clock = createNode(backdrop, 'LobbyClock', clockY, radius * 2, radius * 2);
  clock.setPosition(clockX, clockY, 0);
  paintClockFace(clock, radius);
  mountHands(clock, radius);

  const beamW = clamp(150, winW * BEAM_W_RATIO, 220);
  const beamH = clamp(120, h * BEAM_H_RATIO, 220);
  const beamY = winY - winH / 2 - beamH / 2;
  const beamX = winX + winW / 2 - beamW * 0.32;
  const beam = createNode(backdrop, 'LobbyWindowLight', beamY, beamW, beamH);
  beam.setPosition(beamX, beamY, 0);
  paintBeam(beam, beamW, beamH);
  const beamFade = beam.addComponent(UIOpacity);
  beamFade.opacity = 70;
  if (Quality.low) {
    return;
  }
  tween(beamFade).to(BEAM_BREATH, { opacity: 46 }).to(BEAM_BREATH, { opacity: 76 })
    .union().repeatForever().start();
  mountDust(backdrop, beamX, beamY, beamW);
}

/** 三根指针各自按真实时间起转：秒针 6°/s、分针 6°/min、时针 30°/h，都由 node.angle 负向累加。 */
function mountHands(clock: Node, r: number): void {
  const now = new Date();
  const sec = now.getSeconds();
  const min = now.getMinutes() + sec / 60;
  const hour = (now.getHours() % 12) + min / 60;
  const second = hand(clock, 'LobbyClockSecond', r * 0.74, 2, 170);
  const minute = hand(clock, 'LobbyClockMinute', r * 0.6, 4, 235);
  const hours = hand(clock, 'LobbyClockHour', r * 0.42, 6, 255);
  second.angle = -sec * 6;
  minute.angle = -min * 6;
  hours.angle = -hour * 30;
  if (Quality.low) {
    return;
  }
  tween(second).by(1, { angle: -6 }).repeatForever().start();
  tween(minute).by(60, { angle: -6 }).repeatForever().start();
  tween(hours).by(3600, { angle: -30 }).repeatForever().start();
}

function hand(parent: Node, name: string, length: number, width: number, alpha: number): Node {
  const node = new Node(name);
  node.parent = parent;
  paintHand(node, length, width, alpha);
  return node;
}

/** 光柱里 4 颗微尘：向上飘一小段就回到起点重来，透明度同步一明一灭。 */
function mountDust(parent: Node, beamX: number, beamY: number, beamW: number): void {
  DUST.forEach((item, index) => {
    const node = createNode(parent, `LobbyDust_${index}`, 0, 10, 10);
    const home = new Vec3(beamX + beamW * item.x, beamY + 46 + beamW * item.y, 0);
    node.setPosition(home.x, home.y, 0);
    const graphics = node.addComponent(Graphics);
    graphics.fillColor = new Color(255, 255, 255, 170);
    graphics.circle(0, 0, 3.2);
    graphics.fill();
    const opacity = node.addComponent(UIOpacity);
    opacity.opacity = 0;
    tween(opacity).delay(item.delay).to(DUST_STEP * 0.4, { opacity: 150 })
      .to(DUST_STEP * 0.6, { opacity: 0 }).union().repeatForever().start();
    tween(node).delay(item.delay).by(DUST_STEP, { position: new Vec3(14, 52, 0) })
      .call(() => node.setPosition(home.x, home.y, 0)).repeatForever().start();
  });
}
