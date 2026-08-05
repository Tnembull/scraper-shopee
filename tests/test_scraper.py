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

if __name__ == "__main__":
    unittest.main()
