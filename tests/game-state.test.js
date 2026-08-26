import { describe, it, expect } from 'vitest';
import { createFSM, transition, TRANSITIONS } from '../src/core/game-state.js';

describe('game state machine', () => {
  it('starts in loading and boots to menu then flying', () => {
    let fsm = createFSM();
    expect(fsm.state).toBe('loading');
    fsm = transition(fsm, 'menu');
    fsm = transition(fsm, 'calibrating');
    fsm = transition(fsm, 'flying');
    expect(fsm.state).toBe('flying');
  });

  it('supports pause/resume and quitting to menu from both', () => {
    let fsm = transition(createFSM(), 'menu');
    fsm = transition(fsm, 'flying');       // keyboard direct start
    fsm = transition(fsm, 'paused');
    fsm = transition(fsm, 'flying');
    fsm = transition(fsm, 'paused');
    fsm = transition(fsm, 'menu');
    expect(fsm.state).toBe('menu');
  });

  it('throws on invalid transitions', () => {
    const fsm = createFSM(); // loading
    expect(() => transition(fsm, 'flying')).toThrow();
    expect(() => transition(fsm, 'paused')).toThrow();
  });

  it('records history with timestamps', () => {
    let fsm = createFSM({ now: () => 1234 });
    fsm = transition(fsm, 'menu');
    expect(fsm.history).toHaveLength(1);
    expect(fsm.history[0].to).toBe('menu');
    expect(fsm.history[0].at).toBe(1234);
  });

  it('every declared transition source exists as a known state', () => {
    const states = new Set(['loading', 'menu', 'calibrating', 'flying', 'paused']);
    for (const [from, targets] of Object.entries(TRANSITIONS)) {
      expect(states.has(from)).toBe(true);
      for (const to of targets) expect(states.has(to)).toBe(true);
    }
  });
});
