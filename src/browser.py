import os
import time
import json
import urllib.request

try:
    import requests
except Exception:
    requests = None

try:
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.common.by import By
    HAS_SELENIUM = True
except ImportError:
    HAS_SELENIUM = False
    webdriver = None

try:
    import undetected_chromedriver as uc
    HAS_UC = True
except Exception:
    HAS_UC = False
    uc = None

class ShopeeBrowserManager:
    def __init__(self, profile_dir="./shopee_profile", headless=False):
        self.profile_dir = os.path.abspath(profile_dir)
        os.makedirs(self.profile_dir, exist_ok=True)
        self.driver = None
        
        if HAS_SELENIUM or HAS_UC:
            self._init_driver(headless=headless)

    def _init_driver(self, headless=False):
        if HAS_UC and uc:
            try:
                options = uc.ChromeOptions()
                options.add_argument(f"--user-data-dir={self.profile_dir}")
                options.add_argument("--no-sandbox")
                options.add_argument("--disable-dev-shm-usage")
                options.add_argument("--window-size=1280,800")
                if headless:
                    options.add_argument("--headless=new")
                self.driver = uc.Chrome(options=options)
                return
            except Exception as e:
                print(f"[Warning] Failed to start undetected_chromedriver ({e}), falling back to standard Selenium Chrome...")

        if HAS_SELENIUM and webdriver:
            try:
                options = Options()
                options.add_argument(f"--user-data-dir={self.profile_dir}")
                options.add_argument("--no-sandbox")
                options.add_argument("--disable-dev-shm-usage")
                options.add_argument("--window-size=1280,800")
                if headless:
                    options.add_argument("--headless=new")
                self.driver = webdriver.Chrome(options=options)
            except Exception as e:
                print(f"[Warning] Failed to start standard Chrome driver: {e}")

    def get_driver(self):
        return self.driver

    def check_logged_in(self) -> bool:
        """Check if user is currently logged into Shopee by scanning active cookies and URL."""
        if not self.driver:
            return False
        try:
            cookies = self.driver.get_cookies()
            cookie_names = [c.get('name') for c in cookies]
            has_cookie = any(name in cookie_names for name in ["SPC_EC", "SPC_U", "SPC_ST", "SPC_SI", "shopee_token"])
            
            current_url = self.driver.current_url or ""
            # If user has moved past login page and has cookies or is on main site
            if "buyer/login" not in current_url and "verify/traffic" not in current_url:
                if has_cookie or current_url.rstrip("/") == "https://shopee.co.id":
                    return True
            return has_cookie
        except Exception:
            return False

    def ensure_login(self, prompt_callback=None, timeout_seconds=300) -> bool:
        """Ensure user is logged in. If not, open login page for QR scan and wait for user."""
        if not self.driver:
            return False
        try:
            current_url = self.driver.current_url or ""
            if "shopee.co.id" not in current_url or "buyer/login" in current_url or "verify/traffic" in current_url:
                self.driver.get("https://shopee.co.id/buyer/login")
                time.sleep(3)
            
            if self.check_logged_in():
                return True
                
            if prompt_callback:
                prompt_callback("Silakan scan QR Code di browser Chrome yang terbuka untuk login ke akun Shopee Anda...")
                
            start_time = time.time()
            while time.time() - start_time < timeout_seconds:
                if self.check_logged_in():
                    return True
                time.sleep(2)
                
            return False
        except Exception as e:
            print(f"[Error] Exception during login check: {e}")
            return False


    def get_session_cookies(self) -> dict:
        """Extract cookies from Selenium driver into cookie dict."""
        cookies = {}
        if self.driver:
            try:
                for c in self.driver.get_cookies():
                    cookies[c['name']] = c['value']
            except Exception:
                pass
        return cookies

    def close(self):
        if self.driver:
            try:
                self.driver.quit()
            except Exception:
                pass
            self.driver = None
