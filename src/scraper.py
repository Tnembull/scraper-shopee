import time
import json
import datetime
import urllib.request
import urllib.parse
import urllib.error

try:
    import requests
    HAS_REQUESTS = True
except Exception:
    HAS_REQUESTS = False
    requests = None

def parse_rating_item(rating_data: dict, product_name: str = "") -> dict:
    """Convert Shopee rating object from API response into standardized record dict."""
    mtime = rating_data.get("mtime", 0)
    date_str = datetime.datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M:%S") if mtime else ""
    
    images = rating_data.get("images") or []
    image_urls = [f"https://down-id.img.susercontent.com/file/{img}" for img in images if img]
    
    videos = rating_data.get("videos") or []
    video_urls = [v.get("url", "") for v in videos if isinstance(v, dict) and v.get("url")]
    
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
    def __init__(self, browser_manager=None):
        self.browser_manager = browser_manager
        self.headers = {
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Referer": "https://shopee.co.id/",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7"
        }

    def _get_cookies(self) -> dict:
        if self.browser_manager:
            return self.browser_manager.get_session_cookies()
        return {}

    def _http_get_json(self, url: str, cookies: dict) -> dict:
        """Fetch JSON data from URL using requests or urllib fallback."""
        if HAS_REQUESTS and requests:
            try:
                resp = requests.get(url, headers=self.headers, cookies=cookies, timeout=10)
                if resp.status_code == 200:
                    return resp.json()
            except Exception:
                pass
                
        # urllib fallback
        req = urllib.request.Request(url, headers=self.headers)
        if cookies:
            cookie_str = "; ".join([f"{k}={v}" for k, v in cookies.items()])
            req.add_header("Cookie", cookie_str)
            
        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                if response.status == 200:
                    body = response.read().decode("utf-8")
                    return json.loads(body)
        except Exception as e:
            pass
        return {}

    def search_products(self, keyword: str, limit: int = 20) -> list:
        """Search products on Shopee by keyword."""
        cookies = self._get_cookies()
        encoded_kw = urllib.parse.quote(keyword)
        url = f"https://shopee.co.id/api/v4/search/search_items?by=relevance&keyword={encoded_kw}&limit={limit}&newest=0&order=desc&page_type=search&scenario=PAGE_GLOBAL_SEARCH&version=2"
        
        data = self._http_get_json(url, cookies)
        items = data.get("items", []) or []
        
        results = []
        for entry in items:
            item_basic = entry.get("item_basic", {}) or {}
            item_id = item_basic.get("itemid")
            shop_id = item_basic.get("shopid")
            name = item_basic.get("name", "")
            price = item_basic.get("price", 0) / 100000.0
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
        """Fetch all reviews for a given product Item ID and Shop ID."""
        cookies = self._get_cookies()
        reviews = []
        offset = 0
        limit = 50
        
        while True:
            url = f"https://shopee.co.id/api/v4/item/get_ratings?itemid={item_id}&shopid={shop_id}&limit={limit}&offset={offset}&type=0&filter=0"
            data = self._http_get_json(url, cookies)
            
            ratings_data = data.get("data", {}) or {}
            ratings = ratings_data.get("ratings")
            if not ratings:
                break
                
            for r in ratings:
                parsed = parse_rating_item(r, product_name)
                reviews.append(parsed)
                
            if progress_callback:
                progress_callback(len(reviews))
                
            offset += limit
            time.sleep(1)
                
        return reviews
