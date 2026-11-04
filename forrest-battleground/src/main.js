// main.js — composition root. Tanpa game logic besar (prompt.md §2.4).
// Tanggung jawab: boot, layar, transisi Solo, error global.

import { CONFIG } from './config.js';
import { emit, on } from './core/bus.js';
import { Screens } from './ui/screens.js';
import { SoloSession } from './core/session.js';
import { loadSettings, saveSettings } from './storage/settings.js';
import { Lobby } from './ui/lobby.js';

const canvas = document.getElementById('gl');
const screens = new Screens();
const lobby = new Lobby();

// Sesi aktif (null saat di lobby)
let session = null;
let started = false;

// ------------------------------------------------------------ error global
window.addEventListener('error', (e) => {
  console.error('[global error]', e.error || e.message);
  const fatal=document.getElementById('fatal-msg');if(fatal)fatal.textContent=String(e.error?.stack||e.message||'Kesalahan JavaScript').slice(0,1000);
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[unhandled rejection]', e.reason);
});

// ------------------------------------------------------------- boot awal
function boot() {
  screens.showLoading(0.35, 'Menyiapkan mesin 3D');
  screens.hideLoading();
  screens.show('title');
  screens.refreshOnlineNote();

  // Konfirmasi jujur: tombol online nonaktif di Fase 1.
  const btnOnline = document.getElementById('btn-online');
  if (btnOnline) {
    btnOnline.disabled = true;
    btnOnline.textContent = 'Main Online (segera)';
    btnOnline.title = 'Multiplayer tersedia pada Fase 3';
  }
  started = true;
}

function isWebGLAvailable() {
  // Do not create a probe context: browsers often limit simultaneous WebGL contexts.
  return Boolean(window.WebGLRenderingContext);
}

// ---------------------------------------------------------------- transisi
function startSolo() {
  try {
    screens.showLoading(0.6, 'Membangkitkan hutan purba');
    // Biarkan browser sempat melukis overlay sebelum pekerjaan berat.
    requestAnimationFrame(() => {
      setTimeout(() => {
        try {
          const settings = loadSettings();
          session = new SoloSession({
            canvas,
            screens,
            character: settings.lastCharacter || lobby.currentCharacter || 'male',
          });
          screens.hideAll();
          session.start();
          emit('game:started');
        } catch (err) {
          console.error('[startSolo]', err);
          if (String(err.message).includes('WEBGL_INIT_FAILED')) {
            screens.showFatal('Konteks WebGL gagal dibuat. Coba perbarui browser atau aktifkan akselerasi perangkat keras.');
          } else {
            screens.showFatal(`Gagal memuat hutan: ${err.message}`);
          }
        }
      }, 30);
    });
  } catch (err) {
    screens.showFatal(`Gagal memuat: ${err.message}`);
  }
}

function exitSolo() {
  if (session) {
    try { session.dispose(); } catch (err) { console.error('[dispose]', err); }
    session = null;
  }
  screens.show('title');
  screens.refreshOnlineNote();
  emit('game:exited');
}

function pauseGame() {
  if (!session) return;
  if (session.paused) {
    session.setPaused(false);
    screens.hideAll();
  } else {
    session.setPaused(true);
    screens.showPause();
  }
}

// ------------------------------------------------------------------ events
// bus events (didaftarkan via import emit)
on('ui:startSolo', startSolo);
on('ui:exitSolo', exitSolo);
document.getElementById('btn-death-exit')?.addEventListener('click', exitSolo);
on('ui:pause', pauseGame);
on('ui:resume', pauseGame);
on('ui:qualityChanged', () => {
  if (session) {
    // Perubahan grafis berlaku setelah keluar-masuk Solo (jujur, bukan diam-diam diabaikan).
    screens.hideAll();
    screens.showPause();
  }
});

// --------------------------------------------------------------- resize/orient
let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (session) session._resize();
  }, 120);
});
window.addEventListener('orientationchange', () => {
  setTimeout(() => { if (session) session._resize(); }, 220);
});

// Pause otomatis saat tab tidak terlihat (hemat baterai & aman).
document.addEventListener('visibilitychange', () => {
  if (!session) return;
  if (document.hidden && !session.paused) {
    session.setPaused(true);
  }
});

// ------------------------------------------------------- exit saat refresh
window.addEventListener('beforeunload', () => {
  if (session) {
    try { session.dispose(); } catch { /* abaikan saat unload */ }
  }
});

// ------------------------------------------------------------------- mulai
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

// Hook debug — HANYA saat ?debug=1 (prompt.md: jangan ekspos state normal)
const params = new URLSearchParams(location.search);
if (params.get('debug') === '1') {
  window.__fb = {
    CONFIG,
    getSession: () => session,
    metrics: () => (session ? session.metrics() : null),
    startSolo,
    exitSolo,
    pauseGame,
    getWorld: async () => (await import('./shared/world.js')).getWorld(),
  };
  document.getElementById('fps')?.classList.remove('hidden');
}
