# PROMPT: GHOSTDASH — Pasar Malam Arwah
### Game 3D Browser, Frontend-Only, Minim Aset (HTML + CSS + JavaScript)

---

## 0. Cara Memakai Dokumen Ini

Dokumen ini adalah prompt lengkap untuk AI coding. Urutannya sengaja: **konsep game dulu (nama, tema, karakter, aturan main), baru teknis program**.

**Mode A: Sekali jadi.** Paste seluruh dokumen, lalu tulis: *"Bangun game ini lengkap sesuai dokumen. Mulai dari ringkasan rencana singkat, lalu kode lengkap."*

**Mode B: Bertahap (disarankan, hasil lebih stabil).** Paste seluruh dokumen sekali, lalu kerjakan per fase di Bagian 14:

```
Kerjakan FASE 1 saja sesuai dokumen. Jangan lanjut ke fase berikutnya
sebelum saya bilang "lanjut fase 2". Berikan kode lengkap (bukan potongan),
lalu centang item checklist (Bagian 15) yang sudah terpenuhi.
```

---

## 1. Peran dan Tujuan untuk AI

Kamu adalah **game developer web senior** sekaligus **art director** yang ahli Three.js, desain game loop, UX mobile, dan optimasi performa.

Tujuan: membangun game 3D yang **berjalan hanya dengan membuka `index.html`** di browser (tanpa server, tanpa build tool, tanpa backend), memakai **aset eksternal sesedikit mungkin**. Semua visual dibuat **prosedural** (geometri primitif Three.js, canvas texture, CSS) dan semua suara dibuat dengan **Web Audio API**.

Prinsip yang tidak boleh dilanggar:

1. Tidak ada file gambar, model 3D, font, atau audio eksternal. Semua dihasilkan lewat kode.
2. Satu-satunya dependensi eksternal yang diizinkan adalah **Three.js** dari CDN.
3. Game harus **seru dalam 30 detik pertama** dan bisa dimainkan **di HP maupun desktop**.
4. Jangan menulis placeholder seperti `// TODO`, `// isi sendiri`, atau `...`. Semua kode harus lengkap dan jalan.

---

## 2. Ringkasan Game

| Item | Isi |
|---|---|
| **Nama game** | **GHOSTDASH** |
| **Subjudul** | Pasar Malam Arwah |
| **Tagline** | *"Antar pesanan arwah sebelum subuh. Rating bintang 5, atau kena prank."* |
| **Genre** | 3D open-world mini, delivery arcade, cozy-spooky (seram yang lucu, bukan horor) |
| **Target pemain** | Remaja dan dewasa muda (15–28 tahun), pemain kasual, sesi singkat |
| **Durasi 1 sesi** | 3–5 menit per "Malam" |
| **Platform** | Browser desktop dan mobile (landscape disarankan, portrait tetap bisa) |
| **Eksplorasi** | Dunia 3D yang bisa dijelajahi bebas, kamera orbit **360 derajat** |
| **Inspirasi mekanik** | Trick-or-treat 3D (jelajahi area, ambil, kasih "treat" atau kena "trick"), digabung dengan budaya **ojol / aplikasi antar makanan** yang dekat dengan anak muda |
| **Gaya visual** | Low-poly flat shading + neon emissive + kabut malam, palet pasar malam Indonesia |
| **Bahasa UI** | Bahasa Indonesia santai (gaul ringan, tidak norak) |

### Pilar Desain (jadi patokan setiap keputusan)

1. **Relatable.** Memakai pengalaman yang dikenal anak muda: notifikasi pesanan, timer, rating bintang, tip, combo, akun disuspend.
2. **Wow instan.** Layar judul sudah menampilkan dunia 3D yang berputar 360 derajat dengan lampion dan kunang-kunang.
3. **Eksplorasi dihargai.** Menyimpang dari rute selalu ada hadiahnya (kunang-kunang, spot rahasia).
4. **Lucu, bukan menyeramkan.** Tidak ada darah, jumpscare, atau suara kaget keras.
5. **Ringan dan cepat.** Loading nol detik, kontrol langsung paham, restart satu tombol.

---

## 3. Tema, Lore, dan Mood

### Lore singkat
Setiap malam Jumat Kliwon, di ujung desa muncul **Pasar Malam Arwah**: pasar yang hanya terlihat oleh orang yang kebetulan punya motor butut dan kuota tipis. Para arwah penghuninya tidak bisa meninggalkan tempat mereka menunggu, tapi mereka **sangat kelaparan jajan**. Karena itu mereka memakai aplikasi antar bernama **GHOSTDASH**.

Kamu adalah **kurir baru** yang butuh duit (dan konten). Aturannya sederhana: antar semua pesanan **sebelum subuh**. Begitu matahari terbit, pasar menghilang. Kalau ratingmu jatuh terlalu rendah, **akunmu disuspend** dan kamu diusir dari pasar.

### Mood dan nuansa
- **Hangat dan misterius:** lampion, bohlam gantung, uap makanan, kunang-kunang, bunyi jangkrik.
- **Humor ringan:** arwah yang cerewet soal pesanan, ulasan bintang satu yang dramatis.
- **Rasa waktu yang bergerak:** langit berubah dari ungu gelap ke jingga fajar selama permainan. Ini sekaligus menjadi timer visual.

### Palet warna (pakai konsisten)

| Peran | Hex |
|---|---|
| Langit malam atas | `#0B1026` |
| Langit malam bawah | `#2A1B4D` |
| Langit fajar | `#FF8A5B` → `#FFD9A0` |
| Neon magenta | `#FF3DA5` |
| Neon cyan | `#3DF2FF` |
| Amber lampion | `#FFC24D` |
| Mint kunang-kunang | `#7CFFB2` |
| Tanah gelap | `#1B1A2E` |
| Jalan setapak | `#3A2F4B` |
| Teks UI | `#F5F3FF` |

---

## 4. Dunia Game (Peta Eksplorasi 360°)

Satu peta melingkar, radius sekitar **70 unit**, bisa dijelajahi bebas. Pusat peta di `(0, 0)`.

### Landmark (12 titik tujuan antar, semuanya punya nama untuk UI)

| # | Nama | Posisi kasar | Ciri visual |
|---|---|---|---|
| 1 | **Gapura Masuk** | Selatan `(0, 60)` | Gerbang kayu, dua lampion besar, titik spawn pemain |
| 2 | **Pohon Beringin** | Pusat `(0, 0)` | Pohon raksasa, sulur menjuntai, lingkaran lampion di bawahnya |
| 3 | **Panggung Wayang** | `(0, -12)` | Panggung kecil dengan layar bayangan bercahaya |
| 4 | **Pos Ronda** | Barat `(-40, 10)` | Gardu kayu, kentongan, lampu kuning redup |
| 5 | **Jembatan Bambu** | Utara `(0, -45)` | Jembatan di atas sungai kecil, rel bambu |
| 6 | **Sawah Cahaya** | Timur `(45, -10)` | Petak padi dengan kunang-kunang melimpah |
| 7 | **Gang Gelap** | Barat laut `(-35, -30)` | Lorong sempit antar bangunan, hanya diterangi lampion sporadis |
| 8 | **Kolam Teratai** | Timur laut `(35, -35)` | Kolam dengan teratai bercahaya cyan |
| 9 | **Bangku Taman** | `(-20, 30)` | Bangku dan lampu taman rusak berkedip |
| 10 | **Menara Air** | `(30, 25)` | Tangki air tinggi, spot untuk melihat seluruh pasar |
| 11 | **Warung Pojok** | `(50, 35)` | Warung kecil dengan neon "BUKA 24 JAM (ARWAH)" |
| 12 | **Tikungan Lampion** | `(-48, -8)` | Tikungan jalan dengan deretan lampion bergoyang |

### Cincin lapak makanan (titik ambil pesanan)

**8 lapak** tersusun melingkar di sekitar pusat (radius sekitar 24 unit), diberi nomor 1–8. Setiap lapak menjual satu jenis item:

| Lapak | Item | Ikon UI |
|---|---|---|
| 1, 6 | Es Teh Jumbo | 🧋 |
| 2, 7 | Sate Ayam | 🍢 |
| 3 | Martabak Manis | 🥞 |
| 4 | Kopi Tubruk | ☕ |
| 5, 8 | Bakso Urat | 🍜 |

Tiap lapak punya: atap miring bergaris, meja, uap (partikel), papan nama neon, dan **cincin cahaya di tanah** (radius interaksi) yang menyala saat ada pesanan yang cocok.

### Elemen dunia lain
- **Sungai kecil** di utara dengan satu jembatan (sisi lain ditutup pagar bambu dan kabut).
- **Batas dunia:** pagar bambu + pepohonan rapat + kabut tebal. Pemain tidak bisa keluar.
- **Kunang-kunang kolektibel** tersebar (target 40 titik), lebih banyak di Sawah Cahaya dan Gang Gelap.
- **Spot rahasia (3 buah):** misalnya cincin lampion tersembunyi di atas Menara Air, ruang kecil di balik Panggung Wayang, dan pohon dengan wajah tersenyum. Memberi bonus besar dan pencapaian.
- **Dekorasi hidup:** lampion bergoyang tertiup angin, asap dari lapak, jangkrik, kelelawar yang melintas, bayangan wayang yang bergerak di layar.

### Siklus langit (timer visual "Subuh")
Progress `p = waktuBerjalan / durasiMalam` (0 sampai 1):

| p | Langit | Suasana |
|---|---|---|
| 0.00 | Ungu gelap, bintang penuh, bulan | Tenang |
| 0.50 | Biru indigo, bulan turun | Tengah malam, **event spesial** |
| 0.85 | Ungu → jingga di cakrawala, bintang meredup | Mulai tegang |
| 1.00 | Jingga hangat, matahari muncul, kabut keemasan | **SUBUH** |

Warna kabut, cahaya hemisfer, dan intensitas lampion ikut berubah mengikuti `p`.

---

## 5. Karakter

Semua karakter dibuat dari **primitif Three.js** (silinder, bola, kotak, kerucut) dengan flat shading. **Dilarang memakai `CapsuleGeometry`** (tidak ada di versi Three.js yang dipakai).

### 5.1 Pemain: Raka / Nala (pilih satu di layar judul)
- Kurir muda, tinggi sekitar 1.7 unit, proporsi chibi (kepala besar).
- **Raka:** jaket oranye neon, topi hitam. **Nala:** jaket magenta, rambut dikuncir. (Cukup beda warna dan satu bentuk rambut/topi.)
- **Tas box di punggung** yang menyala cyan. Intensitas cahaya naik saat membawa pesanan, dan tumpukan item kecil terlihat menyembul.
- Animasi: berayun saat jalan (lengan dan kaki bergerak sinus), membungkuk saat lari, melompat kecil saat sukses mengantar, goyang saat kena prank.
- Suara langkah sederhana (bunyi klik pendek dari Web Audio).

### 5.2 Pendamping: Kunang
- Bola cahaya mint seukuran bola tenis yang melayang di dekat bahu pemain.
- **Fungsi game:** menunjuk arah tujuan (terbang sedikit ke arah target), memberi petunjuk tutorial lewat bubble teks singkat.
- **Kepribadian:** santai, sedikit sarkastis, suportif. Contoh kalimat:
  - "Pesanan masuk! Jangan sampai es tehnya jadi es batu."
  - "Bintang lima itu gampang, asal jangan nyasar ke Gang Gelap."
  - "Tenang, arwah itu sabar. Kebanyakan."

### 5.3 Pelanggan Gaib (tujuan antar)
Tubuh semi-transparan berpendar, melayang (bobbing), mata dua bola gelap, tanpa kaki (ujung bawah meruncing).

| Karakter | Bentuk | Sifat | Reward |
|---|---|---|---|
| **Bocil Gaib** | Kecil, bulat, warna cyan | Tidak sabar (timer pendek), lincah | Tip kecil, combo cepat |
| **Om Gembul** | Besar, bulat, warna amber | Sabar, pesan 2 item sekaligus | Tip besar |
| **Mbak Lampion** | Tinggi, kepalanya lampion menyala | **Bergerak pelan** (target berpindah) | Tip sedang, + kunang-kunang |
| **Eyang Wayang** | Siluet pipih bergaya wayang, warna ungu | Muncul jarang, pesanan misterius | Bonus besar + lore |

Setiap pelanggan menampilkan **bubble pesanan** (emoji item + sisa waktu) di atas kepalanya.

### 5.4 Pengganggu: Wisp Usil
- Bola cahaya biru-ungu kecil dengan wajah jahil (dua titik + senyum), melayang cepat.
- Bukan musuh jahat: mereka **iseng**. Kalau nabrak pemain, pemain terdorong dan **kena prank** (lihat Bagian 7.6).
- Bisa dihentikan sementara dengan **Lentera Kilat**.

### 5.5 NPC dekor (opsional, nilai tambah)
- **Penjual lapak** (siluet manusia di balik meja yang menggoyang spatula).
- **Kucing hitam** yang kadang duduk di atap lapak dan menoleh mengikuti pemain.

---

## 6. Alur Permainan (Game Flow)

```
BOOT → TITLE → (TUTORIAL, hanya pertama kali) → PLAY → END → (ulang / ganti Malam)
                      ↑                           │
                      └────────── PAUSE ←─────────┘
```

### 6.1 Layar judul (TITLE)
- Dunia 3D tampil di belakang menu, kamera **berputar 360° otomatis** pelan di sekitar pusat pasar.
- Tombol: **Main**, **Pilih Karakter** (Raka/Nala), **Cara Main**, **Pengaturan**.
- Pilihan Malam (1, 2, 3, Endless) tampil setelah Main. Malam yang belum terbuka ditandai gembok.
- Menampilkan skor terbaik per Malam (dari localStorage).

### 6.2 Tutorial interaktif (3 langkah, hanya sekali)
1. **Gerak dan kamera:** "Gerakkan karakter dan putar kamera, ikuti Kunang ke Lapak 1."
2. **Ambil pesanan:** dekati lapak yang bercahaya, tekan tombol aksi.
3. **Antar ke pelanggan:** ikuti panah penunjuk, tekan aksi di dekat pelanggan.
Tutorial berakhir dengan pesanan pertama yang sukses dan hadiah kunang-kunang.

### 6.3 Gameplay (PLAY)
1. Pemain mulai di Gapura Masuk, jam menunjukkan malam.
2. **Pesanan masuk** lewat notifikasi bergaya aplikasi (kartu di sisi layar).
3. Pemain ke lapak yang menjual item itu, **ambil**, lalu **antar** ke pelanggan di titik tujuan sebelum timer pesanan habis.
4. Selama perjalanan: kumpulkan kunang-kunang, hindari Wisp Usil, jelajahi spot rahasia.
5. **Event tengah malam** (p = 0.5): muncul **Gerobak Hantu Emas** selama 25 detik. Pesanan lewat gerobak ini bernilai 2×.
6. Langit mulai fajar. Tempo naik di akhir malam.
7. Permainan selesai saat **Subuh** (p = 1) atau saat **akun disuspend** (rating < 2.0).

### 6.4 Layar akhir (END)
- **Menang (Subuh tercapai):** judul "SUBUH! Shift selesai ☀️", grade **S / A / B / C**, total penghasilan, jumlah pesanan sukses, combo terbaik, kunang-kunang terkumpul, rating akhir.
- **Kalah (disuspend):** judul "Akun Disuspend 💀 (Bintang terlalu sedikit)", pesan lucu dari Kunang, tombol **Coba Lagi**.
- Tombol: **Main Lagi**, **Pilih Malam**, **Simpan Kartu Skor** (membuat gambar PNG lewat canvas, bisa dibagikan).

---

## 7. Mekanik Permainan (Detail)

### 7.1 Sistem pesanan
- Pesanan baru dibuat dengan: `item`, `lapakAsal`, `pelanggan`, `titikTujuan`, `batasWaktu`.
- **Maksimal pesanan aktif bersamaan** ditentukan per Malam (lihat 7.8).
- Aturan penentuan tujuan: jarak lapak ke tujuan minimal 25 unit, tujuan tidak boleh sedang dipakai pesanan lain, utamakan variasi tujuan.
- Batas waktu pesanan:
  ```
  batasWaktu = clamp( (jarak / kecepatanJalan) * 1.6 + 15 , 35 , 90 ) * pengali_kesabaran
  ```
  Pengali kesabaran: Bocil 0.8, Mbak Lampion 1.0, Om Gembul 1.25, Eyang Wayang 1.1.

### 7.2 Ambil dan antar (tombol Aksi)
- **Ambil:** dekat lapak (radius 2.2) dan ada pesanan aktif yang butuh item lapak itu dan belum diambil, tekan Aksi. Item masuk tas (kapasitas **3**).
- **Antar (Treat):** dekat pelanggan (radius 2.5), item cocok ada di tas, tekan Aksi.
- Jika tidak ada pesanan yang cocok, tampilkan toast singkat ("Lapak ini bukan buat pesananmu").

### 7.3 "Kasih Asal" (inti Trick-or-Treat)
Tombol kedua (**Q** / tombol "Kasih Asal"): memberikan **item apa saja** dari tas ke pelanggan walau tidak cocok.
- **35%** sukses sebagai "treat kecil" (reward 50%, tidak memutus combo).
- **65%** gagal → **TRICK**: kena prank, combo putus, rating turun.
Ini adalah keputusan berisiko yang menyenangkan saat timer hampir habis.

### 7.4 Rating (gaya rating kurir)
- Mulai di **5.0**, batas atas 5.0, batas bawah 0.
- Antar tepat waktu: **+0.05**. Antar cepat (sisa waktu > 50%): **+0.08**.
- Antar telat (lewat timer tapi masih diterima, hanya Om Gembul): **−0.15**.
- Pesanan kedaluwarsa (timer habis): **−0.4**.
- Trick (Kasih Asal gagal): **−0.3**.
- Tertabrak Wisp Usil saat membawa pesanan: **−0.1**.
- **Rating < 2.0 = akun disuspend (game over).**

### 7.5 Skor, tip, dan combo
```
skorDasar     = 100 * jumlahItem
tip           = round(50 * (sisaWaktu / batasWaktu))
pengaliCombo  = 1 + 0.25 * min(comboAktif, 16)      // maksimal x5
skorPesanan   = (skorDasar + tip) * pengaliCombo * pengaliEvent
```
- Combo naik +1 setiap Treat berturut-turut, reset saat Trick atau pesanan kedaluwarsa.
- Mata uang ditampilkan sebagai **Rp** (contoh "Rp 245.000"): skor × 100 hanya untuk tampilan.
- **Kunang-kunang:** +10 skor, +2 detik ke waktu pesanan aktif tertua (bukan ke timer Subuh).

### 7.6 Prank (Trick)
Pilih acak satu per kejadian. **Tidak ada dua prank bertumpuk**, dan ada **kekebalan 15 detik** setelahnya.

| Prank | Efek | Durasi |
|---|---|---|
| **Kontrol Kebalik** | Arah gerak kiri/kanan terbalik, label UI "Waduh 🙃" | 3 detik |
| **Tas Bocor** | Satu item di tas jatuh dan hilang (pesanan itu harus diambil ulang) | Instan |
| **Layar Miring** | Kamera miring dan goyang pelan | 3 detik |
| **Lengket** | Kecepatan jalan −40%, jejak lendir lucu di tanah | 4 detik |

Aturan aman: tidak ada kilatan cepat di atas 3 Hz, ada opsi **Kurangi Gerakan** yang mematikan goyang kamera dan kemiringan.

### 7.7 Aksi pemain
- **Jalan:** 5.0 unit/detik. **Lari:** 8.5 unit/detik.
- **Stamina:** 100 maksimum, lari menguras 25/detik, pulih 15/detik (jeda 0.8 detik sebelum pulih). Jika habis, wajib jalan sampai pulih 30.
- **Lompat kecil / dash:** Spasi. Dash pendek 4 unit, cooldown 3 detik (membantu menghindari Wisp Usil).
- **Lentera Kilat (F):** pulsa cahaya radius 10. **Membuat Wisp Usil membeku 4 detik** dan membuat kunang-kunang terdekat tertarik ke pemain. Cooldown 8 detik.

### 7.8 Kesulitan per Malam

| Parameter | Malam 1 | Malam 2 | Malam 3 | Endless |
|---|---|---|---|---|
| Durasi | 180 d | 240 d | 300 d | Sampai disuspend |
| Jenis item aktif | 2 | 4 | 5 | 5 |
| Pesanan aktif maks | 1 | 2 | 3 | 3 |
| Jeda pesanan baru | 25 d | 18 d | 12 d | 12 → 7 d (turun bertahap) |
| Wisp Usil | 1 (lambat) | 2 | 4 | 4 → 8 |
| Pelanggan khusus | Bocil, Om | + Mbak Lampion | + Eyang Wayang | Semua |
| Event | Tengah malam | Tengah malam | Tengah malam + **Hujan** | Acak berkala |
| Target Grade S | Rp 120.000 | Rp 260.000 | Rp 450.000 | Skor tertinggi |

**Hujan (Malam 3):** partikel garis hujan, suara hujan sintetis, kecepatan jalan −10%, genangan mengkilap (cukup efek warna, tanpa refleksi nyata).

### 7.9 Perilaku AI (finite state machine)
**Pelanggan:** `Idle` → `Menunggu` (bubble + timer) → `Puas` (berputar, partikel hati/bintang, memudar) atau `Marah` (merah singkat, pergi). Mbak Lampion punya state `Berpindah` (menuju titik baru tiap 20–30 detik, bubble ikut).

**Wisp Usil:** `Berkeliaran` → `Mendeteksi` (jarak < 12 dan pemain tidak terkena Lentera Kilat) → `Mengejar` (kecepatan 0.8× lari pemain) → `Menabrak` (dorong pemain 3 unit, picu prank) → `Kabur` 5 detik → ulang. Saat `Beku` (kena Lentera), berhenti dan berkedip.

### 7.10 Pencapaian (disimpan di localStorage)
- **Bintang Lima Beneran:** selesaikan Malam tanpa rating turun dari 5.0.
- **Si Paling Nyasar:** masuk Gang Gelap 3 kali dalam satu malam.
- **Pemburu Kunang:** kumpulkan 40 kunang-kunang dalam satu Malam.
- **Nekat Total:** 3 "Kasih Asal" sukses berturut-turut.
- **Rahasia Pasar:** temukan 3 spot rahasia.
- **Subuh Tanpa Lecet:** selesaikan Malam tanpa kena prank sekali pun.

---

## 8. Kontrol dan Kamera

### 8.1 Kontrol desktop
| Aksi | Tombol |
|---|---|
| Gerak | **W A S D** atau panah |
| Kamera 360° | Gerak mouse (pointer lock setelah klik layar) atau **tahan klik kiri dan drag** bila pointer lock ditolak |
| Zoom kamera | Scroll mouse (jarak 3–10 unit) |
| Lari | **Shift** |
| Aksi (ambil/antar) | **E** |
| Kasih Asal | **Q** |
| Dash / lompat | **Spasi** |
| Lentera Kilat | **F** |
| Jeda | **Esc** atau **P** |
| Mute | **M** |

### 8.2 Kontrol mobile (touch)
- **Joystick virtual kiri-bawah** untuk gerak (DOM + Pointer Events, mendukung multi-touch lewat `pointerId`).
- **Geser di separuh layar kanan** untuk memutar kamera 360°.
- **Tombol kanan-bawah:** `AKSI` (besar), `KASIH ASAL`, `LENTERA`, `DASH`, dan toggle `LARI`.
- Ukuran target sentuh minimal **48 px**. Cegah scroll, zoom, dan context-menu bawaan browser (`touch-action: none`).

### 8.3 Kamera
- **Third-person orbit** mengikuti pemain: jarak default 6, FOV 65, pitch dibatasi −10° sampai 60°, yaw bebas penuh 360°.
- Gerak karakter **relatif terhadap arah kamera**.
- Kamera mengalami smoothing (lerp) agar halus, dan tidak boleh menembus tanah.
- Di layar judul: orbit otomatis. Saat `END`: orbit pelan mengelilingi pemain.
- **Mode lihat-sekeliling (opsional):** tahan tombol tertentu untuk mengubah ke sudut pandang orang pertama sesaat (berguna di Menara Air).

---

## 9. UI / HUD / Copywriting

### 9.1 Elemen HUD
- **Kiri atas:** rating ⭐ (misal `4.85`) dan penghasilan `Rp 245.000` beserta indikator combo `x2.5`.
- **Tengah atas:** **Bar Subuh**, ikon bulan 🌙 di kiri berubah ke matahari ☀️ di kanan seiring progress `p`.
- **Kanan atas:** tombol jeda dan mute.
- **Kiri tengah:** **kartu pesanan** (maks 3). Isi: ikon item, nama tujuan, ring/bar sisa waktu yang berubah dari mint → amber → magenta.
- **Tengah bawah:** prompt kontekstual, misal `[E] Ambil Es Teh` / `[E] Antar ke Om Gembul`.
- **Marker 3D:** ikon melayang di atas lapak/target + jarak dalam meter. Jika target di luar layar, tampilkan **panah di tepi layar** ke arah target.
- **Indikator tas:** 3 slot item.
- **Indikator cooldown** Dash dan Lentera berbentuk ring melingkar.

### 9.2 Gaya UI
- Kartu membulat (radius 16px), latar gelap semi-transparan, blur halus, garis neon tipis.
- Tipografi sistem (`system-ui`), judul kapital dengan letter-spacing lebar, angka tebal.
- Animasi masuk-keluar singkat (200–300 ms). Hormati `prefers-reduced-motion`.
- Warna tidak boleh menjadi satu-satunya pembeda: item selalu punya **emoji + bentuk**.

### 9.3 Contoh teks (nada: santai, tidak norak)
- Notifikasi: `📲 Pesanan baru! Es Teh Jumbo → Pos Ronda`
- Sukses: `Bintang 5! ⭐ +Rp 18.500`
- Combo: `Combo x3, lagi on fire 🔥`
- Prank: `Kena prank 😭`, `Tasmu bocor!`
- Pesanan hangus: `Pesanan hangus. Rating turun 😬`
- Subuh: `Ayam berkokok. Pasar mulai hilang...`
- Suspend: `Akunmu disuspend. Mungkin arwahnya salah download aplikasi.`

---

## 10. Audio (100% sintetis via Web Audio API)

- Audio baru dijalankan setelah **interaksi pertama** pengguna (kebijakan autoplay browser).
- **Ambience:** jangkrik (noise tersaring + LFO), angin lembut. Hujan di Malam 3 (white noise + filter).
- **Musik latar:** loop pendek bernuansa **gamelan sederhana** (tangga nada pentatonik slendro/pelog) dengan oscillator, tempo naik halus saat p mendekati 1.
- **SFX:** ambil item (ping naik), antar sukses (arpeggio ceria), combo (nada naik tiap level), prank (bunyi "boing" kartun), Lentera Kilat (sweep), kunang-kunang (kilau kecil), notifikasi pesanan (dua nada), langkah kaki (klik tumpul).
- **Wisp Usil mendekat:** ritme detak halus yang menguat (bukan menakutkan, lebih seperti "awas!").
- Volume master dan tombol mute, tersimpan di pengaturan.

---

## 11. Kebijakan Aset ("Minim Aset")

| Kategori | Cara |
|---|---|
| Model 3D | Dibangun dari primitif (`Box`, `Cylinder`, `Sphere`, `Cone`, `Icosahedron`, `Plane`, `Torus`). **Bukan** `CapsuleGeometry`. |
| Tekstur | `CanvasTexture` hasil gambar via kode: garis atap lapak, noise tanah, gradien radial untuk glow, wajah hantu |
| Glow / bloom | Dipalsukan dengan **sprite additive** berisi gradien radial (tanpa post-processing) |
| Ikon UI | Emoji + CSS + SVG inline |
| Font | `system-ui` bawaan perangkat |
| Audio | Web Audio API |
| Gambar kartu skor | Dibuat lewat `<canvas>` saat diminta |
| Dependensi | **Hanya Three.js** dari CDN |

---

## 12. Spesifikasi Teknis Program

### 12.1 Stack dan struktur file
```
ghostdash/
├─ index.html      // kerangka, canvas, elemen UI/HUD, memuat CDN Three.js
├─ style.css       // seluruh gaya UI, responsif, safe-area, reduced-motion
└─ game.js         // seluruh logika game (satu IIFE, 'use strict')
```
Aturan wajib:
- **Three.js r128** dari cdnjs, versi dikunci (tanpa `@latest`):
  ```html
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  ```
- Memakai **script klasik** (bukan `type="module"`) supaya bisa dibuka langsung lewat `file://` tanpa error CORS.
- Karena r128: pakai `renderer.outputEncoding = THREE.sRGBEncoding`, **tidak** ada `CapsuleGeometry`, **tidak** ada `OrbitControls` (kamera orbit dibuat sendiri), tidak memakai `outputColorSpace`.
- Tag viewport: `width=device-width, initial-scale=1, viewport-fit=cover`.
- Sertakan `<noscript>` dan pesan error ramah bila WebGL tidak tersedia atau CDN gagal dimuat.

### 12.2 Arsitektur kode (bagian dalam `game.js`, berurutan)
1. **`CONFIG`**: satu objek untuk semua angka penting (kecepatan, radius, durasi, warna, jumlah objek). Tidak ada "angka ajaib" tersebar.
2. **Utils**: `clamp`, `lerp`, `lerpAngle`, `damp`, RNG ber-seed (mulberry32) agar dunia konsisten, helper warna.
3. **State machine**: `BOOT | TITLE | TUTORIAL | PLAY | PAUSE | END`, tiap state punya `enter`, `update`, `exit`.
4. **Input**: keyboard, mouse (pointer lock + drag fallback), touch joystick, abstraksi `input.move`, `input.look`, `input.pressed.action`, dst.
5. **Audio**: `AudioEngine` (init lazy, master gain, helper `beep`, `noise`, `playSfx(name)`, `startAmbience`, `setMusicTempo`).
6. **Renderer dan Scene**: setup, resize handler, adaptive quality.
7. **Sky**: sphere gradien (`ShaderMaterial` / vertex color), bintang (`Points`), bulan, matahari, interpolasi palet berdasarkan `p`.
8. **World builder**: fungsi per objek (`buildStall`, `buildBanyan`, `buildGapura`, `buildBridge`, `buildRiver`, `buildRice`, `buildLanterns`, `buildFence`, dst.).
9. **Entities**: `Player`, `Companion (Kunang)`, `Customer`, `Wisp`, `Stall`, `Firefly`, `Cat`.
10. **Systems**: `OrderSystem`, `ScoreSystem`, `EventSystem` (tengah malam, hujan), `PrankSystem`, `CollisionSystem`, `ParticleSystem`, `AchievementSystem`.
11. **UI**: HUD updater, toast queue, marker 3D → layar, panah tepi layar, layar judul/jeda/akhir, kartu skor canvas.
12. **Save**: `localStorage` untuk skor terbaik, Malam terbuka, pengaturan, pencapaian (semua dibungkus `try/catch` karena bisa diblokir).
13. **Debug**: aktif jika URL berisi `?debug=1`.
14. **Main loop**: `requestAnimationFrame`, `dt` di-clamp maksimal 0.05 detik.

### 12.3 Contoh `CONFIG` (nilai awal, boleh disetel ulang)
```js
const CONFIG = {
  world: { radius: 70, fogNear: 20, fogFar: 95 },
  player: { walk: 5.0, run: 8.5, radius: 0.5, stamina: 100, drain: 25, regen: 15, bag: 3 },
  camera: { fov: 65, dist: 6, distMin: 3, distMax: 10, pitchMin: -10, pitchMax: 60, smooth: 8 },
  interact: { stall: 2.2, customer: 2.5 },
  dash: { distance: 4, cooldown: 3 },
  lantern: { radius: 10, freeze: 4, cooldown: 8 },
  rating: { start: 5, fail: 2.0 },
  fireflies: 40,
  quality: { maxPixelRatio: 1.75, shadowMap: 1024, maxPointLights: 4 }
};
```

### 12.4 Detail rendering Three.js
- `WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })`, `setPixelRatio(Math.min(devicePixelRatio, CONFIG.quality.maxPixelRatio))`.
- `scene.fog = new THREE.Fog(warna, near, far)`, warna ikut siklus langit.
- **Pencahayaan:**
  - `HemisphereLight` lembut (warna langit/tanah).
  - `DirectionalLight` sebagai bulan, **bayangan hanya di sekitar pemain** (shadow camera ikut pemain, map 1024).
  - **Maksimal 4 `PointLight` aktif**, dipindah ke lampion terdekat pemain. Sisa lampion cukup **emissive + sprite glow**.
- **Material:** `MeshStandardMaterial` dengan `flatShading: true` untuk dunia; `MeshBasicMaterial` untuk lampion/neon; `MeshToonMaterial` boleh untuk karakter.
- **InstancedMesh** untuk objek berulang: lampion, rumput/padi, pagar bambu, bintang, kunang-kunang, lampu string. Tujuannya menekan draw call.
- **Resep prosedural singkat:**
  - *Lapak:* kotak alas + 2 tiang + atap miring (BoxGeometry diputar) bertekstur garis canvas + meja + papan nama neon + 2–3 lampion + partikel uap.
  - *Pohon Beringin:* batang silinder kasar + banyak sulur (silinder tipis memanjang) + gugus daun dari `IcosahedronGeometry` flat shading.
  - *Gapura:* dua tiang kayu + balok atas + lampion besar menggantung.
  - *Sungai:* plane dengan `ShaderMaterial` sederhana (warna bergeser + kilau).
  - *Padi:* instanced bidang tipis, goyang lewat vertex shader atau update matriks ringan.
  - *Hantu:* silinder meruncing + bola kepala, material transparan (`opacity ≈ 0.75`, emissive), bobbing sinus.
- **Hujan (Malam 3):** `LineSegments` / `Points` yang didaur ulang di sekitar kamera.
- **Anggaran performa:** target **60 FPS** di HP menengah, draw call **< 250**, segitiga **< 300 ribu**.
- **Adaptive quality:** bila rata-rata FPS < 40 selama 3 detik, turunkan bertahap: pixel ratio → bayangan off → jarak fog dipendekkan → kurangi partikel.

### 12.5 Fisika dan tabrakan (tanpa library fisika)
- Dunia datar (`y = 0`), kecuali sedikit tinggi di jembatan.
- Collider: **lingkaran** `{x, z, r}` dan **AABB** untuk bangunan. Disimpan dalam **spatial hash grid** (sel 10 unit) agar query murah.
- Resolusi: dorong keluar dari collider + **sliding** sepanjang dinding.
- Batas dunia: lingkaran radius dunia, pemain didorong lembut ke dalam.
- Kunang-kunang dan marker memakai pengecekan jarak sederhana (kuadrat jarak, tanpa `sqrt` bila memungkinkan).

### 12.6 Loop game
```
frame:
  dt = min((now - last)/1000, 0.05)
  input.update()
  state.update(dt)          // logika sesuai state
  world.update(dt, p)       // langit, angin, partikel, animasi dekor
  ui.update(dt)             // HUD, marker, toast
  renderer.render(scene, camera)
```
- Otomatis **jeda** saat tab tidak aktif (`visibilitychange`) dan saat jendela kehilangan fokus.
- **Restart tanpa reload halaman:** fungsi `resetRun()` membersihkan entity, timer, dan state tanpa membocorkan event listener atau memori (`dispose()` untuk geometri/material/texture yang dibuat ulang).

### 12.7 Aksesibilitas dan kualitas
- Pengaturan: volume, sensitivitas kamera, **Kurangi Gerakan**, kualitas grafis (Rendah/Sedang/Tinggi/Auto).
- Teks HUD minimal 16px, kontras tinggi.
- Semua aksi punya alternatif keyboard dan sentuh.
- Dukungan **safe-area** (notch) via `env(safe-area-inset-*)`.
- Kode: nama variabel/fungsi bahasa Inggris, **teks UI bahasa Indonesia**, komentar ringkas pada bagian yang tidak jelas dengan sendirinya.
- Tidak ada variabel global di luar IIFE selain yang dibutuhkan untuk debug.

### 12.8 Mode debug (`?debug=1`)
- Overlay FPS, `renderer.info` (draw calls, triangles).
- Tombol `1–8` teleport ke lapak, `[` `]` tambah/kurangi waktu 30 detik, `G` mode kebal, `K` munculkan Wisp.

---

## 13. Format Output yang Diminta

1. **Ringkasan rencana** (maksimal 15 baris): fase yang dikerjakan, struktur, keputusan penting.
2. **Kode lengkap** tiga file: `index.html`, `style.css`, `game.js`, masing-masing dalam code block terpisah dengan nama file jelas.
3. **Cara menjalankan** (1–2 baris: buka `index.html`).
4. **Checklist** (Bagian 15) yang sudah dicentang `[x]` untuk yang terpenuhi, dan alasan singkat untuk yang belum.
5. **Parameter yang mudah disetel** (daftar field `CONFIG` yang paling berpengaruh terhadap rasa permainan).

---

## 14. Fase Pengerjaan

### FASE 1: Fondasi dan "Wow" (target: dunia bisa dijelajahi)
- Struktur file, renderer, kamera orbit 360°, input desktop + mobile.
- Dunia prosedural: tanah, Beringin, 8 lapak, Gapura, sungai + jembatan, lampion, pagar batas, kabut.
- Pemain (model + animasi jalan), kolisi dasar, langit bergradien + bintang.
- Layar judul dengan orbit otomatis.
- **Selesai bila:** bisa berjalan keliling dunia dengan mulus di desktop dan HP.

### FASE 2: Inti gameplay
- Sistem pesanan, ambil/antar, Kasih Asal, rating, skor, combo.
- Pelanggan Gaib (Bocil, Om Gembul), Kunang pendamping, kunang-kunang kolektibel.
- HUD lengkap, marker 3D, panah tepi layar, tutorial 3 langkah.
- Siklus langit sebagai timer, layar akhir (menang/kalah).
- **Selesai bila:** satu Malam bisa dimainkan dari awal sampai akhir.

### FASE 3: Tantangan dan variasi
- Wisp Usil + FSM, Lentera Kilat, Dash, stamina, 4 jenis prank.
- Mbak Lampion, Eyang Wayang, event tengah malam (Gerobak Emas), Malam 2 dan 3, hujan, Endless.
- Spot rahasia dan pencapaian.

### FASE 4: Polish
- Audio sintetis lengkap (ambience, musik gamelan, SFX).
- Partikel (uap, sparkle, hati), NPC dekor, kucing, kelelawar.
- Kartu skor PNG, pengaturan, penyimpanan lokal, adaptive quality, mode debug.
- Perapihan UI, animasi mikro, pengecekan seluruh checklist.

---

## 15. CHECKLIST

> Prioritas: **[M]** Must, **[S]** Should, **[C]** Could. Centang `[x]` saat selesai.

### 15.1 Konsep dan identitas
- [ ] [M] Nama **GHOSTDASH: Pasar Malam Arwah** tampil di layar judul
- [ ] [M] Tagline tampil di layar judul
- [ ] [M] Tema pasar malam Indonesia terasa jelas (lampion, lapak, gapura, beringin)
- [ ] [M] Nuansa lucu-seram, tanpa darah dan tanpa jumpscare
- [ ] [M] Teks UI berbahasa Indonesia santai, konsisten

### 15.2 Dunia dan visual
- [ ] [M] Dunia 3D melingkar yang bisa dijelajahi bebas
- [ ] [M] Kamera orbit **360°** (yaw bebas, pitch dibatasi)
- [ ] [M] 8 lapak bernomor dan bergaris atap, dengan cincin interaksi bercahaya
- [ ] [M] 12 landmark tujuan dapat dikenali dan bernama
- [ ] [M] Pohon Beringin, Gapura, Sungai + Jembatan, pagar batas
- [ ] [M] Fog malam + batas dunia yang natural
- [ ] [M] Langit berubah malam → fajar mengikuti progress
- [ ] [M] Lampion dan neon bersinar (emissive + sprite glow)
- [ ] [S] Bintang, bulan, dan matahari terbit
- [ ] [S] Lampion bergoyang, asap lapak, kelelawar melintas
- [ ] [S] Sawah Cahaya dan Kolam Teratai
- [ ] [C] Bayangan dinamis di sekitar pemain
- [ ] [C] Genangan dan efek hujan di Malam 3

### 15.3 Karakter
- [ ] [M] Pemain (Raka/Nala) dengan animasi jalan, lari, dan sukses
- [ ] [M] Pemilihan karakter di layar judul
- [ ] [M] Kunang (pendamping) menunjuk arah dan memberi petunjuk
- [ ] [M] Minimal 2 tipe pelanggan: Bocil Gaib dan Om Gembul
- [ ] [M] Wisp Usil dengan perilaku mengejar
- [ ] [S] Mbak Lampion (target bergerak)
- [ ] [S] Eyang Wayang (pesanan misterius)
- [ ] [C] Kucing hitam dan penjual lapak sebagai dekor

### 15.4 Gameplay
- [ ] [M] Pesanan baru muncul berkala dengan notifikasi
- [ ] [M] Ambil item di lapak, bawa di tas (kapasitas 3), antar ke pelanggan
- [ ] [M] Timer per pesanan dan efek saat hangus
- [ ] [M] Rating, penghasilan, tip, dan combo bekerja sesuai rumus
- [ ] [M] Kalah saat rating < 2.0, menang saat Subuh
- [ ] [M] Mekanik **Kasih Asal** (35% treat / 65% trick)
- [ ] [M] Minimal 3 jenis prank, tanpa penumpukan, dengan kekebalan 15 detik
- [ ] [M] Kunang-kunang kolektibel
- [ ] [S] Stamina + lari
- [ ] [S] Dash dan Lentera Kilat dengan cooldown
- [ ] [S] Event tengah malam (Gerobak Hantu Emas)
- [ ] [S] Malam 1, 2, 3 dengan tingkat kesulitan berbeda
- [ ] [S] Tutorial interaktif 3 langkah (sekali saja)
- [ ] [S] 3 spot rahasia
- [ ] [C] Mode Endless
- [ ] [C] Pencapaian

### 15.5 Kontrol
- [ ] [M] Keyboard: WASD/panah, Shift, E, Q, Spasi, F, Esc/P, M
- [ ] [M] Kamera mouse (pointer lock + fallback drag)
- [ ] [M] Joystick virtual + geser kamera + tombol aksi di mobile
- [ ] [M] Multi-touch berjalan (gerak dan kamera bersamaan)
- [ ] [M] Tidak ada scroll/zoom/context-menu yang mengganggu di mobile
- [ ] [S] Scroll untuk zoom kamera
- [ ] [S] Sensitivitas kamera bisa diatur

### 15.6 UI / HUD
- [ ] [M] Rating, penghasilan, combo
- [ ] [M] Bar Subuh (bulan → matahari)
- [ ] [M] Kartu pesanan dengan ikon, tujuan, dan timer
- [ ] [M] Prompt aksi kontekstual
- [ ] [M] Marker 3D target + jarak
- [ ] [M] Panah tepi layar ke target di luar layar
- [ ] [M] Layar judul, jeda, dan akhir (menang/kalah)
- [ ] [S] Indikator tas, cooldown ring, toast
- [ ] [S] Kartu skor PNG yang bisa diunduh
- [ ] [C] Layar pencapaian

### 15.7 Audio
- [ ] [M] Audio mulai setelah interaksi pertama, ada tombol mute
- [ ] [M] SFX: ambil, antar sukses, prank, notifikasi pesanan
- [ ] [S] Ambience jangkrik dan angin
- [ ] [S] Musik gamelan sintetis, tempo naik menjelang subuh
- [ ] [S] Detak halus saat Wisp Usil mendekat
- [ ] [C] Suara hujan dan langkah kaki

### 15.8 Teknis dan performa
- [ ] [M] Berjalan dengan membuka `index.html` langsung (tanpa server)
- [ ] [M] Hanya satu dependensi eksternal: Three.js r128 (versi dikunci)
- [ ] [M] **Nol** aset eksternal lain (gambar, model, font, audio)
- [ ] [M] Tidak memakai `CapsuleGeometry` dan `OrbitControls`
- [ ] [M] `CONFIG` terpusat, tidak ada angka ajaib tersebar
- [ ] [M] Kolisi lingkaran/AABB dengan sliding
- [ ] [M] Jeda otomatis saat tab tidak aktif
- [ ] [M] Restart tanpa reload, tanpa kebocoran listener/memori
- [ ] [M] Pesan error ramah bila WebGL/CDN gagal
- [ ] [S] InstancedMesh untuk objek berulang
- [ ] [S] Spatial hash untuk collider
- [ ] [S] Adaptive quality (turun otomatis saat FPS < 40)
- [ ] [S] localStorage dibungkus `try/catch`
- [ ] [S] Mode debug `?debug=1`
- [ ] [C] Bayangan dinamis dengan shadow camera mengikuti pemain

### 15.9 Aksesibilitas dan keamanan konten
- [ ] [M] Tidak ada kilatan cepat > 3 Hz
- [ ] [S] Opsi **Kurangi Gerakan** (mematikan goyang/miring kamera)
- [ ] [S] Item dibedakan oleh emoji + bentuk, bukan hanya warna
- [ ] [S] Teks HUD ≥ 16px dengan kontras tinggi
- [ ] [S] Dukungan safe-area di perangkat berponi

### 15.10 QA (uji sebelum dianggap selesai)
- [ ] [M] Uji satu Malam penuh sampai Subuh di desktop
- [ ] [M] Uji satu Malam penuh di HP (portrait dan landscape)
- [ ] [M] Uji kalah karena rating < 2.0, lalu Coba Lagi
- [ ] [M] Uji semua prank, memastikan tidak ada yang membuat game tersangkut
- [ ] [M] Uji resize/rotasi layar, kamera dan HUD tetap benar
- [ ] [M] Uji jeda lalu lanjut, timer tidak melompat
- [ ] [S] Uji tab berpindah lalu kembali
- [ ] [S] Uji 10 menit bermain tanpa penurunan FPS atau lonjakan memori
- [ ] [S] Tidak ada error di console saat bermain normal

---

## 16. Definition of Done

Game dianggap selesai bila:

1. Semua item **[M]** di Bagian 15 tercentang.
2. Dibuka dari `index.html` di Chrome desktop dan satu browser HP, langsung bisa dimainkan tanpa konfigurasi.
3. Pemain baru paham cara main **tanpa membaca apa pun** dalam 30 detik pertama.
4. Satu Malam (3 menit) terasa seru: ada tujuan, ada risiko, ada hadiah eksplorasi, ada ending yang jelas.
5. Tidak ada aset eksternal selain Three.js dari CDN.

---

*Catatan akhir untuk AI: jika ada bagian yang tidak muat dalam satu respons, selesaikan fase yang sedang dikerjakan dengan lengkap dan fungsional, lalu beri tahu apa yang tersisa. Jangan memotong kode di tengah dan jangan memberi pseudo-code sebagai pengganti implementasi.*
