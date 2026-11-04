// screens.js — kendali layar UI (judul/lobby, pengaturan, jeda, peta, muat).
// prompt.md §2.5 butir 9: tombol fitur yang belum ada HARUS disabled + label jujur.

import { CONFIG, setQuality, tier } from '../config.js';
import { loadSettings, saveSettings } from '../storage/settings.js';
import { testConnection } from '../network/rest.js';
import { emit } from '../core/bus.js';

const el = (id) => document.getElementById(id);

export class Screens {
  constructor() {
    this.nodes = {
      title: el('screen-title'),
      settings: el('screen-settings'),
      pause: el('screen-pause'),
      map: el('screen-map'),
      loading: el('loading'),
      loadingFill: el('loading-fill'),
      loadingText: el('loading-text'),
      fatal: el('fatal'),
      fatalMsg: el('fatal-msg'),
      backend: el('set-backend'),
      quality: el('set-quality'),
      sens: el('set-sens'),
      sensVal: el('sens-val'),
      invertY: el('set-inverty'),
      connStatus: el('conn-status'),
      customWarn: el('custom-warn'),
      onlineNote: el('online-note'),
    };
    this.returnTo = 'title';
    this._wire();
    this.applySettingsToUi();
  }

  _wire() {
    const n = this.nodes;

    el('btn-solo')?.addEventListener('click', () => emit('ui:startSolo'));
    el('btn-settings')?.addEventListener('click', () => this.showSettings('title'));
    el('btn-settings-back')?.addEventListener('click', () => this.back());
    el('btn-test-conn')?.addEventListener('click', () => this.runTestConnection());
    el('btn-resume')?.addEventListener('click', () => emit('ui:resume'));
    el('btn-pause-settings')?.addEventListener('click', () => this.showSettings('pause'));
    el('btn-pause-exit')?.addEventListener('click', () => emit('ui:exitSolo'));
    el('btn-map-close')?.addEventListener('click', () => this.hideMap());
    el('fatal-retry')?.addEventListener('click', () => location.reload());

    // Input pengaturan
    n.sens?.addEventListener('input', () => {
      CONFIG.sensitivity = Number(n.sens.value);
      n.sensVal.textContent = CONFIG.sensitivity.toFixed(1);
      this.persist();
    });
    n.invertY?.addEventListener('change', () => {
      CONFIG.invertY = n.invertY.checked;
      this.persist();
    });
    n.quality?.addEventListener('change', () => {
      const setting = setQuality(n.quality.value);
      CONFIG.quality = n.quality.value;
      this.persist();
      emit('ui:qualityChanged', setting);
    });
    n.backend?.addEventListener('change', () => {
      const v = n.backend.value.trim();
      CONFIG.backendBase = v;
      this.updateCustomWarning();
      this.persist();
      n.connStatus.textContent = 'Belum diuji';
      n.connStatus.className = 'dim small';
    });
  }

  applySettingsToUi() {
    const s = loadSettings();
    CONFIG.sensitivity = s.sensitivity;
    CONFIG.invertY = s.invertY;
    CONFIG.showFps = s.showFps;
    CONFIG.backendBase = s.backendBase || '';
    setQuality(s.quality);

    const n = this.nodes;
    if (n.backend) n.backend.value = s.backendBase || '';
    if (n.quality) n.quality.value = s.quality;
    if (n.sens) n.sens.value = String(s.sensitivity);
    if (n.sensVal) n.sensVal.textContent = Number(s.sensitivity).toFixed(1);
    if (n.invertY) n.invertY.checked = s.invertY;
    this.updateCustomWarning();
  }

  persist() {
    saveSettings({
      backendBase: CONFIG.backendBase,
      quality: CONFIG.quality,
      sensitivity: CONFIG.sensitivity,
      invertY: CONFIG.invertY,
      showFps: CONFIG.showFps,
      lastCharacter: 'male',
    });
  }

  updateCustomWarning() {
    const has = Boolean((CONFIG.backendBase || '').trim());
    this.nodes.customWarn?.classList.toggle('hidden', !has);
  }

  async runTestConnection() {
    const s = this.nodes.connStatus;
    s.textContent = 'Menguji…';
    s.className = 'dim small';
    const r = await testConnection();
    if (r.ok) {
      s.textContent = `OK · ${r.latencyMs} ms · world ${r.worldVersion ?? '—'} · kapasitas ${r.roomHardCap ?? '—'}`;
      s.className = 'small';
      s.style.color = 'var(--accent-2)';
    } else {
      s.textContent = `Gagal: ${r.message}`;
      s.className = 'warn small';
      s.style.color = '';
    }
  }

  // ------------------------------------------------------------- show/hide
  show(name, { returnTo = null } = {}) {
    this.hideAll();
    if (returnTo) this.returnTo = returnTo;
    const map = {
      title: this.nodes.title,
      settings: this.nodes.settings,
      pause: this.nodes.pause,
      map: this.nodes.map,
      loading: this.nodes.loading,
      fatal: this.nodes.fatal,
    };
    map[name]?.classList.remove('hidden');
  }

  hide(name) {
    const map = {
      title: this.nodes.title,
      settings: this.nodes.settings,
      pause: this.nodes.pause,
      map: this.nodes.map,
      loading: this.nodes.loading,
      fatal: this.nodes.fatal,
    };
    map[name]?.classList.add('hidden');
  }

  hideAll() {
    for (const k of ['title', 'settings', 'pause', 'map', 'loading', 'fatal']) this.hide(k);
  }

  showSettings(returnTo) {
    this.returnTo = returnTo;
    this.hideAll();
    this.nodes.settings.classList.remove('hidden');
  }

  back() {
    this.persist();
    if (this.returnTo === 'pause') {
      this.hideAll();
      this.nodes.pause.classList.remove('hidden');
    } else {
      this.show('title');
      this.refreshOnlineNote();
    }
  }

  showMap() {
    this.nodes.map.classList.remove('hidden');
    emit('ui:mapOpened');
  }

  hideMap() {
    this.nodes.map.classList.add('hidden');
    emit('ui:mapClosed');
  }

  isMapOpen() { return !this.nodes.map.classList.contains('hidden'); }

  showPause() {
    this.hideAll();
    this.nodes.pause.classList.remove('hidden');
  }

  showLoading(pct, text) {
    this.nodes.loading.classList.remove('hidden');
    this.nodes.loadingFill.style.width = `${Math.round(pct * 100)}%`;
    if (text) this.nodes.loadingText.textContent = text;
  }

  hideLoading() { this.nodes.loading.classList.add('hidden'); }

  showFatal(message) {
    this.hideAll();
    this.nodes.fatal.classList.remove('hidden');
    if (message) this.nodes.fatalMsg.textContent = message;
  }

  /** Catatan online yang JUJUR (prompt.md §3.6: jangan tampilkan 0 palsu). */
  refreshOnlineNote(text = null) {
    if (!this.nodes.onlineNote) return;
    if (text) {
      this.nodes.onlineNote.textContent = text;
      return;
    }
    const base = (CONFIG.backendBase || '').trim() || 'https://api-be.bssn.biz.id';
    this.nodes.onlineNote.textContent = `Room forest · WSS otoritatif · backend ${base}`;
  }

  /** Tier grafis yang sedang dipakai — ditampilkan jujur ke pemain. */
  currentTierLabel() {
    const q = CONFIG.quality;
    const t = CONFIG.resolvedTier || '—';
    return q === 'auto' ? `Otomatis (${t})` : q;
  }
}
