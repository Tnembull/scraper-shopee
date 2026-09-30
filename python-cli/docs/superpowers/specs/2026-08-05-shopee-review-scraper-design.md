# Design Specification: Shopee Review Scraper

**Date**: 2026-08-05  
**Target Project Directory**: `/home/bulindev/Desktop/scraping/shopee-scraping-ulasan`  
**Tech Stack**: Python 3.10+, Selenium / Undetected-ChromeDriver, Requests, Pandas, OpenPyXL, Rich

---

## 1. Executive Summary
Tools scraping data ulasan produk Shopee interaktif berbasis Python & Selenium. Pengguna dapat memasukkan kata kunci pencarian (misal: "kopi ulubelu lampung"), memilih produk dari hasil pencarian, dan mengekstrak seluruh ulasan produk beserta metadata lengkapnya. Dukungan QR Code login memastikan sesi akun pengguna tersimpan secara permanen pada browser profile lokal (`./shopee_profile`).

---

## 2. System Architecture & Modules

```
shopee-scraping-ulasan/
├── shopee_profile/              # Directory for persistent Chrome browser profile (cookies/session)
├── output/                      # Directory for scraped CSV/Excel/JSON results
├── src/
│   ├── __init__.py
│   ├── browser.py               # Handles Selenium ChromeDriver setup & QR login detection
│   ├── scraper.py               # Handles keyword search & review extraction (API + fallback)
│   └── exporter.py              # Export functions (CSV, Excel, JSON)
├── docs/
│   └── superpowers/
│       └── specs/
│           └── 2026-08-05-shopee-review-scraper-design.md
├── main.py                      # Interactive CLI Entrypoint (Rich terminal UI)
├── requirements.txt             # Project dependencies
└── README.md                    # Usage documentation
```

### Module Responsibilities

1. **`src/browser.py`**:
   - Initializes Chrome browser with `user-data-dir=./shopee_profile`.
   - Handles login detection: Checks if user is logged into Shopee. If not, prompts user to scan QR Code in the opened browser window.
   - Preserves session cookies for subsequent automated requests.

2. **`src/scraper.py`**:
   - `search_products(keyword, limit=20)`: Navigates to Shopee search or queries API to fetch product search results (Item ID, Shop ID, Product Title, Price, Sold Count, Rating, URL).
   - `fetch_reviews(item_id, shop_id, limit=None)`: Retrieves all customer reviews using Shopee's internal ratings endpoint with session cookies, falling back to Selenium DOM pagination if needed. Extracted fields:
     - Item ID & Product Name
     - Reviewer Username
     - Rating Score (1 - 5 stars)
     - Review Timestamp (YYYY-MM-DD HH:MM:SS)
     - Product Variation (Model name)
     - Review Text Comment
     - Media Attachments (Photo/Video URLs)
     - Seller Reply Text (if present)

3. **`src/exporter.py`**:
   - Formats scraped review records into pandas DataFrames.
   - Saves datasets to `./output/` in CSV, Excel (`.xlsx`), or JSON formats with timestamped filenames.

4. **`main.py`**:
   - Uses `rich` for rich terminal UI (styled tables, color prompts, progress bars).
   - Interactive flow:
     1. Prompt user for search keyword.
     2. Display table of matching products.
     3. Prompt user to choose product(s) (by index number or 'all').
     4. Check/handle QR login via Selenium.
     5. Scrape reviews with progress updates.
     6. Export data to output file.

---

## 3. Data Schema

| Field Name | Type | Description |
|---|---|---|
| `item_id` | String | Unique ID produk Shopee |
| `product_name` | String | Judul nama produk |
| `reviewer` | String | Username pembeli / pengulas |
| `rating` | Integer | Jumlah bintang ulasan (1 - 5) |
| `review_date` | String | Tanggal dan waktu ulasan |
| `variation` | String | Variasi produk yang dibeli (misal: "250gr / Fine") |
| `comment` | String | Teks isi ulasan |
| `media_urls` | String | URL gambar / video ulasan (separated by comma) |
| `seller_reply` | String | Balasan/respon dari toko penjual |

---

## 4. Error Handling & Edge Cases
- **Anti-Bot / CAPTCHA**: Handled seamlessly by using `undetected-chromedriver` and real user Chrome session with QR login.
- **Empty Reviews**: If a product has no reviews, the scraper gracefully logs a notice and moves to the next selected product.
- **Network Timeout / Retry**: Automatic retry mechanism (up to 3 attempts) with backoff delay for API requests.

---

## 5. Verification Plan
1. Test Chrome profile creation and QR login persistence.
2. Test keyword search for `"kopi ulubelu lampung"` and verify product table parsing.
3. Test review scraping for a selected product and verify data field completeness.
4. Verify file export to CSV and Excel in `./output/`.
