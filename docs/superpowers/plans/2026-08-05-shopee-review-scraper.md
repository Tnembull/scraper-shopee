# Shopee Review Scraper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an interactive Python + Selenium tool to search Shopee products by keyword, select target products, extract customer reviews with complete metadata (including QR code login support), and export datasets to CSV/Excel/JSON.

**Architecture:** A modular Python CLI application consisting of a Selenium Browser Manager with persistent Chrome profile, a Scraper module using session cookies for Shopee review endpoints, a Data Exporter module, and a Rich-powered CLI user interface.

**Tech Stack:** Python 3.10+, Selenium, undetected-chromedriver, requests, pandas, openpyxl, rich.

## Global Constraints
- Target Directory: `/home/bulindev/Desktop/scraping/shopee-scraping-ulasan`
- Chrome User Data Directory: `./shopee_profile`
- Output Directory: `./output/`
- All network and scrape tasks must support graceful retry and error handling.

---

### Task 1: Environment & Dependency Setup

**Files:**
- Create: `requirements.txt`
- Create: `src/__init__.py`

- [ ] **Step 1: Create requirements.txt**

```text
selenium>=4.18.0
undetected-chromedriver>=3.5.5
requests>=2.31.0
pandas>=2.2.0
openpyxl>=3.1.2
rich>=13.7.0
```

- [ ] **Step 2: Create src package init**

```python
# src/__init__.py
"""Shopee Review Scraper Package"""
```

- [ ] **Step 3: Commit setup**

```bash
git init
git add requirements.txt src/__init__.py
git commit -m "chore: initial project structure and requirements"
```

---

### Task 2: Browser & Profile Manager (`src/browser.py`)

**Files:**
- Create: `src/browser.py`
- Create: `tests/test_browser.py`

**Interfaces:**
- Produces: `ShopeeBrowserManager` class with `get_driver()`, `ensure_login()`, `get_session_cookies()`, `close()` methods.

- [ ] **Step 1: Write test for browser profile initialization**

```python
# tests/test_browser.py
import os
import pytest
from src.browser import ShopeeBrowserManager

def test_browser_manager_init():
    manager = ShopeeBrowserManager(profile_dir="./test_profile", headless=True)
    assert os.path.exists("./test_profile")
    manager.close()
```

- [ ] **Step 2: Implement ShopeeBrowserManager in `src/browser.py`**

```python
# src/browser.py
import os
import time
import requests
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By

class ShopeeBrowserManager:
    def __init__(self, profile_dir="./shopee_profile", headless=False):
        self.profile_dir = os.path.abspath(profile_dir)
        os.makedirs(self.profile_dir, exist_ok=True)
        
        options = uc.ChromeOptions()
        options.add_argument(f"--user-data-dir={self.profile_dir}")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        if headless:
            options.add_argument("--headless=new")
            
        self.driver = uc.Chrome(options=options)
        
    def get_driver(self):
        return self.driver

    def check_logged_in(self) -> bool:
        """Check if user is currently logged into Shopee."""
        self.driver.get("https://shopee.co.id/")
        time.sleep(3)
        cookies = self.driver.get_cookies()
        cookie_names = [c.get('name') for c in cookies]
        # Shopee sets SPC_EC or SPC_U when logged in
        return "SPC_EC" in cookie_names or "SPC_U" in cookie_names

    def ensure_login(self, prompt_callback=None):
        """Ensure user is logged in. If not, open login page for QR scan."""
        self.driver.get("https://shopee.co.id/buyer/login")
        time.sleep(3)
        
        if self.check_logged_in():
            return True
            
        if prompt_callback:
            prompt_callback("Silakan scan QR Code di browser Chrome yang terbuka untuk login ke akun Shopee Anda...")
            
        # Wait until login cookie appears or user completes login (up to 3 minutes)
        start_time = time.time()
        while time.time() - start_time < 180:
            cookies = [c.get('name') for c in self.driver.get_cookies()]
            if "SPC_EC" in cookies or "SPC_U" in cookies:
                return True
            time.sleep(2)
            
        return False

    def get_session_cookies(() -> dict:
        """Extract cookies from Selenium driver into requests Session format."""
        cookies = {}
        for c in self.driver.get_cookies():
            cookies[c['name']] = c['value']
        return cookies

    def close(self):
        if self.driver:
            try:
                self.driver.quit()
            except Exception:
                pass
```

- [ ] **Step 3: Run test and commit**

```bash
pytest tests/test_browser.py
git add src/browser.py tests/test_browser.py
git commit -m "feat: implement ShopeeBrowserManager with profile and QR login support"
```

---

### Task 3: Scraper Engine (`src/scraper.py`)

**Files:**
- Create: `src/scraper.py`
- Create: `tests/test_scraper.py`

**Interfaces:**
- Consumes: `ShopeeBrowserManager`
- Produces: `ShopeeScraper` class with `search_products(keyword, limit=20)` and `fetch_reviews(item_id, shop_id, limit=None)`.

- [ ] **Step 1: Write test for scraper parsing logic**

```python
# tests/test_scraper.py
from src.scraper import parse_rating_item

def test_parse_rating_item():
    mock_rating = {
        "itemid": 12345,
        "author_username": "buyer123",
        "rating_star": 5,
        "mtime": 1672531199,
        "model_name": "250gr",
        "comment": "Kopi sangat nikmat!",
        "images": ["http://image1.jpg"],
        "Item_rating_reply": {"comment": "Terima kasih telah berbelanja!"}
    }
    parsed = parse_rating_item(mock_rating, "Nama Produk Test")
    assert parsed["reviewer"] == "buyer123"
    assert parsed["rating"] == 5
    assert parsed["comment"] == "Kopi sangat nikmat!"
```

- [ ] **Step 2: Implement ShopeeScraper in `src/scraper.py`**

```python
# src/scraper.py
import time
import datetime
import requests

def parse_rating_item(rating_data: dict, product_name: str = "") -> dict:
    """Helper to convert Shopee API rating object to unified dict."""
    mtime = rating_data.get("mtime", 0)
    date_str = datetime.datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M:%S") if mtime else ""
    
    images = rating_data.get("images") or []
    image_urls = [f"https://down-id.img.susercontent.com/file/{img}" for img in images]
    
    videos = rating_data.get("videos") or []
    video_urls = [v.get("url", "") for v in videos if isinstance(v, dict)]
    
    media_list = image_urls + video_urls
    media_str = ", ".join(media_list)
    
    reply = rating_data.get("Item_rating_reply") or {}
    seller_reply = reply.get("comment", "") if isinstance(reply, dict) else ""
    
    return {
        "item_id": str(rating_data.get("itemid", "")),
        "product_name": product_name,
        "reviewer": rating_data.get("author_username", "Anonymous"),
        "rating": rating_data.get("rating_star", 0),
        "review_date": date_str,
        "variation": rating_data.get("model_name", ""),
        "comment": rating_data.get("comment", ""),
        "media_urls": media_str,
        "seller_reply": seller_reply
    }


class ShopeeScraper:
    def __init__(self, browser_manager):
        self.browser_manager = browser_manager
        self.headers = {
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Referer": "https://shopee.co.id/"
        }

    def search_products(self, keyword: str, limit: int = 20) -> list:
        """Search products on Shopee via API endpoint with browser session."""
        cookies = self.browser_manager.get_session_cookies()
        url = f"https://shopee.co.id/api/v4/search/search_items?by=relevance&keyword={keyword}&limit={limit}&newest=0&order=desc&page_type=search&scenario=PAGE_GLOBAL_SEARCH&version=2"
        
        resp = requests.get(url, headers=self.headers, cookies=cookies)
        if resp.status_code != 200:
            # Fallback to web search navigation
            self.browser_manager.driver.get(f"https://shopee.co.id/search?keyword={keyword}")
            time.sleep(4)
            resp = requests.get(url, headers=self.headers, cookies=cookies)
            
        data = resp.json()
        items = data.get("items", [])
        
        results = []
        for entry in items:
            item_basic = entry.get("item_basic", {})
            item_id = item_basic.get("itemid")
            shop_id = item_basic.get("shopid")
            name = item_basic.get("name", "")
            price = item_basic.get("price", 0) / 100000 # Shopee price scaling
            sold = item_basic.get("historical_sold", 0)
            rating = round(item_basic.get("item_rating", {}).get("rating_star", 0), 1)
            
            if item_id and shop_id:
                results.append({
                    "item_id": str(item_id),
                    "shop_id": str(shop_id),
                    "name": name,
                    "price": price,
                    "sold": sold,
                    "rating": rating,
                    "url": f"https://shopee.co.id/product/{shop_id}/{item_id}"
                })
        return results

    def fetch_reviews(self, item_id: str, shop_id: str, product_name: str = "", progress_callback=None) -> list:
        """Fetch all reviews for a specific item ID and shop ID."""
        cookies = self.browser_manager.get_session_cookies()
        reviews = []
        offset = 0
        limit = 50
        
        while True:
            url = f"https://shopee.co.id/api/v4/item/get_ratings?itemid={item_id}&shopid={shop_id}&limit={limit}&offset={offset}&type=0&filter=0"
            resp = requests.get(url, headers=self.headers, cookies=cookies)
            
            if resp.status_code != 200:
                break
                
            data = resp.json().get("data", {})
            ratings = data.get("ratings")
            if not ratings:
                break
                
            for r in ratings:
                reviews.append(parse_rating_item(r, product_name))
                
            if progress_callback:
                progress_callback(len(reviews))
                
            offset += limit
            time.sleep(1) # Polite scraping delay
            
        return reviews
```

- [ ] **Step 3: Run test and commit**

```bash
pytest tests/test_scraper.py
git add src/scraper.py tests/test_scraper.py
git commit -m "feat: implement ShopeeScraper with search and rating extraction"
```

---

### Task 4: Exporter Module (`src/exporter.py`)

**Files:**
- Create: `src/exporter.py`
- Create: `tests/test_exporter.py`

**Interfaces:**
- Consumes: List of review dicts
- Produces: `export_to_csv()`, `export_to_excel()`, `export_to_json()`

- [ ] **Step 1: Write exporter test**

```python
# tests/test_exporter.py
import os
import pandas as pd
from src.exporter import export_reviews

def test_export_reviews(tmp_path):
    data = [{
        "item_id": "123",
        "product_name": "Test Product",
        "reviewer": "user1",
        "rating": 5,
        "review_date": "2026-01-01 10:00:00",
        "variation": "Default",
        "comment": "Bagus!",
        "media_urls": "",
        "seller_reply": ""
    }]
    
    csv_path = str(tmp_path / "test.csv")
    xlsx_path = str(tmp_path / "test.xlsx")
    
    export_reviews(data, csv_path, file_format="csv")
    assert os.path.exists(csv_path)
    
    export_reviews(data, xlsx_path, file_format="excel")
    assert os.path.exists(xlsx_path)
```

- [ ] **Step 2: Implement `src/exporter.py`**

```python
# src/exporter.py
import os
import pandas as pd

def export_reviews(reviews: list, filepath: str, file_format: str = "excel"):
    """Export list of review dicts to CSV, Excel, or JSON."""
    os.makedirs(os.path.dirname(os.path.abspath(filepath)), exist_ok=True)
    df = pd.DataFrame(reviews)
    
    if file_format.lower() in ["excel", "xlsx"]:
        df.to_excel(filepath, index=False, engine="openpyxl")
    elif file_format.lower() == "csv":
        df.to_csv(filepath, index=False, encoding="utf-8-sig")
    elif file_format.lower() == "json":
        df.to_json(filepath, orient="records", indent=2, force_ascii=False)
    else:
        raise ValueError(f"Unsupported format: {file_format}")
    return filepath
```

- [ ] **Step 3: Run test and commit**

```bash
pytest tests/test_exporter.py
git add src/exporter.py tests/test_exporter.py
git commit -m "feat: implement export_reviews module for CSV/Excel/JSON"
```

---

### Task 5: Interactive CLI Main Entrypoint (`main.py`)

**Files:**
- Create: `main.py`

**Interfaces:**
- Consumes: `ShopeeBrowserManager`, `ShopeeScraper`, `export_reviews`
- Produces: CLI App executable via `python main.py`

- [ ] **Step 1: Implement `main.py` with Rich interface**

```python
# main.py
import os
import sys
import datetime
from rich.console import Console
from rich.table import Table
from rich.prompt import Prompt
from rich.progress import Progress, SpinnerColumn, TextColumn

from src.browser import ShopeeBrowserManager
from src.scraper import ShopeeScraper
from src.exporter import export_reviews

console = Console()

def display_product_table(products: list):
    table = Table(title="Hasil Pencarian Produk Shopee")
    table.add_column("No", justify="center", style="cyan", no_wrap=True)
    table.add_column("Nama Produk", style="magenta")
    table.add_column("Harga (Rp)", justify="right", style="green")
    table.add_column("Terjual", justify="right", style="yellow")
    table.add_column("Rating", justify="center", style="bold blue")

    for idx, p in enumerate(products, 1):
        price_fmt = f"{p['price']:,.0f}".replace(",", ".")
        table.add_row(str(idx), p['name'][:60], price_fmt, str(p['sold']), str(p['rating']))

    console.print(table)

def main():
    console.print("[bold green]=== Shopee Review Scraper (Python + Selenium) ===[/bold green]\n")
    
    keyword = Prompt.ask("[bold yellow]Masukkan Keyword Pencarian Produk[/bold yellow]", default="kopi ulubelu lampung")
    
    console.print("\n[bold blue]Inisialisasi Selenium Chrome Browser...[/bold blue]")
    browser = ShopeeBrowserManager(profile_dir="./shopee_profile", headless=False)
    scraper = ShopeeScraper(browser)
    
    try:
        console.print(f"\n[cyan]Mencari produk dengan keyword: '{keyword}'...[/cyan]")
        products = scraper.search_products(keyword, limit=20)
        
        if not products:
            console.print("[bold red]Produk tidak ditemukan atau koneksi dibatasi oleh Shopee.[/bold red]")
            return
            
        display_product_table(products)
        
        choice = Prompt.ask(
            "\n[bold yellow]Pilih nomor produk yang ingin diambil ulasannya (misal: 1 atau 1,2,3 atau 'all')[/bold yellow]",
            default="1"
        )
        
        selected_products = []
        if choice.lower() == "all":
            selected_products = products
        else:
            indices = [int(i.strip()) - 1 for i in choice.split(",") if i.strip().isdigit()]
            for idx in indices:
                if 0 <= idx < len(products):
                    selected_products.append(products[idx])
                    
        if not selected_products:
            console.print("[bold red]Pilihan produk tidak valid.[/bold red]")
            return

        # Check QR Login
        console.print("\n[bold blue]Memeriksa status akun / QR Login Shopee...[/bold blue]")
        browser.ensure_login(prompt_callback=lambda msg: console.print(f"[bold yellow]{msg}[/bold yellow]"))
        
        all_reviews = []
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console
        ) as progress:
            for p in selected_products:
                task_id = progress.add_task(f"Mengambil ulasan untuk '{p['name'][:30]}...'")
                
                def update_cb(count):
                    progress.update(task_id, description=f"Mengambil ulasan '{p['name'][:30]}...' ({count} ulasan terambil)")
                    
                reviews = scraper.fetch_reviews(p['item_id'], p['shop_id'], product_name=p['name'], progress_callback=update_cb)
                all_reviews.extend(reviews)
                progress.update(task_id, description=f"[green]Selesai! '{p['name'][:30]}...' ({len(reviews)} ulasan)[/green]")
                
        if not all_reviews:
            console.print("[bold red]Tidak ada data ulasan yang berhasil diambil.[/bold red]")
            return
            
        console.print(f"\n[bold green]Total {len(all_reviews)} ulasan berhasil diekstrak![/bold green]")
        
        fmt = Prompt.ask("\n[bold yellow]Pilih Format Export[/bold yellow]", choices=["excel", "csv", "json"], default="excel")
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"shopee_reviews_{timestamp}.{'xlsx' if fmt == 'excel' else fmt}"
        out_path = os.path.join("./output", filename)
        
        export_reviews(all_reviews, out_path, file_format=fmt)
        console.print(f"\n[bold green]🎉 Data berhasil disimpan ke: [underline]{os.path.abspath(out_path)}[/underline][/bold green]")

    except Exception as e:
        console.print(f"\n[bold red]Terjadi Kesalahan: {e}[/bold red]")
    finally:
        browser.close()

if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Commit main.py**

```bash
git add main.py
git commit -m "feat: implement interactive CLI main entrypoint with Rich UI"
```

---

### Task 6: End-to-End Verification & Documentation

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README.md with clear usage instructions**

```markdown
# Shopee Review Scraper (Python + Selenium)

Tools scraping ulasan produk Shopee berbasis Python dan Selenium dengan QR Code Login.

## Fitur Utama
- **QR Login Persistence**: Bebas repot login ulang berulang kali, profil disimpan di `./shopee_profile`.
- **Search by Keyword**: Cukup ketik kata kunci seperti `kopi ulubelu lampung`.
- **Multi-Product Selection**: Tampilan tabel produk interaktif, pilih 1 produk, beberapa produk, atau seluruh produk.
- **Full Review Metadata**: Mengambil bintang, tanggal, pengulas, variasi produk, komentar, link foto/video, dan respon toko.
- **Export Multi-Format**: Simpan ke CSV, Excel (`.xlsx`), atau JSON di folder `./output/`.

## Cara Penggunaan

1. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Jalankan Scraper**:
   ```bash
   python main.py
   ```
```

- [ ] **Step 2: Commit README.md**

```bash
git add README.md
git commit -m "docs: add README usage documentation"
```
