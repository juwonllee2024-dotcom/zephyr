// Live body-tracking vision panel: mirrored webcam feed with a full pose
// skeleton overlay, joint dots, control gauges (BANK / CLIMB / FLAP),
// tracking state, and FPS. This is "the game analyzing your body" made visible.

const CONNECTIONS = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],   // arms + shoulders
  [11, 23], [12, 24], [23, 24],                        // torso
  [23, 25], [25, 27], [24, 26], [26, 28],              // legs
];

export class PoseVisionPanel {
  constructor(videoEl) {
    this.video = videoEl;
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'pose-canvas';
    this.box = videoEl.parentElement; // #cam-box
    this.box.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.fps = { n: 0, t0: performance.now(), val: 0 };
  }

  resize() {
    // match the rendered video box size
    const r = this.box.getBoundingClientRect();
    this.canvas.width = Math.max(160, Math.round(r.width));
    this.canvas.height = Math.max(90, Math.round(r.width * 9 / 16));
  }

  draw(lms, controls, tracked) {
    const { ctx, canvas } = this;
    const W = canvas.width;
    const H = canvas.height;

    // fps meter
    this.fps.n++;
    const now = performance.now();
    if (now - this.fps.t0 > 500) {
      this.fps.val = Math.round((this.fps.n * 1000) / (now - this.fps.t0));
      this.fps.n = 0;
      this.fps.t0 = now;
    }

    // ---- video frame (mirrored)
    ctx.save();
    if (this.video.readyState >= 2) {
      ctx.scale(-1, 1);
      ctx.drawImage(this.video, -W, 0, W, H);
    } else {
      ctx.fillStyle = '#101828';
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();

    // dim veil so overlays pop
    ctx.fillStyle = 'rgba(8, 14, 26, 0.34)';
    ctx.fillRect(0, 0, W, H);

    // ---- skeleton
    if (tracked && lms) {
      const px = (p) => [(1 - p.x) * W, p.y * H]; // mirror X

      // bones
      ctx.lineWidth = Math.max(2, W / 86);
      for (const [a, b] of CONNECTIONS) {
        const pa = lms[a];
        const pb = lms[b];
        if (!pa || !pb || (pa.visibility ?? 1) < 0.4 || (pb.visibility ?? 1) < 0.4) continue;
        const grad = ctx.createLinearGradient(...px(pa), ...px(pb));
        grad.addColorStop(0, '#59d2ff');
        grad.addColorStop(1, '#7dffa8');
        ctx.strokeStyle = grad;
        ctx.beginPath();
        ctx.moveTo(...px(pa));
        ctx.lineTo(...px(pb));
        ctx.stroke();
      }

      // joints (shoulders & wrists highlighted)
      for (let i = 0; i < lms.length; i++) {
        const p = lms[i];
        if (!p || (p.visibility ?? 1) < 0.4) continue;
        if (![11, 12, 13, 14, 15, 16, 23, 24, 25, 26].includes(i)) continue;
        const hot = i === 11 || i === 12 || i === 15 || i === 16;
        const [x, y] = px(p);
        ctx.beginPath();
        ctx.arc(x, y, hot ? Math.max(4, W / 55) : Math.max(2.5, W / 95), 0, Math.PI * 2);
        ctx.fillStyle = hot ? '#ffd166' : '#eaf2ff';
        ctx.fill();
        if (hot) {
          ctx.beginPath();
          ctx.arc(x, y, Math.max(6.5, W / 38), 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255, 209, 102, 0.5)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
    }

    // ---- lean horizon line (rotates with bank)
    const cx = W / 2;
    const cy = H * 0.42;
    const roll = controls?.roll ?? 0;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-roll * 0.7);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-W * 0.32, 0);
    ctx.lineTo(W * 0.32, 0);
    ctx.stroke();
    // wingtip ticks
    ctx.strokeStyle = 'rgba(255,179,71,0.95)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-W * 0.32, 0);
    ctx.lineTo(-W * 0.22, 0);
    ctx.moveTo(W * 0.22, 0);
    ctx.lineTo(W * 0.32, 0);
    ctx.stroke();
    ctx.restore();

    // ---- control bars
    const bar = (label, v, color, y) => {
      const bw = W * 0.3;
      const bh = 5;
      const bx = 10;
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(bx, y, bw, bh);
      const half = bw / 2;
      ctx.fillStyle = color;
      ctx.fillRect(v >= 0 ? bx + half : bx + half + v * half, y, Math.abs(v) * half, bh);
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.font = `700 ${Math.max(8, W / 17)}px Segoe UI, sans-serif`;
      ctx.textBaseline = 'bottom';
      ctx.fillText(label, bx, y - 1);
    };
    const pitch = controls?.pitch ?? 0;
    const flap = controls?.flap ?? 0;
    bar('LEAN', clamp01(roll), '#ffb347', H - 40);
    bar('CLIMB', clamp01(pitch), '#59d2ff', H - 22);
    // flap as pulsing meter
    bar('FLAP', clamp01(flap), '#7dffa8', H - 4);

    // status chip
    ctx.font = `700 ${Math.max(8, W / 16)}px Segoe UI, sans-serif`;
    ctx.textBaseline = 'top';
    const stText = tracked ? `TRACKED · ${this.fps.val}fps` : 'SEARCHING…';
    const tw = ctx.measureText(stText).width;
    ctx.fillStyle = tracked ? 'rgba(20, 40, 30, 0.72)' : 'rgba(46, 36, 14, 0.72)';
    ctx.fillRect(W - tw - 18, 8, tw + 10, Math.max(14, W / 13));
    ctx.fillStyle = tracked ? '#7dffa8' : '#ffd479';
    ctx.fillText(stText, W - tw - 13, 11);
  }
}

function clamp01(v) {
  return v < -1 ? -1 : v > 1 ? 1 : v;
}
