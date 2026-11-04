# CHECKLIST GHOSTDASH — status per fase

Legenda: `[x]` selesai · `[ ]` belum · **[M]** must · **[S]** should · **[C]** could
Diperbarui: FASE 1 selesai (commit `0c4a35f`).

## 15.1 Konsep dan identitas
- [x] [M] Nama **GHOSTDASH: Pasar Malam Arwah** tampil di layar judul
- [x] [M] Tagline tampil di layar judul
- [x] [M] Tema pasar malam Indonesia terasa jelas (lampion, lapak, gapura, beringin)
- [x] [M] Nuansa lucu-seram, tanpa darah dan tanpa jumpscare
- [x] [M] Teks UI berbahasa Indonesia santai, konsisten

## 15.2 Dunia dan visual
- [x] [M] Dunia 3D melingkar yang bisa dijelajahi bebas
- [x] [M] Kamera orbit **360°** (yaw bebas, pitch dibatasi)
- [x] [M] 8 lapak bernomor dan bergaris atap, dengan cincin interaksi bercahaya
- [x] [M] 12 landmark tujuan dapat dikenali dan bernama
- [x] [M] Pohon Beringin, Gapura, Sungai + Jembatan, pagar batas
- [x] [M] Fog malam + batas dunia yang natural
- [x] [M] Langit berubah malam → fajar mengikuti progress
- [x] [M] Lampion dan neon bersinar (emissive + sprite glow)
- [x] [S] Bintang, bulan, dan matahari terbit
- [x] [S] Lampion bergoyang, asap lapak
- [x] [S] Sawah Cahaya dan Kolam Teratai
- [x] [C] Bayangan dinamis di sekitar pemain
- [ ] [C] Genangan dan efek hujan di Malam 3  → FASE 3
- [ ] [S] Kelelawar melintas  → FASE 4

## 15.3 Karakter
- [x] [M] Pemain (Raka/Nala) dengan animasi jalan dan lari
- [ ] [M] Pemain — animasi sukses mengantar  → FASE 2
- [x] [M] Pemilihan karakter di layar judul
- [x] [M] Kunang (pendamping) melayang mengikuti pemain
- [ ] [M] Kunang menunjuk arah tujuan + bubble petunjuk  → FASE 2
- [ ] [M] Minimal 2 tipe pelanggan: Bocil Gaib dan Om Gembul  → FASE 2
- [ ] [M] Wisp Usil dengan perilaku mengejar  → FASE 3
- [ ] [S] Mbak Lampion (target bergerak)  → FASE 3
- [ ] [S] Eyang Wayang (pesanan misterius)  → FASE 3
- [x] [C] Kucing hitam sebagai dekor (menoleh ke pemain)
- [ ] [C] Penjual lapak menggoyang spatula  → FASE 4

## 15.4 Gameplay
- [ ] [M] Pesanan baru muncul berkala dengan notifikasi  → FASE 2
- [ ] [M] Ambil item di lapak, bawa di tas (kapasitas 3), antar ke pelanggan  → FASE 2
- [ ] [M] Timer per pesanan dan efek saat hangus  → FASE 2
- [ ] [M] Rating, penghasilan, tip, dan combo bekerja sesuai rumus  → FASE 2
- [ ] [M] Kalah saat rating < 2.0, menang saat Subuh  → FASE 2
- [ ] [M] Mekanik **Kasih Asal** (35% treat / 65% trick)  → FASE 2
- [ ] [M] Minimal 3 jenis prank  → FASE 3
- [ ] [M] Kunang-kunang kolektibel  → FASE 2
- [ ] [S] Stamina + lari  → FASE 3
- [ ] [S] Dash dan Lentera Kilat dengan cooldown  → FASE 3
- [ ] [S] Event tengah malam (Gerobak Hantu Emas)  → FASE 3
- [ ] [S] Malam 1, 2, 3 dengan tingkat kesulitan berbeda  → FASE 3
- [ ] [S] Tutorial interaktif 3 langkah (sekali saja)  → FASE 2
- [ ] [S] 3 spot rahasia  → FASE 3
- [ ] [C] Mode Endless  → FASE 3
- [ ] [C] Pencapaian  → FASE 3

## 15.5 Kontrol
- [x] [M] Keyboard: WASD/panah, Shift (lari); E/Q/Spasi/F/Esc/P/M terikat (aksi aktif di FASE 2-3)
- [x] [M] Kamera mouse (pointer lock + fallback drag)
- [x] [M] Joystick virtual + geser kamera + tombol aksi di mobile
- [x] [M] Multi-touch berjalan (gerak dan kamera bersamaan)
- [x] [M] Tidak ada scroll/zoom/context-menu yang mengganggu di mobile
- [x] [S] Scroll untuk zoom kamera
- [x] [S] Sensitivitas kamera bisa diatur

## 15.6 UI / HUD
- [x] [M] Rating, penghasilan, combo (tampil; nilainya diisi FASE 2)
- [x] [M] Bar Subuh (bulan → matahari)
- [ ] [M] Kartu pesanan dengan ikon, tujuan, dan timer  → FASE 2
- [x] [M] Prompt aksi kontekstual (komponen siap)
- [ ] [M] Marker 3D target + jarak  → FASE 2
- [ ] [M] Panah tepi layar ke target di luar layar  → FASE 2
- [x] [M] Layar judul, jeda, dan akhir (kerangka; isi statistik di FASE 2)
- [x] [S] Indikator tas, cooldown ring, toast
- [ ] [S] Kartu skor PNG yang bisa diunduh  → FASE 4
- [ ] [C] Layar pencapaian  → FASE 4

## 15.7 Audio
- [x] [M] Audio mulai setelah interaksi pertama, ada tombol mute
- [ ] [M] SFX: ambil, antar sukses, prank, notifikasi pesanan  → ikut FASE 2-3
- [x] [S] Ambience jangkrik (noise tersaring + LFO)
- [ ] [S] Musik gamelan sintetis, tempo naik menjelang subuh  → FASE 4
- [ ] [S] Detak halus saat Wisp Usil mendekat  → FASE 3
- [ ] [C] Suara hujan dan langkah kaki  → hujan FASE 3, langkah sudah ada

## 15.8 Teknis dan performa
- [x] [M] Berjalan dengan membuka `index.html` langsung (tanpa server)
- [x] [M] Hanya satu dependensi eksternal: Three.js r128 (versi dikunci)
- [x] [M] **Nol** aset eksternal lain (gambar, model, font, audio)
- [x] [M] Tidak memakai `CapsuleGeometry` dan `OrbitControls`
- [x] [M] `CONFIG` terpusat, tidak ada angka ajaib tersebar
- [x] [M] Kolisi lingkaran/AABB dengan sliding
- [x] [M] Jeda otomatis saat tab tidak aktif
- [x] [M] Restart tanpa reload (`Game.reset`), handler didaftarkan sekali di `bindMenu`
- [x] [M] Pesan error ramah bila WebGL/CDN gagal
- [x] [S] InstancedMesh untuk objek berulang (lampion, pagar, pepohonan, padi, teratai)
- [x] [S] Spatial hash untuk collider
- [ ] [S] Adaptive quality (turun otomatis saat FPS < 40)  → FASE 4
- [x] [S] localStorage dibungkus `try/catch`
- [x] [S] Mode debug `?debug=1` (FPS, draw call, triangle, posisi, progress)
- [x] [C] Bayangan dinamis dengan shadow camera mengikuti pemain

## 15.9 Aksesibilitas dan keamanan konten
- [x] [M] Tidak ada kilatan cepat > 3 Hz
- [x] [S] Opsi **Kurangi Gerakan** (mematikan goyang/miring kamera)
- [x] [S] Item dibedakan oleh emoji + bentuk, bukan hanya warna
- [x] [S] Teks HUD ≥ 16px dengan kontras tinggi
- [x] [S] Dukungan safe-area di perangkat berponi

## 15.10 QA
- [x] [M] Uji boot tanpa error konsol + layar judul tampil (Chrome headless, WebGL2/SwiftShader)
- [x] [M] Uji satu Malam berjalan: progres langit, timer, jeda/lanjut, gerak pemain, kolisi batas
- [x] [M] Uji resize/rotasi layar (handler `resize` + `orientationchange`)
- [x] [M] Uji jeda lalu lanjut, progres tidak melompat
- [ ] [M] Uji satu Malam penuh sampai Subuh di desktop (perlu main manual; belum ada aturan menang sampai FASE 2)
- [ ] [M] Uji satu Malam penuh di HP (portrait dan landscape)
- [ ] [M] Uji kalah karena rating < 2.0  → FASE 2
- [ ] [M] Uji semua prank  → FASE 3
- [ ] [S] Uji tab berpindah lalu kembali
- [ ] [S] Uji 10 menit bermain tanpa penurunan FPS (headless hanya 20 FPS — angka tidak representatif)
- [x] [S] Tidak ada error di console saat bermain normal (`window.__errs` kosong)

## Catatan FASE 1
- Bug ditemukan & diperbaiki saat uji: yaw awal kamera salah arah; pencarian lampion terdekat melakukan `sort()` penuh tiap frame; bayangan pemain tidak mengikuti tier kualitas.
- FASE 1 sengaja tidak mengaktifkan aturan menang/kalah; langit berputar ulang dengan toast agar dunia bisa dijelajahi.
