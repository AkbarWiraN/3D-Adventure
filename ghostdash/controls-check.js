// Self-check: arah gerak relatif kamera + follow kamera.
// Jalankan: node controls-check.js
var assert = require('assert');

function camRelativeMove(yaw, mx, mz) {
  var fx = Math.sin(yaw), fz = Math.cos(yaw);
  return { x: fx * mz + fz * mx, z: fz * mz - fx * mx };
}

// Kamera di yaw=0 duduk di +Z dari pemain, jadi "maju" (mz<0) harus -Z.
var f = camRelativeMove(0, 0, -1);
assert.ok(Math.abs(f.x) < 1e-9 && Math.abs(f.z + 1) < 1e-9, 'stik atas harus -Z saat yaw=0');
// Stik bawah = +Z
var b = camRelativeMove(0, 0, 1);
assert.ok(Math.abs(b.z - 1) < 1e-9, 'stik bawah harus +Z saat yaw=0');
// Stik kanan = +X
var r = camRelativeMove(0, 1, 0);
assert.ok(Math.abs(r.x - 1) < 1e-9, 'stik kanan harus +X saat yaw=0');
// Stik kiri = -X
var l = camRelativeMove(0, -1, 0);
assert.ok(Math.abs(l.x + 1) < 1e-9, 'stik kiri harus -X saat yaw=0');

// Kamera diputar 90° (yaw=PI/2): kamera di +X, jadi maju harus -X
var f90 = camRelativeMove(Math.PI / 2, 0, -1);
assert.ok(Math.abs(f90.x + 1) < 1e-9, 'maju harus -X saat kamera di +X');
// ...dan stik kanan harus -Z (relatif layar)
var r90 = camRelativeMove(Math.PI / 2, 1, 0);
assert.ok(Math.abs(r90.z + 1) < 1e-9, 'kanan harus -Z saat kamera di +X');

// Diagonal tidak boleh lebih cepat dari lurus (magnitudo <= 1)
var d = camRelativeMove(0.7, 0.707, -0.707);
assert.ok(Math.hypot(d.x, d.z) <= 1.0001, 'diagonal tidak lebih cepat');

// Follow: bearing kamera = facing + PI
function behind(facing) { return facing + Math.PI; }
assert.ok(Math.abs(Math.sin(behind(0)) - 0) < 1e-9 && Math.abs(Math.cos(behind(0)) + 1) < 1e-9,
  'pemain hadap +Z -> kamera harus di -Z (di belakang)');

console.log('controls-check: OK (8 asersi)');
