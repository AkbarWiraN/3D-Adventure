// dispose.js — utilitas lifecycle. prompt.md §2.5 butir 4:
// setiap geometry/material/texture yang dibuat dinamis WAJIB di-dispose.
// Material & geometry yang SHARED tidak boleh di-dispose per chunk.

const SHARED = new Set();

export function markShared(...objs) {
  for (const o of objs) if (o) SHARED.add(o);
}

export function isShared(obj) {
  return SHARED.has(obj);
}

/** Lepas objek dari scene lalu dispose resource miliknya (bukan yang shared). */
export function disposeObject3D(obj) {
  if (!obj) return;
  obj.traverse((child) => {
    if (child.geometry && !isShared(child.geometry)) {
      child.geometry.dispose();
      child.geometry = null;
    }
    if (child.material) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const m of mats) {
        if (!m || isShared(m)) continue;
        for (const key of Object.keys(m)) {
          const v = m[key];
          if (v && v.isTexture && !isShared(v)) v.dispose();
        }
        m.dispose();
      }
      child.material = null;
    }
  });
  if (obj.parent) obj.parent.remove(obj);
}

/** Hapus seluruh isi group & dispose. */
export function disposeGroup(group) {
  if (!group) return;
  for (const child of [...group.children]) disposeObject3D(child);
  group.clear?.();
}
