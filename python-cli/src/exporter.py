import os
import csv
import json

try:
    import pandas as pd
    HAS_PANDAS = True
except ImportError:
    HAS_PANDAS = False

def export_reviews(reviews: list, filepath: str, file_format: str = "excel") -> str:
    """
    Export list of review dicts to Excel (.xlsx), CSV (.csv), or JSON (.json).
    Uses pandas if available, with standard library fallbacks for CSV and JSON.
    """
    abs_path = os.path.abspath(filepath)
    os.makedirs(os.path.dirname(abs_path), exist_ok=True)
    
    fmt = file_format.lower()
    
    if HAS_PANDAS:
        df = pd.DataFrame(reviews)
        if fmt in ["excel", "xlsx"]:
            df.to_excel(abs_path, index=False, engine="openpyxl")
            return abs_path
        elif fmt == "csv":
            df.to_csv(abs_path, index=False, encoding="utf-8-sig")
            return abs_path
        elif fmt == "json":
            df.to_json(abs_path, orient="records", indent=2, force_ascii=False)
            return abs_path

    # Standard library fallback
    if fmt == "csv" or fmt in ["excel", "xlsx"]:
        # If Excel requested without pandas, save as UTF-8 CSV with BOM for Excel compatibility
        target_path = abs_path if fmt == "csv" else abs_path.replace(".xlsx", ".csv")
        headers = [
            "item_id", "product_name", "reviewer", "rating", "review_date",
            "variation", "comment", "media_urls", "seller_reply"
        ]
        with open(target_path, mode="w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=headers, extrasaction="ignore")
            writer.writeheader()
            for r in reviews:
                writer.writerow(r)
        return target_path

    elif fmt == "json":
        with open(abs_path, mode="w", encoding="utf-8") as f:
            json.dump(reviews, f, ensure_ascii=False, indent=2)
        return abs_path

    raise ValueError(f"Format '{file_format}' tidak didukung.")
