// lobby.js — layar lobby setelah login: header tab (Beranda, Karakter, Map,
// Leaderboard, Pengaturan Akun) + auth (masuk/daftar) di layar judul.
// Data nyata dari REST; refresh ringan 20 detik (prompt.md §1.1 leaderboard).

import { CONFIG } from '../config.js';
import { api, setToken, clearToken, getUser, getToken } from '../network/rest.js';
import { emit } from '../core/bus.js';

const $ = (id) => document.getElementById(id);

const CHAR_LABEL = { male: 'Laki-laki', female: 'Perempuan' };

export class Lobby {
  constructor(screens) {
    this.screens = screens;
    this.status = $('auth-status');
    this.username = $('auth-username');
    this.password = $('auth-password');
    this.character = $('auth-character');
    this.currentCharacter = 'male';
    this.timer = 0;
    this._wireAuth();
    this._wireLobby();
    this._syncAuthUI();
  }

  // ------------------------------------------------------------- auth UI
  _wireAuth() {
    $('auth-mode-login')?.addEventListener('click', () => this._setAuthMode('login'));
    $('auth-mode-register')?.addEventListener('click', () => this._setAuthMode('register'));
    $('btn-register')?.addEventListener('click', () => this.auth('register'));
    $('btn-login')?.addEventListener('click', () => this.auth('login'));
    $('btn-account')?.addEventListener('click', () => this._showTab('akun'));
    $('btn-account-logout')?.addEventListener('click', () => this.logout());
    // Enter di field password memicu aksi mode aktif.
    this.password?.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      this.auth($('btn-register')?.classList.contains('hidden') ? 'login' : 'register');
    });
    this.character?.addEventListener('change', async () => {
      if (!getUser()) return; // mode daftar: nilai dikirim saat register
      try {
        await api.updateMe(this.character.value);
        this.currentCharacter = this.character.value;
        this._setStatus(`Karakter diganti ke ${CHAR_LABEL[this.character.value]}.`);
      } catch (e) { this._setStatus(e.message); }
    });
  }

  _setAuthMode(mode) {
    const isReg = mode === 'register';
    $('auth-mode-login')?.classList.toggle('active', !isReg);
    $('auth-mode-register')?.classList.toggle('active', isReg);
    $('auth-character-field')?.classList.toggle('hidden', !isReg);
    $('btn-register')?.classList.toggle('hidden', !isReg);
    $('btn-login')?.classList.toggle('hidden', isReg);
    this.password?.setAttribute('autocomplete', isReg ? 'new-password' : 'current-password');
    this._setStatus(isReg ? 'Isi username, password, dan pilih karakter.' : 'Masuk dengan akun yang sudah terdaftar.');
  }

  _setStatus(text) { if (this.status) this.status.textContent = text; }

  _syncAuthUI() {
    const logged = Boolean(getUser());
    $('auth-mode')?.classList.toggle('hidden', logged);
    $('btn-account')?.classList.toggle('hidden', !logged);
    // Saat sudah login, panel judul tidak menampilkan form kredensial.
    $('auth-username')?.closest('.field')?.classList.toggle('hidden', logged);
    $('auth-password')?.closest('.field')?.classList.toggle('hidden', logged);
    $('auth-character-field')?.classList.toggle('hidden', true);
    $('btn-register')?.classList.add('hidden');
    $('btn-login')?.classList.toggle('hidden', logged);
  }

  async auth(mode) {
    this._setStatus('Menghubungkan…');
    const base = (CONFIG.backendBase || '').trim();
    if (base && !confirm(`Mengirim kredensial ke server kustom ${base}. Lanjutkan hanya jika dipercaya.`)) return;
    try {
      const r = await api[mode](this.username.value, this.password.value, this.character.value);
      setToken(r.data.token, r.data.user);
      this.currentCharacter = r.data.user.character;
      this.password.value = '';
      this._syncAuthUI();
      this._syncOnlineButtons();
      const uname = r.data.user.username_display || r.data.user.username || 'akun';
      this._setStatus(`Masuk sebagai ${uname}`);
      await this.refresh();
      clearInterval(this.timer);
      this.timer = setInterval(() => this.refresh(), 20000);
      // Login/daftar sukses → masuk lobby (Beranda).
      this.screens.show('lobby', { returnTo: 'lobby' });
      this._showTab('beranda');
    } catch (e) { this._setStatus(e.message); }
  }

  logout() {
    // Logout sungguhan di server: revoke token + tutup sesi WS (prompt.md §4.2).
    // Fire-and-forget — UI jangan menunggu jaringan; gagal pun token lokal tetap dibersihkan.
    api.logout().catch(() => {});
    clearInterval(this.timer);
    this.timer = 0;
    clearToken();
    this.password.value = '';
    this._syncAuthUI();
    this._syncOnlineButtons();
    this._setStatus('Keluar. Main Solo tetap tersedia.');
    this.screens.show('title', { returnTo: 'title' });
    this.screens.refreshOnlineNote();
  }

  // ------------------------------------------------------------ lobby UI
  _wireLobby() {
    for (const tab of document.querySelectorAll('.lobby-tab')) {
      tab.addEventListener('click', () => this._showTab(tab.dataset.tab));
    }
    $('btn-lobby-solo')?.addEventListener('click', () => emit('ui:startSolo'));
    $('btn-lobby-online')?.addEventListener('click', () => emit('ui:startOnline'));
    $('btn-lobby-gamesettings')?.addEventListener('click', () => this.screens.showSettings('lobby'));
    for (const card of document.querySelectorAll('.char-card')) {
      card.addEventListener('click', () => this._pickCharacter(card.dataset.char));
    }
  }

  _showTab(name) {
    // Bila belum login, tab akun tidak masuk akal — kembali ke judul.
    if (!getUser()) { this.screens.show('title'); return; }
    for (const tab of document.querySelectorAll('.lobby-tab')) {
      tab.classList.toggle('active', tab.dataset.tab === name);
    }
    for (const page of document.querySelectorAll('.lobby-page')) {
      page.classList.toggle('hidden', page.dataset.page !== name);
    }
    this.screens.show('lobby', { returnTo: 'lobby' });
    if (name === 'leaderboard' || name === 'map') this.refresh(); // data segar saat dibuka
  }

  _syncOnlineButtons() {
    const ok = Boolean(getToken() && getUser());
    const note = ok ? 'Masuk room forest (WSS otoritatif)' : 'Login dahulu untuk main online';
    for (const id of ['btn-online', 'btn-lobby-online']) {
      const b = $(id);
      if (b) { b.disabled = !ok; b.title = note; }
    }
  }

  async _pickCharacter(char) {
    this.currentCharacter = char;
    for (const c of document.querySelectorAll('.char-card')) {
      c.classList.toggle('selected', c.dataset.char === char);
    }
    const st = $('char-status');
    if (st) st.textContent = `Karakter aktif: ${CHAR_LABEL[char]}.`;
    if (!getUser()) return;
    try { await api.updateMe(char); }
    catch (e) { if (st) st.textContent = `Gagal menyimpan: ${e.message}`; }
  }

  // -------------------------------------------------------------- refresh
  async refresh() {
    if (!getUser()) return;
    try {
      const [profile, maps, top, me] = await Promise.all([
        api.me(), api.maps(), api.leaderboard(10), api.leaderboardMe(),
      ]);
      const user = profile.data.user;
      this.currentCharacter = user.character;

      // Header + greeting
      const uname = user.username_display || user.username;
      const lu = $('lobby-user');
      if (lu) lu.textContent = `${uname} · ${CHAR_LABEL[user.character] ?? user.character}`;
      const lg = $('lobby-greeting');
      if (lg) lg.textContent = `Selamat datang, ${uname}`;

      // Karakter: tandai kartu aktif
      for (const c of document.querySelectorAll('.char-card')) {
        c.classList.toggle('selected', c.dataset.char === user.character);
      }

      // Map
      const list = $('map-list');
      if (list) {
        list.replaceChildren();
        for (const m of maps.data.maps || []) {
          const card = document.createElement('div');
          card.className = 'map-card';
          const cap = m.hardCap ?? m.hard_cap ?? '—';
          card.innerHTML = `<b>Forest — Hutan Purba</b>
            <span class="dim small">1 km² · pemain ${m.onlineCount ?? m.online_count ?? 0}/${cap}</span>`;
          list.append(card);
        }
      }

      // Leaderboard
      const lb = $('lb-list');
      const self = $('lb-self');
      const empty = $('lb-empty');
      if (self) self.textContent = `Peringkatmu: ${me.data.rank ?? '—'} · K/D ${me.data.kills ?? 0}/${me.data.deaths ?? 0}`;
      if (lb) {
        lb.replaceChildren();
        const entries = top.data.entries || [];
        empty?.classList.toggle('hidden', entries.length > 0);
        for (const x of entries) {
          const li = document.createElement('li');
          li.innerHTML = `<span class="lb-rank">#${x.rank}</span> <b></b> <span class="dim small">${x.kills}/${x.deaths} · KDR ${x.kdr}</span>`;
          li.querySelector('b').textContent = x.username;
          lb.append(li);
        }
      }

      // Akun
      const info = $('account-info');
      if (info) {
        info.replaceChildren();
        const p = document.createElement('p');
        p.className = 'dim small';
        p.textContent = `Username: ${uname} · Karakter: ${CHAR_LABEL[user.character] ?? user.character}`;
        info.append(p);
      }

      // Catatan beranda
      const note = $('lobby-note');
      if (note) note.textContent = `Room forest · WSS otoritatif · backend ${(CONFIG.backendBase || '').trim() || 'resmi'}`;
    } catch (e) {
      this._setStatus(`Lobi gagal dimuat: ${e.message}`);
      const note = $('lobby-note');
      if (note) note.textContent = `Gagal memuat data: ${e.message}`;
    }
  }
}
