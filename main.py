import os
import sys
import datetime

try:
    from rich.console import Console
    from rich.table import Table
    from rich.prompt import Prompt
    from rich.progress import Progress, SpinnerColumn, TextColumn
    HAS_RICH = True
    console = Console()
except ImportError:
    HAS_RICH = False

from src.browser import ShopeeBrowserManager
from src.scraper import ShopeeScraper
from src.exporter import export_reviews


def print_msg(msg: str, style: str = "info"):
    if HAS_RICH:
        color_map = {
            "title": "bold green",
            "info": "bold blue",
            "prompt": "bold yellow",
            "success": "bold green",
            "error": "bold red",
            "sub": "cyan"
        }
        console.print(f"[{color_map.get(style, 'white')}]{msg}[/{color_map.get(style, 'white')}]")
    else:
        print(msg)


def prompt_input(message: str, default_val: str = "") -> str:
    if HAS_RICH:
        return Prompt.ask(f"[bold yellow]{message}[/bold yellow]", default=default_val)
    else:
        val = input(f"{message} [{default_val}]: ").strip()
        return val if val else default_val


def display_product_table(products: list):
    if HAS_RICH:
        table = Table(title="Hasil Pencarian Produk Shopee")
        table.add_column("No", justify="center", style="cyan", no_wrap=True)
        table.add_column("Nama Produk", style="magenta")
        table.add_column("Harga (Rp)", justify="right", style="green")
        table.add_column("Terjual", justify="right", style="yellow")
        table.add_column("Rating", justify="center", style="bold blue")
        table.add_column("Total Ulasan", justify="right", style="bold cyan")

        for idx, p in enumerate(products, 1):
            price_fmt = f"{p['price']:,.0f}".replace(",", ".")
            sold_str = f"{p['sold']:,}".replace(",", ".") if p.get('sold') else "-"
            rating_str = str(p['rating']) if p.get('rating') else "-"
            reviews_str = f"{p.get('total_reviews', 0):,}".replace(",", ".") if p.get('total_reviews') else "-"
            table.add_row(str(idx), p['name'][:55], price_fmt, sold_str, rating_str, reviews_str)

        console.print(table)
    else:
        print("\n=== Hasil Pencarian Produk Shopee ===")
        print(f"{'No':<4} | {'Nama Produk':<45} | {'Harga (Rp)':<12} | {'Terjual':<8} | {'Rating':<6} | {'Total Ulasan':<12}")
        print("-" * 105)
        for idx, p in enumerate(products, 1):
            price_fmt = f"{p['price']:,.0f}".replace(",", ".")
            sold_str = f"{p['sold']:,}".replace(",", ".") if p.get('sold') else "-"
            rating_str = str(p['rating']) if p.get('rating') else "-"
            reviews_str = f"{p.get('total_reviews', 0):,}".replace(",", ".") if p.get('total_reviews') else "-"
            print(f"{idx:<4} | {p['name'][:45]:<45} | {price_fmt:<12} | {sold_str:<8} | {rating_str:<6} | {reviews_str:<12}")
        print("-" * 105)



def main():
    print_msg("=== Shopee Review Scraper (Python + Selenium) ===", "title")
    print()
    
    print_msg("\nInisialisasi Selenium Chrome Browser...", "info")
    browser = ShopeeBrowserManager(profile_dir="./shopee_profile", headless=False)
    scraper = ShopeeScraper(browser)
    
    try:
        # Step 1: Ensure user is LOGGED IN first before searching
        print_msg("\n[Step 1] Memeriksa status akun / QR Login Shopee...", "info")
        logged_in = browser.ensure_login(prompt_callback=lambda msg: print_msg(msg, "prompt"))
        if logged_in:
            print_msg("✅ Login terdeteksi! Akun Shopee aktif.", "success")
        else:
            print_msg("⚠️ Peringatan: Login belum terdeteksi.", "prompt")

        # Step 2: Prompt for keyword / product link
        keyword = prompt_input("\n[Step 2] Masukkan Keyword Pencarian Produk / Link Shopee", default_val="kopi ulubelu lampung")

        print_msg(f"\nMencari produk dengan keyword: '{keyword}'...", "sub")
        products = scraper.search_products(keyword, limit=20)
        
        if not products:
            print_msg("Produk tidak ditemukan atau koneksi dibatasi oleh Shopee.", "error")
            return
            
        display_product_table(products)
        
        choice = prompt_input(
            "\nPilih nomor produk yang ingin diambil ulasannya (misal: 1 atau 1,2,3 atau 'all')",
            default_val="1"
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
            print_msg("Pilihan produk tidak valid.", "error")
            return

        # Step 3: Date Range Filter Prompts
        print_msg("\n[Step 3] Filter Tanggal Ulasan", "info")
        start_date = prompt_input("Tanggal Mulai (YYYY-MM-DD)", default_val="2025-01-01")
        end_date = prompt_input("Tanggal Akhir (YYYY-MM-DD)", default_val="2025-06-30")

        
        all_reviews = []
        
        if HAS_RICH:
            with Progress(
                SpinnerColumn(),
                TextColumn("[progress.description]{task.description}"),
                console=console
            ) as progress:
                for p in selected_products:
                    task_id = progress.add_task(f"Mengambil ulasan '{p['name'][:30]}...'")
                    
                    def update_cb(count):
                        progress.update(task_id, description=f"Mengambil ulasan '{p['name'][:30]}...' ({count} ulasan terambil)")
                        
                    reviews = scraper.fetch_reviews(
                        p['item_id'],
                        p['shop_id'],
                        product_name=p['name'],
                        start_date=start_date,
                        end_date=end_date,
                        progress_callback=update_cb
                    )
                    all_reviews.extend(reviews)
                    progress.update(task_id, description=f"[green]Selesai! '{p['name'][:30]}...' ({len(reviews)} ulasan)[/green]")
        else:
            for p in selected_products:
                print(f"Mengambil ulasan untuk '{p['name'][:40]}...' (Rentang: {start_date} s/d {end_date})")
                reviews = scraper.fetch_reviews(
                    p['item_id'],
                    p['shop_id'],
                    product_name=p['name'],
                    start_date=start_date,
                    end_date=end_date
                )
                all_reviews.extend(reviews)
                print(f"Selesai! ({len(reviews)} ulasan terambil)")

                
        if not all_reviews:
            print_msg("Tidak ada data ulasan yang berhasil diambil.", "error")
            return
            
        print_msg(f"\nTotal {len(all_reviews)} ulasan berhasil diekstrak!", "success")
        
        fmt = prompt_input("\nPilih Format Export (excel / csv / json)", default_val="excel")
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        
        ext = "xlsx" if fmt.lower() in ["excel", "xlsx"] else fmt.lower()
        filename = f"shopee_reviews_{timestamp}.{ext}"
        out_path = os.path.join("./output", filename)
        
        result_file = export_reviews(all_reviews, out_path, file_format=fmt)
        print_msg(f"\n🎉 Data berhasil disimpan ke: {os.path.abspath(result_file)}", "success")

    except Exception as e:
        print_msg(f"\nTerjadi Kesalahan: {e}", "error")
    finally:
        browser.close()


if __name__ == "__main__":
    main()
