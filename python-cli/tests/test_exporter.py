import os
import json
import shutil
import tempfile
import unittest
from src.exporter import export_reviews

class TestExporter(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_export_reviews_csv(self):
        reviews = [{
            "item_id": "1001",
            "product_name": "Kopi Ulubelu Premium",
            "reviewer": "budi123",
            "rating": 5,
            "review_date": "2026-08-01 12:00:00",
            "variation": "250g Bubuk",
            "comment": "Kopi sangat harum dan nikmat",
            "media_urls": "https://down-id.img.susercontent.com/file/abc.jpg",
            "seller_reply": "Terima kasih bos!"
        }]
        
        csv_file = os.path.join(self.test_dir, "test_reviews.csv")
        result_path = export_reviews(reviews, csv_file, file_format="csv")
        
        self.assertTrue(os.path.exists(result_path))
        with open(result_path, mode="r", encoding="utf-8-sig") as f:
            content = f.read()
            self.assertIn("Kopi Ulubelu Premium", content)
            self.assertIn("budi123", content)

    def test_export_reviews_json(self):
        reviews = [{
            "item_id": "1002",
            "product_name": "Kopi Ulubelu Robusta",
            "reviewer": "siti456",
            "rating": 4,
            "review_date": "2026-08-02 14:30:00",
            "variation": "500g Biji",
            "comment": "Mantap cepat sampai",
            "media_urls": "",
            "seller_reply": ""
        }]
        
        json_file = os.path.join(self.test_dir, "test_reviews.json")
        result_path = export_reviews(reviews, json_file, file_format="json")
        
        self.assertTrue(os.path.exists(result_path))
        with open(result_path, mode="r", encoding="utf-8") as f:
            data = json.load(f)
            self.assertEqual(len(data), 1)
            self.assertEqual(data[0]["product_name"], "Kopi Ulubelu Robusta")

if __name__ == "__main__":
    unittest.main()
