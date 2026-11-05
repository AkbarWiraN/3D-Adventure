// config.js — semua parameter frontend yang bisa diatur (prompt.md §1.2).
// Tidak ada angka ajaib tersebar di modul lain.

export const DEFAULT_BACKEND = 'https://api-be.bssn.biz.id';

/** Deteksi kemampuan perangkat untuk memilih preset grafis otomatis. */
function detectTier() {
  const ua = navigator.userAgent || '';
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua)
    || (navigator.maxTouchPoints > 1 && window.matchMedia('(hover: none)').matches);
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  if (isMobile) return cores >= 8 && mem >= 6 ? 'medium' : 'low';
  return cores >= 8 && mem >= 8 ? 'high' : 'medium';
}

const TIERS = {
  low: {
    pixelRatio: 1.0,
    shadow: false,
    shadowMapSize: 512,
    viewDistance: 190,
    activeRing: 1,
    grassDensity: 0.35,
    treeDensity: 0.55,
    aoiRadius: 120,
    nametags: false,
  },
  medium: {
    pixelRatio: 1.25,
    shadow: true,
    shadowMapSize: 1024,
    viewDistance: 280,
    activeRing: 2,
    grassDensity: 0.7,
    treeDensity: 0.8,
    aoiRadius: 150,
    nametags: false,
  },
  high: {
    pixelRatio: Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 2),
    shadow: true,
    shadowMapSize: 2048,
    viewDistance: 380,
    activeRing: 2,
    grassDensity: 1.0,
    treeDensity: 1.0,
    aoiRadius: 180,
    nametags: false,
  },
};

export const CONFIG = {
  backendBase: DEFAULT_BACKEND,
  quality: 'auto',          // auto | low | medium | high
  resolvedTier: null,
  sensitivity: 1.0,
  invertY: false,
  showFps: false,

  camera: {
    fovNormal: 62,
    fovAim: 42,
    near: 0.1,
    far: 700,
    distance: 3.9,          // jarak kamera ke pemain (over-shoulder, lebih dekat agar tak "zoom out")
    shoulderOffset: 0.75,   // geser ke kanan saat aim
    aimDistance: 2.8,
    height: 1.65,
    pitchMin: -0.95,
    pitchMax: 1.15,
    followLerp: 9.0,        // smoothing posisi kamera (makin besar makin ketat)
    yawLerp: 2.6,           // smoothing yaw otomatis saat berbelok
    collideRadius: 0.55,    // kamera tidak menembus dinding/pohon (lebih besar = lebih aman)
  },
};

/** Tier efektif setelah preset diterapkan. */
export function tier() {
  if (!CONFIG.resolvedTier) {
    CONFIG.resolvedTier = CONFIG.quality === 'auto' ? detectTier() : CONFIG.quality;
  }
  return TIERS[CONFIG.resolvedTier] || TIERS.medium;
}

export function setQuality(q) {
  CONFIG.quality = q;
  CONFIG.resolvedTier = q === 'auto' ? detectTier() : q;
  return CONFIG.resolvedTier;
}

// Mobile dimainkan LANDSCAPE (permintaan pemilik, 5 Nov 2026).
// Portrait di ponsel memunculkan rotate-hint (style.css), bukan mode main.
export function isMobileLandscape() {
  return window.matchMedia('(hover: none)').matches && window.innerWidth > window.innerHeight;
}
