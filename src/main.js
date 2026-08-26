// ZEPHYR — main orchestrator. Wires core logic (pure, tested) to adapters
// (renderer, input, audio, HUD) through the game-loop.
import * as THREE from 'three';
import { generateWorld, makeTerrainSampler, WORLD_SIZE } from './core/world-gen.js';
import { createFlightState, stepFlight, SPEED_LIMITS } from './core/physics.js';
import { createMotionMapper } from './core/motion-mapper.js';
import { evaluateFrame } from './core/collisions.js';
import { createScore, onRingPassed, tickScore, multiplier } from './core/scoring.js';
import { createFSM, transition } from './core/game-state.js';
import { mulberry32 } from './core/rng.js';

import { createRenderer, buildScene } from './render/scene-builder.js';
import { buildTerrain } from './render/terrain.js';
import { buildBird, animateBird, pushTrail, resetTrail } from './render/bird.js';
import { buildRings, updateRingVisuals, markRingPassed, buildPillars, buildIslands } from './render/rings.js';
import { buildClouds, updateClouds } from './render/clouds.js';
import { buildVegetation, buildFlocks, updateFlocks } from './render/vegetation.js';
import { buildOcean, updateOcean, buildMotes, updateMotes, buildMegaIslands } from './render/environment.js';
import { buildRealmTrees } from './render/realm-trees.js';
import {
  buildGreatTree, updateGreatTree,
  buildIceSpires,
  buildObelisks, updateObelisks,
  buildRealmAmbience, updateRealmAmbience,
} from './render/realm-landmarks.js';
import {
  buildSkyMantas, updateSkyMantas,
  buildWaterfalls, updateWaterfalls,
  buildBalloons, updateBalloons,
  buildCrystals, updateCrystals,
  buildTemples, updateTemples,
  buildRainbow,
} from './render/landmarks.js';
import { mulberry32 as _mr } from './core/rng.js';
import { Hud } from './render/hud.js';
import { PoseTracker } from './input/pose-tracker.js';
import { PoseVisionPanel } from './input/pose-panel.js';
import { KeyboardControls } from './input/keyboard-fallback.js';
import { SoundEngine } from './audio/sound-engine.js';

const $ = (id) => document.getElementById(id);
const show = (id) => $(id).classList.remove('hidden');
const hide = (id) => $(id).classList.add('hidden');
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

class Game {
  constructor() {
    this.fsm = createFSM();
    this.hud = new Hud();
    this.keys = new KeyboardControls();
    this.sound = new SoundEngine();
    this.motionMapper = createMotionMapper();
    this.poseTracker = null;
    this.lastMotion = { roll: 0, pitch: 0, flap: 0, t: -1e9 };
    this.neutral = { roll: 0, pitch: 0 };
    this.muted = false;
    this.seed = Math.floor(Math.random() * 1e9);
    this.stats = { rings: 0, bestCombo: 0, topSpeed: 0, maxAlt: 0 };
    this._flapWhooshAt = -9;
    this._lastT = performance.now() / 1000;
    this.simTime = 0; // simulated seconds (excludes render stalls)
  }

  setState(to) {
    this.fsm = transition(this.fsm, to);
    window.__zephyrState = to;
  }

  // ---------- world / scene ----------
  buildWorld(seed) {
    this.seed = seed;
    this.world = generateWorld(seed);
    this.world._sampler = makeTerrainSampler(this.world);
    $('seed-line').textContent = `world seed ${seed}`;

    this.scene = new THREE.Scene();
    buildScene(this.scene);
    buildTerrain(this.scene, this.world._sampler, this.world.noiseSeed);
    this.ringObjects = buildRings(this.scene, this.world);
    buildPillars(this.scene, this.world);
    buildIslands(this.scene, this.world, mulberry32(seed ^ 0x5f3759df));
    this.clouds = buildClouds(this.scene, this.world);
    buildVegetation(this.scene, this.world._sampler, seed);
    this.flocks = buildFlocks(this.scene, this.world, mulberry32(seed ^ 0x68e31da4));
    buildRealmTrees(this.scene, this.world._sampler, seed);
    this.ocean = buildOcean(this.scene);
    buildMegaIslands(this.scene, seed);
    this.motes = buildMotes(this.scene, seed);

    // Six Realms landmarks + ambience
    const lmRand = _mr(seed ^ 0x0dd11e5);
    this.mantas = buildSkyMantas(this.scene, lmRand);
    this.waterfalls = buildWaterfalls(this.scene, this.world, lmRand);
    this.balloons = buildBalloons(this.scene, lmRand);
    this.crystals = buildCrystals(this.scene, this.world, lmRand);
    this.temples = buildTemples(this.scene, this.world, lmRand);
    buildRainbow(this.scene);
    this.greatTree = buildGreatTree(this.scene);
    buildIceSpires(this.scene, this.world._sampler, seed);
    this.ruins = buildObelisks(this.scene, this.world._sampler, seed);
    this.realmAmbience = buildRealmAmbience(this.scene);

    this.bird = buildBird(this.scene);

    this.flight = createFlightState([this.world.spawn.x, this.world.spawn.y, this.world.spawn.z], this.world.spawn.heading);
    this.score = createScore();
    this.prevPos = [...this.flight.pos];
    this.camera = new THREE.PerspectiveCamera(66, window.innerWidth / window.innerHeight, 0.1, 12000);
    this.snapCameraBehindBird();
  }

  snapCameraBehindBird() {
    const fwd = fwdVec(this.flight);
    this.camera.position.set(
      this.flight.pos[0] - fwd[0] * 16,
      this.flight.pos[1] + 6,
      this.flight.pos[2] - fwd[2] * 16,
    );
    this.camera.lookAt(this.flight.pos[0], this.flight.pos[1], this.flight.pos[2]);
  }

  // ---------- flow ----------
  async startMotionFlow() {
    this.sound.ensure();
    try {
      if (!this.poseTracker) {
        $('loading-text').textContent = 'Waking the wind senses…';
        show('overlay-loading');
        this.poseTracker = new PoseTracker(
          (lms, t) => this.onPose(lms, t),
          (s) => this.onPoseStatus(s),
        );
        await this.poseTracker.init();
      }
      hide('overlay-loading');
      hide('overlay-menu');
      if (!this.posePanel) {
        this.posePanel = new PoseVisionPanel($('cam-video'));
        window.addEventListener('resize', () => this.posePanel.resize());
      }
      this.posePanel.resize();
      await this.poseTracker.start($('cam-video'));
      this.beginCalibration();
    } catch (err) {
      console.warn('Motion setup failed, using keyboard:', err);
      hide('overlay-loading');
      this.startKeyboard();
    }
  }

  beginCalibration() {
    this.setState('calibrating');
    show('overlay-calibrate');
    const cdEl = $('cal-countdown');
    const pill = $('cal-track');
    let count = 3;
    let samples = [];
    cdEl.textContent = count;
    this._calTimer = setInterval(() => {
      const trackedRecently = performance.now() / 1000 - this.lastMotion.t < 0.4;
      pill.textContent = trackedRecently ? '✓ You are visible — hold still…' : 'Searching for you… step back a little';
      pill.className = `track-pill ${trackedRecently ? 'ok' : 'searching'}`;
      count -= 1;
      if (count > 0) {
        cdEl.textContent = count;
      } else if (count === 0) {
        cdEl.textContent = 'GO!';
        // capture neutral posture from recent samples
        if (samples.length > 4) {
          this.neutral.roll = samples.reduce((a, s) => a + s.roll, 0) / samples.length;
          this.neutral.pitch = clamp(samples.reduce((a, s) => a + s.pitch, 0) / samples.length, -0.35, 0.35);
        } else {
          this.neutral = { roll: 0, pitch: 0 };
        }
      } else {
        clearInterval(this._calTimer);
        hide('overlay-calibrate');
        this.startFlying('motion');
      }
      samples = this._calSamples ?? samples;
      this._calSamples = [];
    }, 800);
  }

  cancelCalibration() {
    clearInterval(this._calTimer);
    hide('overlay-calibrate');
    if (this.poseTracker) this.poseTracker.stop();
    this.setState('menu');
    show('overlay-menu');
  }

  startKeyboard() {
    this.sound.ensure();
    this.keys.enabled = true;
    hide('overlay-menu');
    this.startFlying('keyboard');
  }

  startFlying(mode) {
    if (!this.sceneBuiltForState || true) {
      // world persists across pause/menu returns; rebuilt only on R
    }
    this.setState('flying');
    this.hud.show();
    this.hud.setMode(mode === 'motion' && this.poseTracker);
    this.hud.msg(mode === 'motion' ? 'FLY WITH YOUR BODY' : 'KEYBOARD FLIGHT', 'cyan');
  }

  pauseOrResume() {
    if (this.fsm.state === 'flying') {
      this.setState('paused');
      $('pause-stats').textContent =
        `score ${this.score.score.toLocaleString('en-US')} · rings ${this.score.rings} · best combo ×${this.score.bestCombo}`;
      show('overlay-pause');
    } else if (this.fsm.state === 'paused') {
      this.setState('flying');
      hide('overlay-pause');
    }
  }

  quitToMenu() {
    if (this.poseTracker) this.poseTracker.stop();
    this.setState('menu');
    hide('overlay-pause');
    this.hud.hide();
    show('overlay-menu');
  }

  regenerate() {
    // tear down old scene objects by dropping references; GC handles the rest
    hide('overlay-pause');
    this.hud.hide();
    show('overlay-loading');
    $('loading-text').textContent = 'Reshaping the wind…';
    setTimeout(() => {
      this.buildWorld(Math.floor(Math.random() * 1e9));
      hide('overlay-loading');
      if (this.fsm.state !== 'menu') {
        this.setState('menu');
        show('overlay-menu');
      }
      this.hud.msg('NEW WORLD', 'cyan');
    }, 30);
  }

  // ---------- pose ----------
  onPose(lms, t) {
    const out = this.motionMapper.update(lms, t);
    out.t = t;
    this.lastMotion = out;
    if (this.posePanel) this.posePanel.draw(lms, out, out.tracked);
    if (this.fsm.state === 'calibrating') {
      this._calSamples = this._calSamples ?? [];
      if (this._calSamples.length < 40) this._calSamples.push({ roll: out.roll, pitch: out.pitch });
    }
  }

  onPoseStatus(s) {
    const map = { ok: 'TRACKED', searching: 'SEARCHING', lost: 'NOBODY', error: 'CAMERA ERROR', init: 'LOADING MODEL' };
    $('cam-status').textContent = map[s] ?? s.toUpperCase();
    if ((s === 'ok' || s === 'searching') && this.posePanel) {
      requestAnimationFrame(() => this.posePanel.resize());
    }
  }

  currentControls(tSec) {
    const motionFresh = tSec - this.lastMotion.t < 0.7 && this.lastMotion.tracked;
    if (this.poseTracker && motionFresh) {
      return {
        targetRoll: clamp(this.lastMotion.roll - this.neutral.roll, -1, 1),
        targetPitch: clamp(this.lastMotion.pitch - this.neutral.pitch, -1, 1),
        flap: this.lastMotion.flap,
        source: 'motion',
      };
    }
    const kb = this.keys.getControls();
    return { ...kb, source: 'keyboard' };
  }

  // ---------- per-frame simulation ----------
  simulate(dt, tSec) {
    this.simTime += dt;
    const controls = this.currentControls(tSec);

    // sub-step for stability at low fps
    const steps = dt > 0.026 ? 2 : 1;
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      this.prevPos = [this.flight.pos[0], this.flight.pos[1], this.flight.pos[2]];
      stepFlight(this.flight, controls, h);
    }

    // flap whoosh on rising edge of meaningful flap power
    if (controls.flap > 0.45 && tSec - this._flapWhooshAt > 0.35) {
      this._flapWhooshAt = tSec;
      this.sound.whoosh(controls.flap);
    }

    // collisions & pickups
    const frame = evaluateFrame(this.prevPos, this.flight.pos, this.world, 1.6);
    for (const hit of frame.ringHits) {
      const ro = this.ringObjects.find((r) => r.data.id === hit.id);
      if (!ro || ro.passed) continue;
      markRingPassed(ro, tSec);
      const res = onRingPassed(this.score, { perfect: hit.perfect }, tSec);
      this.stats.rings = this.score.rings;
      this.stats.bestCombo = Math.max(this.stats.bestCombo, this.score.combo);
      this.sound.chime(res.combo, hit.perfect);
      this.hud.msg(hit.perfect ? `PERFECT +${res.gained}` : `+${res.gained}${res.combo >= 2 ? ` ×${res.mult.toFixed(2)}` : ''}`, 'gold');
    }
    const comboLost = tickScore(this.score, tSec);
    if (comboLost) {
      this.sound.comboLost();
      this.hud.msg(`combo lost (${this.score.rings} rings)`, 'red', 4000);
    }

    if (frame.pillarHit) {
      // bounce away from the pillar + bleed speed
      const dx = this.flight.pos[0] - frame.pillarHit.x;
      const dz = this.flight.pos[2] - frame.pillarHit.z;
      const d = Math.max(0.001, Math.hypot(dx, dz));
      this.flight.pos[0] = frame.pillarHit.x + (dx / d) * 8;
      this.flight.pos[2] = frame.pillarHit.z + (dz / d) * 8;
      this.flight.speed = Math.max(SPEED_LIMITS.min, this.flight.speed * 0.45);
      this.flight.heading += (dx / d) > 0 ? -0.35 : 0.35;
      if (tSec - (this._lastThudAt ?? -9) > 0.5) {
        this._lastThudAt = tSec;
        this.sound.thud();
        this.hud.flashDamage();
        this.hud.msg('OUCH — pillar!', 'red', 1500);
      }
    }

    if (frame.groundHit) {
      // climbing out: skim along the surface without penalty
      this.flight.pos[1] = frame.groundY + 3;
      this.flight.pitch = Math.max(this.flight.pitch, 0.25);
      // only bleed speed when we actually nose INTO the ground
      if (this.flight.pitch < 0.2 && this.flight.speed > SPEED_LIMITS.min * 1.4) {
        this.flight.speed = Math.max(SPEED_LIMITS.min, this.flight.speed * 0.9);
        if (tSec - (this._lastGroundMsgAt ?? -9) > 2) {
          this._lastGroundMsgAt = tSec;
          this.sound.thud();
          this.hud.flashDamage();
          this.hud.msg('pull up!', 'red', 1000);
        }
      }
    }

    // stats + milestones
    this.stats.topSpeed = Math.max(this.stats.topSpeed, this.flight.speed);
    const alt = this.flight.pos[1];
    this.stats.maxAlt = Math.max(this.stats.maxAlt, alt);
    if (alt > 500 && !this._highSoarShown) {
      this._highSoarShown = true;
      this.hud.msg('HIGH SOAR · 500m', 'cyan');
      this.sound.chime(5, true);
    }

    // boundary
    const distC = Math.hypot(this.flight.pos[0], this.flight.pos[2]);
    const nearEdge = distC > WORLD_SIZE * 0.46;
    this.hud.setWarn(nearEdge);
    if (distC > WORLD_SIZE * 0.495) {
      // gentle turn-back nudge
      const back = Math.atan2(-this.flight.pos[0], -this.flight.pos[2]);
      this.flight.heading += shortestAngle(back - this.flight.heading) * 0.02;
    }

    this.sound.setWind((this.flight.speed - SPEED_LIMITS.min) / (SPEED_LIMITS.max - SPEED_LIMITS.min));
    return controls.source;
  }

  updateCamera(dt) {
    const f = fwdVec(this.flight);
    const speedK = (this.flight.speed - SPEED_LIMITS.min) / (SPEED_LIMITS.max - SPEED_LIMITS.min);
    const back = 13 + speedK * 6;
    // ride lower behind the bird while it climbs so the bird stays framed
    // instead of sinking off the bottom of a sky-filled view
    const up = 4.6 + Math.abs(this.flight.roll) * 2.2 - Math.max(0, this.flight.pitch) * 2.6;

    const desired = new THREE.Vector3(
      this.flight.pos[0] - f[0] * back,
      this.flight.pos[1] + up,
      this.flight.pos[2] - f[2] * back,
    );
    // camera lags the bird for a sense of speed; heavier lerp when paused
    const k = this.fsm.state === 'flying' ? 1 - Math.exp(-dt * 5.5) : 1 - Math.exp(-dt * 2);
    this.camera.position.lerp(desired, k);

    const look = new THREE.Vector3(
      this.flight.pos[0] + f[0] * 18,
      this.flight.pos[1] + f[1] * 18,
      this.flight.pos[2] + f[2] * 18,
    );
    this.camera.lookAt(look);
    // tilt the horizon WITH the turn (negated roll, matching the bird's body)
    this.camera.rotation.z -= this.flight.roll * 0.28;

    const fov = 64 + speedK * 12;
    if (Math.abs(this.camera.fov - fov) > 0.2) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }

  // Big on-screen label of the command your body (or keys) is sending right
  // now — so "doing" vs "not doing" is impossible to miss.
  updateActionBanner(controls) {
    const el = $('action-banner');
    if (!el) return;
    let label = null;
    let cls = null;
    if (controls.flap > 0.35) { label = '✦ FLAP ✦'; cls = 'flap'; }
    else if (controls.targetRoll < -0.28) { label = '◀ LEFT'; cls = 'left'; }
    else if (controls.targetRoll > 0.28) { label = 'RIGHT ▶'; cls = 'right'; }
    else if (controls.targetPitch > 0.35) { label = '▲ CLIMB'; cls = 'up'; }
    else if (controls.targetPitch < -0.35) { label = '▼ DIVE'; cls = 'down'; }
    if (label && this.fsm.state === 'flying') {
      el.textContent = label;
      el.className = cls;
    } else {
      el.className = 'hidden';
    }
  }

  nearestOpenRing(maxDist = 700) {
    let best = null;
    let bestD = maxDist;
    for (const ro of this.ringObjects) {
      if (ro.passed) continue;
      const d = this.camera.position.distanceTo(ro.mesh.position);
      if (d < bestD) {
        bestD = d;
        best = ro;
      }
    }
    return best;
  }

  frame() {
    const now = performance.now() / 1000;
    let dt = Math.min(0.05, now - this._lastT);
    this._lastT = now;

    if (this.fsm.state === 'flying') {
      this.simulate(dt, now);
    }
    this.updateCamera(dt);
    animateBird(this.bird, this.flight, this.currentControls(now).flap, now, this.flight.roll);

    // wingtip trails (reset when we teleport / respawn)
    if (!this._trailRef) this._trailRef = this.bird.group.position.clone();
    const tipR = new THREE.Vector3();
    const tipL = new THREE.Vector3();
    this.bird.tipR.getWorldPosition(tipR);
    this.bird.tipL.getWorldPosition(tipL);
    if (this._trailRef.distanceToSquared(this.bird.group.position) > 900) {
      resetTrail(this.bird.trailR, tipR);
      resetTrail(this.bird.trailL, tipL);
      this._trailRef.copy(this.bird.group.position);
    } else {
      pushTrail(this.bird.trailR, tipR);
      pushTrail(this.bird.trailL, tipL);
    }

    updateRingVisuals(this.ringObjects, now, this.camera);
    updateClouds(this.clouds, this.camera);
    updateFlocks(this.flocks, dt);
    updateOcean(this.ocean, now);
    updateMotes(this.motes, now);
    updateSkyMantas(this.mantas, now);
    updateWaterfalls(this.waterfalls, now);
    updateBalloons(this.balloons, now);
    updateCrystals(this.crystals, now);
    updateTemples(this.temples, now);
    updateGreatTree(this.greatTree, now);
    updateObelisks(this.ruins, now);
    updateRealmAmbience(this.realmAmbience, now);
    this.updateActionBanner(this.currentControls(now));
    this.hud.update(
      this.score.score,
      this.score.combo,
      now - this.score.lastRingT <= 6,
      this.flight.speed,
      SPEED_LIMITS,
      this.flight.pos[1],
    );
    this.hud.updateRingMarker(this.camera, this.nearestOpenRing());

    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(() => this.frame());
  }

  run() {
    this.renderer = createRenderer($('game-canvas'));
    window.addEventListener('resize', () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    });

    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (this.fsm.state === 'flying' || this.fsm.state === 'paused') this.pauseOrResume();
      } else if (e.code === 'KeyM') {
        this.muted = !this.muted;
        this.sound.setMuted(this.muted);
        this.hud.msg(this.muted ? 'muted' : 'sound on', 'cyan');
      } else if (e.code === 'KeyR') {
        if (this.fsm.state === 'flying' || this.fsm.state === 'paused' || this.fsm.state === 'menu') this.regenerate();
      }
    });

    $('btn-motion').addEventListener('click', () => this.startMotionFlow());
    $('btn-keyboard').addEventListener('click', () => this.startKeyboard());
    $('btn-cal-skip').addEventListener('click', () => {
      clearInterval(this._calTimer);
      hide('overlay-calibrate');
      this.startFlying('motion');
    });
    $('btn-cal-cancel').addEventListener('click', () => this.cancelCalibration());
    $('btn-resume').addEventListener('click', () => this.pauseOrResume());
    $('btn-restart').addEventListener('click', () => this.regenerate());
    $('btn-quit').addEventListener('click', () => this.quitToMenu());

    this.frame();
  }
}

function fwdVec(flight) {
  const cf = Math.cos(flight.pitch);
  return [-Math.sin(flight.heading) * cf, Math.sin(flight.pitch), -Math.cos(flight.heading) * cf];
}

function shortestAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// ---------- boot ----------
window.__zephyr = new Game();

async function boot() {
  const g = window.__zephyr;
  // let the loading overlay paint before the heavy synchronous world build
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  g.buildWorld(g.seed);
  g.renderer = null; // built inside run(); kept separate so build is testable
  hide('overlay-loading');
  g.setState('menu');
  show('overlay-menu');
  g.run();
}

boot().catch((err) => {
  console.error(err);
  $('loading-text').textContent = `Failed to start: ${err.message}`;
});

// expose a few things for the smoke test
Object.defineProperty(window.__zephyr, 'sceneBuiltForState', { value: true, writable: true });
