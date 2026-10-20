# Kalkulus — Kalkulator Ilmiah

Kalkulator ilmiah berbasis web untuk menghitung ekspresi matematika, turunan, integral, dan menampilkan grafik fungsi. Seluruh perhitungan berjalan di sisi klien tanpa backend.

Antarmuka menggunakan bahasa Indonesia dengan gaya *scientific notebook*: panel kertas, tipografi editorial, dan grafik bergaya kertas milimeter.

## Fitur

- **Mode Kalkulator** — evaluasi ekspresi, dukungan fungsi trigonometri, logaritma, akar, faktorial, dan mode sudut RAD/DEG.
- **Mode Turunan** — turunan simbolik dengan langkah pengerjaan; turunan numerik sebagai fallback bila bentuk tertutup tidak tersedia.
- **Mode Integral** — integral tentu dengan metode Simpson komposit dan akselerasi Richardson, lengkap dengan perkiraan galat.
- **Grafik fungsi** — kurva fungsi, arsiran area integral, garis singgung, pembacaan nilai saat hover, pan, dan zoom.
- **Langkah perhitungan** — setiap mode menampilkan langkah yang dapat disalin.
- **Validasi ekspresi** — hanya fungsi, konstanta, dan operator yang diizinkan yang dapat dieksekusi.
- **Tema terang/gelap** — mengikuti preferensi sistem saat pertama kali dibuka, lalu disimpan di `localStorage`.
- **Responsif** — tata letak menyesuaikan layar ponsel, tablet, dan desktop.
- **Sepenuhnya offline untuk logika** — math.js disertakan secara lokal. Koneksi internet hanya diperlukan untuk memuat Google Fonts; tersedia fallback font sistem.

## Teknologi

- HTML5
- CSS3 (custom properties, grid, media queries)
- JavaScript vanilla (tanpa framework atau bundler)
- [math.js](https://mathjs.org/) 12.4.3 (lokal di `js/vendor/math.min.js`)
- Canvas API untuk grafik
- Google Fonts: Fraunces dan IBM Plex Mono

Tidak ada proses build, bundler, atau dependensi npm.

## Struktur Proyek

```text
Kalkulator ilmiah/
├── index.html              # Struktur halaman, tab mode, form, panel hasil, grafik
├── README.md
├── css/
│   └── styles.css          # Tema, tata letak, komponen, responsif
└── js/
    ├── vendor/
    │   └── math.min.js     # math.js 12.4.3
    ├── math-engine.js      # Parsing, validasi, turunan, integral, format angka
    ├── graph.js            # Rendering canvas, pan, zoom, hover, garis singgung
    └── app.js              # State UI, event, mode, contoh, tema, clipboard
```

### Tanggung Jawab Modul

| File | Peran |
| --- | --- |
| `js/math-engine.js` | Menormalisasi input, memvalidasi AST, mengevaluasi ekspresi, menghitung turunan simbolik/numerik, integral Simpson–Richardson, dan memformat hasil. |
| `js/graph.js` | Menggambar grid, kurva, area integral, garis singgung, serta menangani interaksi grafik. |
| `js/app.js` | Menghubungkan form, tab mode, keypad, contoh soal, tema, status, langkah, dan grafik. |

## Menjalankan

Tidak diperlukan instalasi dependensi.

### Opsi 1 — Server lokal

```bash
cd "Kalkulator ilmiah"
python3 -m http.server 8000
```

Buka `http://localhost:8000`.

### Opsi 2 — Ekstensi editor

Buka folder proyek di VS Code, lalu jalankan **Live Server**.

### Opsi 3 — Langsung membuka file

`index.html` juga dapat dibuka langsung di browser karena seluruh skrip bersifat klasik (bukan ES module). Namun server lokal lebih disarankan agar clipboard dan perilaku browser lain berjalan konsisten.

## Cara Menggunakan

### Kalkulator

1. Pilih tab **Kalkulator**.
2. Masukkan ekspresi, misalnya `2^10 + sqrt(81) - 5!`.
3. Pilih **RAD** atau **DEG** bila menggunakan fungsi trigonometri.
4. Tekan **Hitung** atau Enter.

Jika ekspresi mengandung `x`, kalkulator mengevaluasinya pada `x = 0`.

### Turunan

1. Pilih tab **Turunan**.
2. Masukkan fungsi, misalnya `x^3 - 2x + 1`.
3. Isi titik evaluasi bila ingin nilai turunan di titik tertentu, misalnya `1` atau `pi/2`.
4. Kosongkan titik evaluasi untuk hanya menampilkan turunan simbolik.
5. Tekan **Turunkan**.

Turunan dan integral selalu dihitung dalam radian, terlepas dari pengaturan RAD/DEG pada mode kalkulator.

### Integral

1. Pilih tab **Integral**.
2. Masukkan fungsi dan kedua batas.
3. Batas dapat berupa angka atau ekspresi seperti `pi/2`, `e`, atau `sqrt(2)`.
4. Tekan **Integralkan**.

Jika batas bawah lebih besar dari batas atas, aplikasi menukar batas dan memberi tanda pada hasil.

### Grafik

- **Gulir mouse** di atas grafik untuk zoom di sekitar kursor.
- **Tarik** grafik untuk menggeser tampilan.
- **Arahkan kursor** untuk membaca nilai `x` dan `f(x)`.
- Gunakan tombol **+**, **−**, dan **Reset** untuk mengatur tampilan.
- Pada mode turunan, garis singgung ditampilkan bila fungsi mulus di titik evaluasi.
- Pada mode integral, area di antara kurva dan sumbu `x` diarsir.

Grafik diperbarui otomatis saat ekspresi atau parameter berubah. Hasil dan langkah diperbarui saat tombol hitung ditekan atau chip contoh dipilih.

## Sintaks Ekspresi

### Operator

| Simbol | Keterangan |
| --- | --- |
| `+`, `-`, `*`, `/` | Operasi dasar |
| `^` atau `**` | Pangkat |
| `!` | Faktorial |
| `%` | Modulo |

Perkalian implisit didukung untuk bentuk seperti `2x`, `2(x+1)`, `(x+1)(x-1)`, dan `x(x+1)`.

### Konstanta

| Simbol | Keterangan |
| --- | --- |
| `x` | Variabel fungsi |
| `pi` | π |
| `e` | Bilangan Euler |
| `tau` | 2π |
| `Infinity` | Tak hingga |

### Fungsi yang Didukung

- Trigonometri: `sin`, `cos`, `tan`, `sec`, `csc`, `cot`
- Invers trigonometri: `asin`, `acos`, `atan`
- Hiperbolik: `sinh`, `cosh`, `tanh`, `asinh`, `acosh`, `atanh`
- Akar dan pangkat: `sqrt`, `cbrt`, `nthRoot`
- Logaritma: `ln` (log natural), `log` (basis 10), `log10`, `log2`
- Lainnya: `abs`, `exp`, `floor`, `ceil`, `round`, `sign`, `min`, `max`, `factorial`

Alias `arcsin`, `arccos`, dan `arctan` juga diterima. Simbol Unicode umum seperti `π`, `√`, `×`, `÷`, `−`, dan `²` dinormalisasi secara otomatis.

### Mode Sudut

Mode **DEG** hanya memengaruhi evaluasi pada mode Kalkulator dan grafik pratinjaunya. Fungsi trigonometri dan invers trigonometri dikonversi dari/ke derajat. Turunan dan integral tetap menggunakan radian.

## Metode Perhitungan

### Turunan Simbolik

1. Ekspresi di-parse dan divalidasi.
2. math.js menghitung turunan terhadap `x`.
3. Hasil disederhanakan bila memungkinkan.
4. Jika titik evaluasi diisi, hasil disubstitusikan ke titik tersebut.

Jika turunan simbolik tidak tersedia atau nilainya tidak berhingga di titik evaluasi, aplikasi memakai **beda hingga tengah** (*central difference*):

```text
f'(x) ≈ [f(x + h) - f(x - h)] / (2h)
```

Nilai `h` dipilih dari `cbrt(epsilon mesin)` dan skala titik evaluasi. Aplikasi juga membandingkan kemiringan kiri dan kanan untuk mendeteksi titik tidak mulus. Contoh: `abs(x)` di `x = 0` menghasilkan pesan bahwa turunan tidak terdefinisi, bukan `0`.

Turunan numerik hanya dapat digunakan jika titik evaluasi diisi.

### Integral

Integral dihitung dengan **Simpson komposit**:

```text
S = h/3 · [f(x₀) + 4f(x₁) + 2f(x₂) + ... + f(xₙ)]
```

- Jumlah interval awal: `n = 200`.
- `n` digandakan hingga maksimal 10 iterasi.
- Perhitungan berhenti bila perkiraan galat antar-iterasi ≤ `1e-9`.
- **Ekstrapolasi Richardson** digunakan bila pola galat teratur, untuk mempercepat konvergensi.
- `n` dan `h` yang ditampilkan adalah nilai yang benar-benar dipakai pada hasil terakhir.
- Hasil yang belum konvergen ditampilkan dengan presisi lebih rendah dan diberi catatan.

### Format Angka

- Hasil utama umumnya ditampilkan hingga 10 angka signifikan.
- Integral yang belum konvergen ditampilkan hingga 8 angka signifikan.
- Nilai sangat besar/kecil ditampilkan dalam notasi ilmiah.
- Nilai yang sangat dekat dengan nol dibulatkan menjadi `0`.

## Batasan

- Hanya bilangan **real** yang didukung; bilangan kompleks tidak didukung.
- Integral tak wajar (*improper integral*) dan titik singular pada batas interval dapat menghasilkan galat.
- Metode numerik dapat gagal atau tidak akurat pada fungsi yang sangat berosilasi, diskontinu, atau berubah sangat cepat.
- Deteksi titik tidak mulus pada turunan numerik bersifat heuristik.
- Turunan simbolik bergantung pada kemampuan math.js; beberapa fungsi hanya dapat dihitung secara numerik di titik tertentu.
- Mode kalkulator selalu mengevaluasi variabel `x` pada `0`.
- Grafik menyesuaikan rentang `y` menggunakan sampel persentil 4–96, sehingga ekor kurva yang ekstrem dapat terpotong; gunakan zoom/pan untuk memeriksanya.
- Tidak ada riwayat perhitungan, penyimpanan server, atau akun pengguna. Tema adalah satu-satunya preferensi yang disimpan di browser.
- Membutuhkan browser modern yang mendukung Canvas, Pointer Events, dan ResizeObserver.

## Aksesibilitas dan Pintasan

- **Enter** pada form menjalankan perhitungan.
- **Escape** di kolom ekspresi menghapus isi ekspresi.
- **Panah kiri/kanan**, **Home**, dan **End** memindahkan fokus antar tab mode.
- Tombol keypad menyisipkan teks pada posisi kursor.
- Tombol **Salin** menyalin langkah perhitungan ke clipboard.
- Atribut dan role ARIA diterapkan pada tab, panel hasil, dan grafik.
- Tema mengikuti `prefers-color-scheme` saat pertama kali dibuka dan dapat diubah manual.

## Pengujian

Proyek ini tidak memiliki test runner otomatis. Pemeriksaan sintaks dapat dilakukan dengan Node.js:

```bash
node --check js/math-engine.js
node --check js/graph.js
node --check js/app.js
```

Uji manual yang disarankan:

| Mode | Input | Hasil yang diharapkan |
| --- | --- | --- |
| Kalkulator | `2^10 + sqrt(81) - 5!` | `913` |
| Kalkulator, DEG | `sin(30)` | `0.5` |
| Turunan | `x^3 - 2x + 1`, titik `1` | `f'(1) = 1` |
| Turunan | `abs(x)`, titik `0` | Galat: turunan tidak terdefinisi |
| Integral | `sqrt(x)`, batas `0` sampai `4` | `5.333333333` |
| Integral | `x^2`, batas `1` sampai `0` | `−0.3333333333`, batas ditukar |

Uji juga tema terang/gelap, lebar layar ponsel, zoom/reset grafik, dan tombol salin langkah.

## Kredit

- [math.js](https://mathjs.org/) — parsing, evaluasi, dan turunan simbolik.
- Google Fonts — Fraunces dan IBM Plex Mono.

Lisensi proyek ini belum ditentukan secara eksplisit.
