# Shopee Review Scraper Suite (Python CLI & Chrome Extension)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Python: 3.10+](https://img.shields.io/badge/Python-3.10+-blue.svg)](https://www.python.org/)
[![Chrome Extension](https://img.shields.io/badge/Chrome_Extension-Manifest_V3-orange.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Code Style: Flake8](https://img.shields.io/badge/code%20style-pep8-brightgreen.svg)](https://www.python.org/dev/peps/pep-0008/)

All-in-one suite untuk scraping ulasan dan data produk Shopee Indonesia dengan dua pilihan implementasi: **Python CLI (Automation)** dan **Chrome Extension (GUI Manifest V3)**.

---

## 🎯 Pilih Solusi yang Sesuai Kebutuhan Anda

| Fitur / Karakteristik | 🐍 Python CLI (`python-cli/`) | 🧩 Chrome Extension (`chrome-extension/`) |
| :--- | :--- | :--- |
| **Target Pengguna** | Data Analyst, Developer, Peneliti | Pengguna Kasual, Merchant, Business Owner |
| **Metode Akses** | Terminal / Command Line | Popup Browser Google Chrome |
| **Autentikasi** | QR Code Login & Persistent Session | Otomatis mengikuti sesi login browser Anda |
| **Format Ekspor** | Excel (`.xlsx`), CSV, JSON | CSV (UTF-8 BOM, Excel-friendly) |
| **Fitur Khusus** | Batch search & multi-product selection | Dashboard rating filter (Positif/Netral/Negatif) |

---

## 📦 1. Chrome Extension (Manifest V3)

Ekstensi browser Chrome modern untuk mengambil komentar langsung dari tab produk Shopee yang sedang Anda buka.

### Fitur Utama:
- **Clean Light Mode**: Antarmuka modern, responsif, dan mudah dipahami.
- **Rating Filtering**: Filter ulasan berdasarkan sentimen: Semua, Positif (4-5★), Netral (3★), atau Negatif (1-2★).
- **Abort Controller**: Hentikan proses scraping sewaktu-waktu tanpa kehilangan data ulasan yang sudah terambil.
- **Ekspor Cepat**: Ekspor ke CSV dengan penamaan file otomatis sesuai nama produk, atau salin langsung ke clipboard.

### Cara Penggunaan:
1. Buka `chrome://extensions` di Google Chrome.
2. Aktifkan **Developer mode** di pojok kanan atas.
3. Klik tombol **Load unpacked**, lalu pilih folder `chrome-extension/`.
4. Buka halaman produk Shopee di browser, klik ikon ekstensi di toolbar, dan tekan **Mulai Scraping**.

---

## 🐍 2. Python CLI & Selenium Automation

Engine otomatisasi headless/interaktif berbasis Python dan Selenium untuk scraping data skala besar.

### Fitur Utama:
- **Pencarian Berdasarkan Keyword**: Cukup masukkan kata kunci produk, CLI akan menampilkan daftar produk relevan dalam bentuk tabel interaktif.
- **Persistent QR Code Login**: Cukup scan QR code Shopee sekali; sesi login otomatis disimpan di `./shopee_profile/` untuk penggunaan berikutnya.
- **Metadata Ulasan Komprehensif**:
  - Username pengulas
  - Rating bintang (1 - 5)
  - Timestamp ulasan (`YYYY-MM-DD HH:MM:SS`)
  - Variasi produk yang dibeli
  - Komentar teks lengkap
  - URL foto & video resolusi tinggi
  - Balasan / respon dari penjual
- **Multi-Format Export**: Ekspor otomatis ke folder `output/` dalam format `.xlsx`, `.csv`, atau `.json`.

### Cara Penggunaan:
1. Masuk ke direktori CLI:
   ```bash
   cd python-cli
   ```
2. Pasang library yang dibutuhkan:
   ```bash
   pip install -r requirements.txt
   ```
3. Jalankan CLI:
   ```bash
   python main.py
   ```
4. Masukkan keyword pencarian, pilih nomor produk yang ingin di-scrape, dan tentukan format ekspor hasil.

---

## 📁 Struktur Monorepo

```text
scraper-shopee/
├── chrome-extension/         # Source code Google Chrome Extension (Manifest V3)
│   ├── manifest.json         # Extension manifest configuration
│   ├── popup.html            # User interface popup
│   ├── popup.js              # State & DOM event handlers
│   ├── content.js            # Injected DOM scraping engine
│   └── background.js         # Service worker & message passing
│
├── python-cli/               # Source code Python Automation CLI
│   ├── src/                  # Browser manager, scraping engine & exporter
│   ├── tests/                # Unit test suites
│   ├── main.py               # Main CLI interactive launcher
│   └── requirements.txt      # Python dependencies
│
├── .github/workflows/        # Automated CI/CD quality pipelines
├── CONTRIBUTING.md           # Panduan kontribusi komunitas
├── LICENSE                   # Open Source MIT License
└── README.md                 # Dokumentasi utama
```

---

## 🤝 Kontribusi

Pull Request dan kontribusi selalu diterima dengan hangat! Silakan cek panduan di [CONTRIBUTING.md](CONTRIBUTING.md) sebelum mengajukan perubahan.

---

## 📄 Lisensi & Disclaimer

Proyek ini dilisensikan di bawah **[MIT License](LICENSE)**.

*Disclaimer: Proyek ini dibuat semata-mata untuk tujuan riset, edukasi, dan analisis data. Harap selalu mematuhi Syarat & Ketentuan serta robots.txt Shopee. Gunakan dengan bijak dan bertanggung jawab.*
