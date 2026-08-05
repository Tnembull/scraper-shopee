import unittest
from src.scraper import parse_rating_item, ShopeeScraper

class TestScraper(unittest.TestCase):
    def test_parse_rating_item(self):
        mock_rating = {
            "itemid": 998877,
            "author_username": "kopi_lover",
            "rating_star": 5,
            "mtime": 1700000000,
            "model_name": "250g Fine Grinder",
            "comment": "Kopi Ulubelu mantap jos!",
            "images": ["id-11134207-7r98o-lst123.jpg"],
            "Item_rating_reply": {"comment": "Terima kasih sudah belanja kak!"}
        }
        
        parsed = parse_rating_item(mock_rating, product_name="Kopi Ulubelu Lampung")
        self.assertEqual(parsed["item_id"], "998877")
        self.assertEqual(parsed["product_name"], "Kopi Ulubelu Lampung")
        self.assertEqual(parsed["reviewer"], "kopi_lover")
        self.assertEqual(parsed["rating"], 5)
        self.assertEqual(parsed["variation"], "250g Fine Grinder")
        self.assertEqual(parsed["comment"], "Kopi Ulubelu mantap jos!")
        self.assertIn("https://down-id.img.susercontent.com/file/", parsed["media_urls"])
        self.assertEqual(parsed["seller_reply"], "Terima kasih sudah belanja kak!")

    def test_scraper_instantiation(self):
        scraper = ShopeeScraper(browser_manager=None)
        self.assertIsNotNone(scraper.headers)

    def test_date_filtering_logic(self):
        scraper = ShopeeScraper(browser_manager=None)
        
        # Mock ratings: 2025-08-01, 2025-03-15, 2024-11-01
        ts_future = 1754006400  # 2025-08-01 (should be skipped if end_date is 2025-06-30)
        ts_valid = 1742035200   # 2025-03-15 (in range Jan-Jun 2025)
        ts_past = 1730419200    # 2024-11-01 (older than Jan 2025)
        
        mock_response = {
            "data": {
                "ratings": [
                    {"itemid": 1, "mtime": ts_future, "author_username": "user1", "rating_star": 5, "comment": "Future"},
                    {"itemid": 1, "mtime": ts_valid, "author_username": "user2", "rating_star": 5, "comment": "Target Range"},
                    {"itemid": 1, "mtime": ts_past, "author_username": "user3", "rating_star": 4, "comment": "Too Old"}
                ]
            }
        }
        
        # Override _http_get_json to return mock_response on first call then empty
        calls = 0
        def mock_get_json(url, cookies):
            nonlocal calls
            calls += 1
            if calls == 1:
                return mock_response
            return {}
            
        scraper._http_get_json = mock_get_json
        
        reviews = scraper.fetch_reviews("1", "1", start_date="2025-01-01", end_date="2025-06-30")
        self.assertEqual(len(reviews), 1)
        self.assertEqual(reviews[0]["comment"], "Target Range")

if __name__ == "__main__":
    unittest.main()

