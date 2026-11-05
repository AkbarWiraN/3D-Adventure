// hud.js — update DOM hanya saat nilai berubah (prompt.md §2.5 butir 2).
// TIDAK ada rebuild DOM per frame.

const el = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.nodes = {
      hud: el('hud'),
      hpFill: el('hp-fill'),
      hpText: el('hp-text'),
      weaponName: el('weapon-name'),
      ammoInfo: el('ammo-info'),
      ammoCount: el('ammo-count'),
      cooldownDot: el('cooldown-dot'),
      killfeed: el('killfeed'),
      toast: el('toast'),
      crosshair: el('crosshair'),
      prompt: el('prompt'),
      promptKey: el('prompt-key'),
      promptText: el('prompt-text'),
      fps: el('fps'),
      desktopHint: el('desktop-hint'),
      mobileControls: el('mobile-controls'),
    };
    // Simpan nilai terakhir untuk diff update.
    this._last = { hp: null, weapon: null, ammo: null, cd: null, prompt: null, fps: null, map: null };
    this._toastTimers = [];
  }

  show(on = true) {
    this.nodes.hud.classList.toggle('hidden', !on);
  }

  setHp(hp, max = 100) {
    const v = Math.max(0, Math.min(max, Math.round(hp)));
    if (v === this._last.hp) return;
    this._last.hp = v;
    this.nodes.hpFill.style.width = `${(v / max) * 100}%`;
    this.nodes.hpText.textContent = String(v);
  }

  setWeapon(name, ammo = null) {
    if (name !== this._last.weapon) {
      this._last.weapon = name;
      this.nodes.weaponName.textContent = name;
      this._syncWeaponButtons(name);
    }
    if (ammo === null) {
      if (this._last.ammo !== 'hidden') {
        this._last.ammo = 'hidden';
        this.nodes.ammoInfo.classList.add('hidden');
      }
    } else {
      this.nodes.ammoInfo.classList.remove('hidden');
      if (ammo !== this._last.ammo) {
        this._last.ammo = ammo;
        this.nodes.ammoCount.textContent = String(ammo);
      }
    }
  }

  /**
   * Tombol mobile menyesuaikan senjata aktif (permintaan pemilik 5 Nov):
   * - BIDIK hanya saat memegang Busur.
   * - LEMPAR/JATUHKAN hanya saat memegang senjata (bukan tangan kosong).
   */
  _syncWeaponButtons(weaponName) {
    const aim = el('mb-aim');
    const thr = el('mb-throw');
    const drp = el('mb-drop');
    const hasWeapon = weaponName !== 'Tangan Kosong';
    const isBow = weaponName === 'Busur';
    aim?.classList.toggle('hidden', !isBow);
    thr?.classList.toggle('hidden', !hasWeapon);
    drp?.classList.toggle('hidden', !hasWeapon);
    // Kalau tombol bidik disembunyikan saat sedang mengunci, lepas kuncinya.
    if (!isBow) this.setCrosshair(false);
  }

  /**
   * Overlay kematian + hitung mundur respawn (prompt.md §3.4).
   * Online: server yang menentukan mati/hidup; klien hanya menampilkan.
   */
  showDeath(on, respawnInMs = 0) {
    const el = document.getElementById('screen-death');
    const cd = document.getElementById('death-countdown');
    if (cd) {
      const sec = Math.max(0, Math.ceil(respawnInMs / 1000));
      cd.textContent = sec > 0 ? `Respawn dalam ${sec} detik` : 'Respawn…';
    }
    if (el) el.classList.toggle('hidden', !on);
  }

  isDeathVisible() {
    return !document.getElementById('screen-death')?.classList.contains('hidden');
  }

  setCooldown(ready) {
    if (ready === this._last.cd) return;
    this._last.cd = ready;
    this.nodes.cooldownDot.classList.toggle('ready', ready);
    this.nodes.cooldownDot.classList.toggle('cooling', !ready);
  }

  setPrompt(text, key = 'E') {
    if (text === this._last.prompt) return;
    this._last.prompt = text;
    if (!text) {
      this.nodes.prompt.classList.add('hidden');
      el('mb-interact')?.classList.add('hidden');   // HP: tombol AMBIL ikut hilang
    } else {
      this.nodes.prompt.classList.remove('hidden');
      this.nodes.promptKey.textContent = key;
      this.nodes.promptText.textContent = text;
      el('mb-interact')?.classList.remove('hidden'); // HP: tombol AMBIL muncul (ganti E)
    }
  }

  setCrosshair(on) {
    this.nodes.crosshair.classList.toggle('hidden', !on);
  }

  setFps(value) {
    const v = Math.round(value);
    if (v === this._last.fps) return;
    this._last.fps = v;
    this.nodes.fps.textContent = `${v} FPS`;
  }

  /** Kill feed: dibuat sekali lalu dihapus setelah timeout (bukan per frame). */
  addKillFeed(html) {
    const div = document.createElement('div');
    div.className = 'kf-line';
    div.textContent = html; // textContent, BUKAN innerHTML — cegah XSS (prompt.md §5.2)
    this.nodes.killfeed.appendChild(div);
    // Batasi 5 baris.
    while (this.nodes.killfeed.children.length > 5) {
      this.nodes.killfeed.removeChild(this.nodes.killfeed.firstChild);
    }
    const t = setTimeout(() => {
      div.remove();
      this._toastTimers = this._toastTimers.filter((x) => x !== t);
    }, 6000);
    this._toastTimers.push(t);
  }

  toast(text, ms = 2200) {
    const div = document.createElement('div');
    div.className = 'toast-item';
    div.textContent = text;
    this.nodes.toast.appendChild(div);
    const t = setTimeout(() => {
      div.remove();
      this._toastTimers = this._toastTimers.filter((x) => x !== t);
    }, ms);
    this._toastTimers.push(t);
  }

  setMobileControls(on) {
    this.nodes.mobileControls.classList.toggle('hidden', !on);
    this.nodes.desktopHint.classList.toggle('hidden', on);
  }

  setFpsVisible(on) {
    this.nodes.fps.classList.toggle('hidden', !on);
  }

  clearTransient() {
    for (const t of this._toastTimers) clearTimeout(t);
    this._toastTimers = [];
    this.nodes.killfeed.replaceChildren();
    this.nodes.toast.replaceChildren();
    this.setPrompt(null);
  }
}
