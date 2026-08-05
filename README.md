# Shopee Review Scraper (Python + Selenium)

Tools scraping ulasan produk Shopee interaktif berbasis Python & Selenium dengan dukungan **QR Code Login**.

## 🌟 Fitur Utama
1. **Pencarian Berdasarkan Keyword**: Cukup masukkan kata kunci (contoh: `kopi ulubelu lampung`), scraper akan mencari produk relevan di Shopee.
2. **Pemilihan Produk Interaktif**: Menampilkan tabel produk lengkap (Nama, Harga, Terjual, Rating). Anda bisa memilih 1 produk, beberapa produk (`1,2,3`), atau semua produk (`all`).
3. **Session & QR Code Login Persistence**: Browser Chrome akan terbuka. Jika belum login, Anda bisa scan QR code sekali saja di Shopee. Sesi login tersimpan secara permanen di folder `./shopee_profile/` sehingga tidak perlu QR login berulang kali.
4. **Data Ulasan 100% Lengkap**:
   - Username Pembeli / Reviewer
   - Rating Bintang (1 - 5)
   - Tanggal & Waktu Ulasan (Format `YYYY-MM-DD HH:MM:SS`)
   - Variasi Produk yang Dibeli (misal: `250g / Fine`)
   - Teks Komentar Ulasan
   - Link Foto & Video Ulasan (URL media beresolusi tinggi)
   - Respon/Balasan dari Penjual
5. **Multi-Format Export**: Simpan hasil scraping ke file **Excel (`.xlsx`)**, **CSV**, atau **JSON** secara otomatis di folder `./output/`.

---

## 🚀 Cara Penggunaan

### 1. Install Dependencies
Buka terminal / Command Prompt di folder projek dan jalankan:
```bash
pip install -r requirements.txt
```

### 2. Jalankan Program
```bash
python main.py
```

### 3. Alur Penggunaan
1. **Masukkan Keyword**: Ketik kata kunci produk (misal: `kopi ulubelu lampung`).
2. **Pilih Produk**: Ketik nomor produk dari tabel hasil pencarian.
3. **QR Code Login**: Browser Chrome akan terbuka. Jika diminta login, lakukan scan QR Code pada aplikasi Shopee di HP Anda.
4. **Proses Scraping**: Program akan mengunduh ulasan dan menampilkan indikator kemajuan.
5. **Download Hasil**: Pilih format export (`excel`, `csv`, atau `json`). File hasil akan tersimpan di folder `./output/`.

---

## 📁 Struktur Direktori Projek
```
shopee-scraping-ulasan/
├── shopee_profile/      # Folder profil Chrome (penyimpan sesi QR login)
├── output/              # Folder tempat menyimpan hasil scraping (Excel/CSV/JSON)
├── src/
│   ├── browser.py       # Pengelola browser Selenium & QR login
│   ├── scraper.py       # Mesin pencari produk & pengambil ulasan
│   └── exporter.py      # Pengolah ekspor data ke Excel/CSV/JSON
├── tests/               # Pengujian unit test
├── main.py              # Antarmuka CLI utama
├── requirements.txt     # Daftar dependensi Python
└── README.md            # Dokumentasi panduan
```
