// Tiny finite-state machine for game phases. Transitions are immutable —
// `transition()` returns a new FSM object.

export const TRANSITIONS = {
  loading: ['menu'],
  menu: ['calibrating', 'flying'], // keyboard players can start directly
  calibrating: ['flying', 'menu'],
  flying: ['paused', 'menu'],
  paused: ['flying', 'menu'],
};

export function createFSM(opts = {}) {
  return {
    state: 'loading',
    history: [],
    now: opts.now ?? (() => Date.now()),
  };
}

export function transition(fsm, to) {
  const allowed = TRANSITIONS[fsm.state];
  if (!allowed || !allowed.includes(to)) {
    throw new Error(`Invalid transition: ${fsm.state} -> ${to}`);
  }
  const history = fsm.history.concat([{ from: fsm.state, to, at: fsm.now() }]).slice(-50);
  return { state: to, history, now: fsm.now };
}
