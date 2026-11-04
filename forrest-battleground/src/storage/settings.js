// storage.js — HANYA preferensi non-rahasia (prompt.md §3.6 & §5.2).
// Token/password TIDAK PERNAH masuk sini.

const KEY = 'forest-battleground:settings:v1';

const DEFAULTS = {
  backendBase: '',
  quality: 'auto',
  sensitivity: 1.0,
  invertY: false,
  showFps: false,
  lastCharacter: 'male',
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    // Whitelist field — jangan percaya apa pun dari storage.
    const out = { ...DEFAULTS };
    if (typeof parsed.backendBase === 'string') out.backendBase = parsed.backendBase.slice(0, 200);
    if (['auto', 'low', 'medium', 'high'].includes(parsed.quality)) out.quality = parsed.quality;
    if (typeof parsed.sensitivity === 'number' && parsed.sensitivity > 0 && parsed.sensitivity <= 3) {
      out.sensitivity = parsed.sensitivity;
    }
    if (typeof parsed.invertY === 'boolean') out.invertY = parsed.invertY;
    if (typeof parsed.showFps === 'boolean') out.showFps = parsed.showFps;
    if (['male', 'female'].includes(parsed.lastCharacter)) out.lastCharacter = parsed.lastCharacter;
    return out;
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings) {
  try {
    const safe = {
      backendBase: String(settings.backendBase || '').slice(0, 200),
      quality: settings.quality,
      sensitivity: Number(settings.sensitivity) || 1,
      invertY: Boolean(settings.invertY),
      showFps: Boolean(settings.showFps),
      lastCharacter: settings.lastCharacter === 'female' ? 'female' : 'male',
    };
    localStorage.setItem(KEY, JSON.stringify(safe));
  } catch {
    // Storage penuh / diblokir: jangan ganggu permainan.
  }
}

/** Bersihkan total (dipakai saat debugging / user minta reset). */
export function clearSettings() {
  try { localStorage.removeItem(KEY); } catch { /* abaikan */ }
}
