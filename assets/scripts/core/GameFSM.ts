// STATUS: implemented, W3 状态机（白名单 + 每次流转记日志）
// API: GameFSM whitelist, see docs/plan/08-客户端架构与状态机.md §5
import { Track } from '../track/Track';

export enum GameState {
  Boot = 'Boot',
  Login = 'Login',
  Lobby = 'Lobby',
  CaseIntro = 'CaseIntro',
  Diagnosis = 'Diagnosis',
  Treatment = 'Treatment',
  Recovery = 'Recovery',
  Adoption = 'Adoption',
  Result = 'Result',
  Offline = 'Offline',
  Fatal = 'Fatal',
}

export type StateHook = (from: GameState, to: GameState) => void | Promise<void>;
export type ChangeListener = (from: GameState, to: GameState) => void;

export const FSM_WHITELIST: Readonly<Record<GameState, readonly GameState[]>> = {
  [GameState.Boot]: [GameState.Login, GameState.Fatal],
  [GameState.Login]: [GameState.Lobby, GameState.Offline, GameState.Fatal],
  [GameState.Lobby]: [GameState.CaseIntro, GameState.Adoption, GameState.Offline],
  [GameState.CaseIntro]: [GameState.Diagnosis, GameState.Lobby],
  [GameState.Diagnosis]: [GameState.Treatment, GameState.Diagnosis, GameState.Result],
  [GameState.Treatment]: [GameState.Recovery, GameState.Treatment, GameState.Result],
  [GameState.Recovery]: [GameState.Adoption, GameState.Result],
  [GameState.Adoption]: [GameState.Result, GameState.Recovery, GameState.Lobby],
  [GameState.Result]: [GameState.Lobby, GameState.CaseIntro],
  [GameState.Offline]: [GameState.Login, GameState.Lobby],
  [GameState.Fatal]: [],
};

export class GameFSM {
  private current: GameState = GameState.Boot;
  private switching = false;
  private readonly enterHooks = new Map<GameState, StateHook[]>();
  private readonly exitHooks = new Map<GameState, StateHook[]>();
  private readonly listeners: ChangeListener[] = [];

  get state(): GameState {
    return this.current;
  }

  canTransition(next: GameState): boolean {
    if (next === this.current) {
      return false;
    }
    return FSM_WHITELIST[this.current].includes(next);
  }

  onEnter(state: GameState, hook: StateHook): void {
    const hooks = this.enterHooks.get(state) ?? [];
    hooks.push(hook);
    this.enterHooks.set(state, hooks);
  }

  onExit(state: GameState, hook: StateHook): void {
    const hooks = this.exitHooks.get(state) ?? [];
    hooks.push(hook);
    this.exitHooks.set(state, hooks);
  }

  onChange(listener: ChangeListener): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) {
        this.listeners.splice(index, 1);
      }
    };
  }

  async transition(next: GameState): Promise<boolean> {
    if (this.switching) {
      Track.track('fsm_transition_ignored', { from: this.current, to: next, reason: 'switching' });
      return false;
    }
    if (!this.canTransition(next)) {
      Track.track('fsm_transition_blocked', { from: this.current, to: next });
      return false;
    }
    this.switching = true;
    const from = this.current;
    try {
      await this.runHooks(this.exitHooks.get(from), from, next);
      await this.runHooks(this.enterHooks.get(next), from, next);
      this.current = next;
      Track.track('fsm_transition', { from, to: next });
      for (const listener of this.listeners) {
        listener(from, next);
      }
      return true;
    } finally {
      this.switching = false;
    }
  }

  private async runHooks(
    hooks: StateHook[] | undefined,
    from: GameState,
    to: GameState,
  ): Promise<void> {
    if (!hooks) {
      return;
    }
    for (const hook of hooks) {
      await hook(from, to);
    }
  }
}

export const gameFSM = new GameFSM();
