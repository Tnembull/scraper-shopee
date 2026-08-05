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

    def _fetch_json_via_browser(self, url: str) -> dict:
        """Execute fetch in active Selenium browser context to bypass anti-bot blocks."""
        if self.browser_manager and self.browser_manager.get_driver():
            driver = self.browser_manager.get_driver()
            try:
                driver.set_script_timeout(10)
                js_code = """
                var callback = arguments[arguments.length - 1];
                fetch(arguments[0], {
                    headers: {
                        "x-api-source": "pc",
                        "x-shopee-language": "id",
                        "x-requested-with": "XMLHttpRequest"
                    },
                    credentials: "include"
                })
                .then(r => r.json())
                .then(data => callback(data))
                .catch(err => callback({error: err.toString()}));
                """
                res = driver.execute_async_script(js_code, url)
                if isinstance(res, dict) and "error" not in res and res:
                    return res
            except Exception as e:
                pass
        return {}

    def search_products(self, keyword: str, limit: int = 20) -> list:
        """Search products on Shopee by keyword."""
        encoded_kw = urllib.parse.quote(keyword)
        url = f"https://shopee.co.id/api/v4/search/search_items?by=relevance&keyword={encoded_kw}&limit={limit}&newest=0&order=desc&page_type=search&scenario=PAGE_GLOBAL_SEARCH&version=2"
        
        driver = self.browser_manager.get_driver() if self.browser_manager else None
        
        # 1. Ensure browser is on shopee.co.id domain
        if driver:
            try:
                if not driver.current_url or "shopee.co.id" not in driver.current_url:
                    driver.get("https://shopee.co.id/")
                    time.sleep(2)
            except Exception:
                pass

        # 2. Try fetching JSON directly via browser context (best & most reliable)
        data = self._fetch_json_via_browser(url)
        items = data.get("items", []) or []

        # 3. If empty, navigate browser to Shopee search page & retry JS fetch
        if not items and driver:
            try:
                search_page_url = f"https://shopee.co.id/search?keyword={encoded_kw}"
                driver.get(search_page_url)
                time.sleep(4)
                data = self._fetch_json_via_browser(url)
                items = data.get("items", []) or []
            except Exception:
                pass

        # 4. Fallback to HTTP request if browser fetch returned empty
        if not items:
            cookies = self._get_cookies()
            data = self._http_get_json(url, cookies)
            items = data.get("items", []) or []
        
        results = []
        for entry in items:
            if not isinstance(entry, dict):
                continue
            item_basic = entry.get("item_basic") if isinstance(entry.get("item_basic"), dict) else entry
            
            item_id = item_basic.get("itemid") or entry.get("itemid")
            shop_id = item_basic.get("shopid") or entry.get("shopid")
            name = item_basic.get("name", "") or entry.get("name", "")
            
            raw_price = item_basic.get("price") or item_basic.get("price_min") or 0
            price = float(raw_price) / 100000.0 if raw_price else 0.0
            
            sold = (
                item_basic.get("historical_sold") or
                item_basic.get("sold") or
                item_basic.get("historical_sold_count") or
                0
            )
            
            item_rating = item_basic.get("item_rating") or entry.get("item_rating") or {}
            rating_star = 0.0
            total_reviews = 0
            
            if isinstance(item_rating, dict):
                rating_star = item_rating.get("rating_star") or 0.0
                rcounts = item_rating.get("rating_count") or []
                if isinstance(rcounts, list) and len(rcounts) > 0:
                    total_reviews = sum(rcounts)
                else:
                    total_reviews = item_basic.get("cmt_count") or item_basic.get("total_rating_count") or 0
            else:
                total_reviews = item_basic.get("cmt_count") or 0
                
            rating = round(float(rating_star), 1)

            # If sold or rating or total_reviews is missing, query item detail API via browser
            if item_id and shop_id and (sold == 0 or rating == 0 or total_reviews == 0):
                detail_url = f"https://shopee.co.id/api/v4/item/get?itemid={item_id}&shopid={shop_id}"
                detail_data = self._fetch_json_via_browser(detail_url).get("data", {}) or {}
                if not detail_data:
                    cookies = self._get_cookies()
                    detail_data = self._http_get_json(detail_url, cookies).get("data", {}) or {}
                if detail_data:
                    sold = detail_data.get("historical_sold") or detail_data.get("sold") or sold
                    total_reviews = detail_data.get("cmt_count") or total_reviews
                    d_rating = detail_data.get("item_rating", {}) or {}
                    if isinstance(d_rating, dict) and d_rating.get("rating_star"):
                        rating = round(float(d_rating.get("rating_star")), 1)

            if item_id and shop_id:
                results.append({
                    "item_id": str(item_id),
                    "shop_id": str(shop_id),
                    "name": name,
                    "price": price,
                    "sold": sold,
                    "rating": rating,
                    "total_reviews": total_reviews,
                    "url": f"https://shopee.co.id/product/{shop_id}/{item_id}"
                })

        # 5. DOM fallback if API calls completely failed
        if not results and driver:
            try:
                cards = driver.find_elements("css selector", "a[href*='/product/'], a[data-sqe='link']")
                seen_ids = set()
                for card in cards:
                    href = card.get_attribute("href") or ""
                    if "/product/" in href:
                        parts = href.split("/product/")[-1].split("?")[0].split("/")
                        if len(parts) >= 2:
                            shop_id, item_id = parts[0], parts[1]
                            if item_id not in seen_ids:
                                seen_ids.add(item_id)
                                title = card.text.split("\n")[0] if card.text else "Produk Shopee"
                                results.append({
                                    "item_id": str(item_id),
                                    "shop_id": str(shop_id),
                                    "name": title,
                                    "price": 0.0,
                                    "sold": 0,
                                    "rating": 0.0,
                                    "total_reviews": 0,
                                    "url": href
                                })
            except Exception:
                pass

        return results




    def fetch_reviews(
        self,
        item_id: str,
        shop_id: str,
        product_name: str = "",
        start_date: str = None,
        end_date: str = None,
        progress_callback = None
    ) -> list:
        """
        Fetch reviews for a given product Item ID and Shop ID.
        Optionally filter by start_date ('YYYY-MM-DD') and end_date ('YYYY-MM-DD').
        """
        cookies = self._get_cookies()
        reviews = []
        offset = 0
        limit = 50
        
        start_ts = None
        end_ts = None
        
        if start_date:
            try:
                dt = datetime.datetime.strptime(start_date.strip(), "%Y-%m-%d")
                start_ts = dt.timestamp()
            except Exception:
                pass

        if end_date:
            try:
                dt = datetime.datetime.strptime(end_date.strip() + " 23:59:59", "%Y-%m-%d %H:%M:%S")
                end_ts = dt.timestamp()
            except Exception:
                pass
        
        stop_fetching = False

        while not stop_fetching:
            url = f"https://shopee.co.id/api/v4/item/get_ratings?itemid={item_id}&shopid={shop_id}&limit={limit}&offset={offset}&type=0&filter=0"
            data = self._fetch_json_via_browser(url)
            if not data:
                data = self._http_get_json(url, cookies)
            
            ratings_data = data.get("data", {}) or {}
            ratings = ratings_data.get("ratings")
            if not ratings:
                break
                
            for r in ratings:
                mtime = r.get("mtime", 0)
                
                # If end date constraint is set and review is newer than end_date, skip
                if end_ts and mtime > end_ts:
                    continue
                    
                # If start date constraint is set and review is older than start_date:
                # Since Shopee returns reviews newest-first, we can stop fetching further offsets
                if start_ts and mtime < start_ts:
                    stop_fetching = True
                    break
                    
                parsed = parse_rating_item(r, product_name)
                reviews.append(parsed)
                
            if progress_callback:
                progress_callback(len(reviews))
                
            offset += limit
            time.sleep(1)
                
        return reviews

