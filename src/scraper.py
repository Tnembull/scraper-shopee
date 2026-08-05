import time
import json
import re
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
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
            "Referer": "https://shopee.co.id/",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
            "x-api-source": "pc",
            "x-shopee-language": "id",
            "x-requested-with": "XMLHttpRequest"
        }

    def _get_cookies(self) -> dict:
        if self.browser_manager:
            return self.browser_manager.get_session_cookies()
        return {}

    def _http_get_json(self, url: str, cookies: dict) -> dict:
        """Fetch JSON data from URL using requests or urllib fallback."""
        headers = dict(self.headers)
        if "search_items" in url:
            headers["Referer"] = "https://shopee.co.id/search"
            
        if HAS_REQUESTS and requests:
            try:
                resp = requests.get(url, headers=headers, cookies=cookies, timeout=10)
                if resp.status_code == 200:
                    return resp.json()
            except Exception:
                pass
                
        # urllib fallback
        req = urllib.request.Request(url, headers=headers)
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
                rel_url = url
                if url.startswith("https://shopee.co.id"):
                    rel_url = url.replace("https://shopee.co.id", "")
                    
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
                res = driver.execute_async_script(js_code, rel_url)
                if isinstance(res, dict) and "error" not in res and res:
                    return res
            except Exception as e:
                pass
        return {}

    def parse_product_url(self, url: str) -> dict:
        """Parse shop_id and item_id from Shopee product URL."""
        match1 = re.search(r'-i\.(\d+)\.(\d+)', url)
        if match1:
            return {"shop_id": match1.group(1), "item_id": match1.group(2)}
            
        match2 = re.search(r'/product/(\d+)/(\d+)', url)
        if match2:
            return {"shop_id": match2.group(1), "item_id": match2.group(2)}
            
        return None

    def search_products(self, keyword: str, limit: int = 20) -> list:
        """Search products on Shopee by keyword or direct URL."""
        driver = self.browser_manager.get_driver() if self.browser_manager else None
        
        # Check if keyword is actually a direct product URL
        parsed_url = self.parse_product_url(keyword)
        if parsed_url:
            item_id = parsed_url["item_id"]
            shop_id = parsed_url["shop_id"]
            detail_url = f"https://shopee.co.id/api/v4/item/get?itemid={item_id}&shopid={shop_id}"
            detail_data = self._fetch_json_via_browser(detail_url).get("data", {}) or {}
            name = detail_data.get("name", "Produk Shopee")
            raw_price = detail_data.get("price") or detail_data.get("price_min") or 0
            price = float(raw_price) / 100000.0 if raw_price else 0.0
            sold = detail_data.get("historical_sold") or detail_data.get("sold") or 0
            d_rating = detail_data.get("item_rating", {}) or {}
            rating = round(float(d_rating.get("rating_star", 0.0)), 1)
            total_reviews = detail_data.get("cmt_count", 0)
            
            return [{
                "item_id": str(item_id),
                "shop_id": str(shop_id),
                "name": name,
                "price": price,
                "sold": sold,
                "rating": rating,
                "total_reviews": total_reviews,
                "url": keyword
            }]

        encoded_kw = urllib.parse.quote(keyword)
        url = f"https://shopee.co.id/api/v4/search/search_items?by=relevance&keyword={encoded_kw}&limit={limit}&newest=0&order=desc&page_type=search&scenario=PAGE_GLOBAL_SEARCH&version=2"
        
        # 1. Navigate browser to Shopee search page directly
        if driver:
            try:
                search_page_url = f"https://shopee.co.id/search?keyword={encoded_kw}"
                driver.get(search_page_url)
                time.sleep(3)
                driver.execute_script("window.scrollBy(0, 400);")
                time.sleep(1)
            except Exception:
                pass

        # 2. Try fetching JSON directly via browser context
        data = self._fetch_json_via_browser(url)
        items = data.get("items", []) or []

        # 3. Fallback to HTTP request if browser fetch returned empty
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

        # 4. DOM Scanner fallback if API calls returned empty
        if not results and driver:
            try:
                js_dom_scanner = """
                var items = [];
                var seen = {};
                var links = document.querySelectorAll('a');
                for (var i = 0; i < links.length; i++) {
                    var a = links[i];
                    var href = a.href || a.getAttribute('href') || '';
                    var match1 = href.match(/-i\\.(\\d+)\\.(\\d+)/);
                    var match2 = href.match(/\\/product\\/(\\d+)\\/(\\d+)/);
                    if (match1 || match2) {
                        var shopId = match1 ? match1[1] : match2[1];
                        var itemId = match1 ? match1[2] : match2[2];
                        if (!seen[itemId]) {
                            seen[itemId] = true;
                            var title = a.innerText.replace(/\\s+/g, ' ').trim();
                            items.push({
                                item_id: itemId,
                                shop_id: shopId,
                                name: title || ('Produk Shopee (' + itemId + ')'),
                                url: href
                            });
                        }
                    }
                }
                return items;
                """
                dom_items = driver.execute_script(js_dom_scanner)
                if isinstance(dom_items, list):
                    for d_item in dom_items[:limit]:
                        results.append({
                            "item_id": str(d_item["item_id"]),
                            "shop_id": str(d_item["shop_id"]),
                            "name": d_item["name"],
                            "price": 0.0,
                            "sold": 0,
                            "rating": 0.0,
                            "total_reviews": 0,
                            "url": d_item["url"]
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

