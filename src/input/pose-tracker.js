// Webcam pose tracking via MediaPipe PoseLandmarker (CPU delegate).
// Bundles wasm + model from /public/mediapipe — no runtime CDN calls.

export class PoseTracker {
  constructor(onLandmarks, onStatus) {
    this.onLandmarks = onLandmarks;   // (landmarks33, tSec) => void
    this.onStatus = onStatus;         // ('init'|'searching'|'ok'|'lost'|'error') => void
    this.landmarker = null;
    this.video = null;
    this.stream = null;
    this.running = false;
    this._raf = 0;
    this._lastVideoTime = -1;
    this.status = 'init';
    this._consecutive = 0;
  }

  async init() {
    this.onStatus('init');
    const vision = await import('@mediapipe/tasks-vision');
    const fileset = await vision.FilesetResolver.forVisionTasks('/mediapipe/wasm');
    this.landmarker = await vision.PoseLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: '/mediapipe/pose_landmarker_lite.task',
        delegate: 'CPU',
      },
      runningMode: 'VIDEO',
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
  }

  async start(videoEl) {
    this.video = videoEl;
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 360, facingMode: 'user' },
      audio: false,
    });
    videoEl.srcObject = this.stream;
    await videoEl.play();
    this.running = true;
    this._setStatus('searching');
    const tick = () => {
      if (!this.running) return;
      this._raf = requestAnimationFrame(tick);
      if (!this.landmarker || videoEl.readyState < 2) return;
      if (videoEl.currentTime === this._lastVideoTime) return;
      this._lastVideoTime = videoEl.currentTime;
      let result;
      try {
        result = this.landmarker.detectForVideo(videoEl, performance.now());
      } catch {
        return; // transient detector hiccup; skip frame
      }
      const lms = result?.landmarks?.[0];
      if (lms && this._personVisible(lms)) {
        this._consecutive++;
        this.onLandmarks(lms, performance.now() / 1000);
        if (this.status !== 'ok' && this._consecutive > 6) this._setStatus('ok');
      } else {
        this._consecutive = 0;
        if (this.status === 'ok') this._setStatus('lost');
      }
    };
    this._raf = requestAnimationFrame(tick);
  }

  _personVisible(lms) {
    // shoulders + wrists must be reasonably visible
    const idx = [11, 12, 15, 16];
    return idx.every((i) => lms[i] && (lms[i].visibility ?? 1) > 0.5);
  }

  _setStatus(s) {
    this.status = s;
    this.onStatus(s);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this._raf);
    if (this.stream) {
      for (const track of this.stream.getTracks()) track.stop();
      this.stream = null;
    }
    if (this.video) this.video.srcObject = null;
    this._setStatus('lost');
  }
}
