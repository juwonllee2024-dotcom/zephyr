// DOM HUD: score, combo, meters, message feed, ring screen-marker, warnings.

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.el = $('hud');
    this.scoreEl = $('hud-score');
    this.comboEl = $('hud-combo');
    this.speedFill = $('hud-speed-fill');
    this.speedVal = $('hud-speed-val');
    this.altFill = $('hud-alt-fill');
    this.altVal = $('hud-alt-val');
    this.statusEl = $('hud-status');
    this.feedEl = $('msg-feed');
    this.markerEl = $('ring-marker');
    this.markerDistEl = $('ring-marker-dist');
    this.arrowEl = $('ring-arrow');
    this.warnEl = $('warn');
    this.camBox = $('cam-box');

    this._lastMsgAt = {};
  }

  show() { this.el.classList.remove('hidden'); }
  hide() { this.el.classList.add('hidden'); }

  setMode(motionOk) {
    this.statusEl.textContent = motionOk ? 'MOTION' : 'KEYBOARD';
    this.statusEl.classList.toggle('motion', motionOk);
    this.camBox.classList.toggle('hidden', !motionOk);
  }

  update(score, combo, comboActive, speed, speedLimits, altitude) {
    this.scoreEl.textContent = score.toLocaleString('en-US');
    if (combo >= 2) {
      const mult = Math.min(4, 1 + 0.25 * (combo - 1));
      this.comboEl.textContent = `COMBO ×${combo} — ${mult.toFixed(2)}×`;
      this.comboEl.classList.toggle('dim', !comboActive);
    } else {
      this.comboEl.textContent = '';
    }
    const sp = Math.max(0, (speed - speedLimits.min) / (speedLimits.max - speedLimits.min));
    this.speedFill.style.width = `${(sp * 100).toFixed(1)}%`;
    this.speedVal.textContent = Math.round(speed * 3.6); // "km/h" flavor
    const altK = Math.min(1, altitude / 700);
    this.altFill.style.width = `${(altK * 100).toFixed(1)}%`;
    this.altVal.textContent = `${Math.round(altitude)}m`;
  }

  // type: gold | cyan | red
  msg(text, type = 'gold', throttleMs = 0) {
    const now = performance.now();
    if (throttleMs && now - (this._lastMsgAt[text] ?? 0) < throttleMs) return;
    this._lastMsgAt[text] = now;

    const div = document.createElement('div');
    div.className = `msg ${type}`;
    div.textContent = text;
    this.feedEl.appendChild(div);
    setTimeout(() => div.remove(), 1500);
    while (this.feedEl.children.length > 4) this.feedEl.firstChild.remove();
  }

  // Project nearest un-passed ring to screen space for the diamond marker.
  updateRingMarker(camera, targetRing) {
    if (!targetRing || !this.markerEl || !this.arrowEl) {
      this.markerEl?.classList.add('hidden');
      this.arrowEl?.classList.add('hidden');
      return null;
    }
    const v = targetRing.mesh.position.clone().project(camera);
    const behind = v.z > 1;
    const x = (v.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
    const dist = camera.position.distanceTo(targetRing.mesh.position);
    const dText = `${Math.round(dist)}m`;

    if (behind || x < 60 || x > window.innerWidth - 60 || y < 60 || y > window.innerHeight - 60) {
      // Off-screen: clamp an arrow to the screen edge pointing toward it.
      this.markerEl.classList.add('hidden');
      this.arrowEl.classList.remove('hidden');
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      let dx = x - cx;
      let dy = y - cy;
      if (behind) { dx = -dx; dy = -dy; }
      const ang = Math.atan2(dy, dx);
      const rx = Math.min(cx - 80, Math.abs(Math.cos(ang) * cx)) ;
      const ry = Math.min(cy - 80, Math.abs(Math.sin(ang) * cy));
      const r = Math.min(rx / Math.abs(Math.cos(ang) || 1e-6), ry / Math.abs(Math.sin(ang) || 1e-6));
      this.arrowEl.style.left = `${cx + Math.cos(ang) * r - 17}px`;
      this.arrowEl.style.top = `${cy + Math.sin(ang) * r - 17}px`;
      this.arrowEl.style.transform = `rotate(${ang}rad)`;
      this.markerDistEl.textContent = dText;
    } else {
      this.arrowEl.classList.add('hidden');
      this.markerEl.classList.remove('hidden');
      const size = Math.max(10, 26 - dist * 0.02);
      this.markerEl.querySelector('#ring-marker-diamond').style.width = `${size}px`;
      this.markerEl.querySelector('#ring-marker-diamond').style.height = `${size}px`;
      this.markerEl.style.left = `${x - 20}px`;
      this.markerEl.style.top = `${y - 20}px`;
      this.markerDistEl.textContent = dText;
    }
    return { dist };
  }

  setWarn(show) {
    this.warnEl.classList.toggle('hidden', !show);
  }

  flashDamage(el = $('flash')) {
    el.style.opacity = '1';
    setTimeout(() => { el.style.opacity = '0'; }, 90);
  }
}
