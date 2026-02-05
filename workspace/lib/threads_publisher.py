"""
Threads Publisher - 萃取自 threads-post 專案的核心發文邏輯

使用方式：
    from lib.threads_publisher import ThreadsPublisher
    
    publisher = ThreadsPublisher(
        user_data_dir="/path/to/session",
        browser_type="firefox"
    )
    
    with publisher as p:
        if p.check_login_status():
            p.create_post("內容", schedule_time)
"""

import os
import random
import time
import json
from pathlib import Path
from datetime import datetime
from typing import Optional

try:
    from playwright.sync_api import sync_playwright, Browser, BrowserContext, Page
except ImportError:
    raise ImportError("請安裝 playwright: pip install playwright && playwright install firefox")

try:
    from playwright_stealth import stealth_sync
except ImportError:
    try:
        from playwright_stealth import stealth as stealth_sync
    except ImportError:
        stealth_sync = None  # Optional


# =============================================================================
# Custom Exceptions
# =============================================================================

class ThreadsPublisherError(Exception):
    """Base error for publisher"""
    def __init__(self, message: str, screenshot_path: str = None):
        self.message = message
        self.screenshot_path = screenshot_path
        super().__init__(self.message)


class LoginRequiredError(ThreadsPublisherError):
    """Login required"""
    pass


class ContentInputError(ThreadsPublisherError):
    """Content input failed"""
    pass


class ScheduleTimeError(ThreadsPublisherError):
    """Schedule time setting failed"""
    pass


# =============================================================================
# Main Publisher Class
# =============================================================================

class ThreadsPublisher:
    """Threads 自動發文工具（Playwright 實作）
    
    支援：
    - Firefox/WebKit/Chromium
    - Session 持久化
    - 反偵測策略
    - 排程發布
    
    推薦使用 Context Manager：
        with ThreadsPublisher() as publisher:
            publisher.create_post(content, schedule_time)
    """

    # 預設配置
    DEFAULT_BROWSER = "firefox"
    DEFAULT_USER_DATA_DIR = "./playwright_user_data"
    DEFAULT_THREADS_URL = "https://www.threads.net/"
    MAX_DAILY_POSTS = 25

    def __init__(
        self,
        headless: bool = False,
        user_data_dir: str = None,
        browser_type: str = None,
        threads_url: str = None,
        log_dir: str = "./logs"
    ):
        """
        初始化 Threads 發布器
        
        Args:
            headless: 是否使用無頭模式（首次登入需要 False）
            user_data_dir: Session 儲存目錄
            browser_type: 'firefox'(推薦) / 'webkit' / 'chromium'
            threads_url: Threads 網址
            log_dir: 錯誤截圖儲存目錄
        """
        self.headless = headless
        self.user_data_dir = user_data_dir or self.DEFAULT_USER_DATA_DIR
        self.browser_type = browser_type or self.DEFAULT_BROWSER
        self.base_url = threads_url or self.DEFAULT_THREADS_URL
        self.log_dir = log_dir

        # Playwright 物件
        self.playwright = None
        self.browser: Browser = None
        self.context: BrowserContext = None
        self.page: Page = None
        
        self._initialized = False

    def __enter__(self):
        """Context manager 進入"""
        self.init_driver()
        self.navigate_to_threads()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager 離開"""
        self.close()
        return False

    # =========================================================================
    # Browser Lifecycle
    # =========================================================================

    def init_driver(self) -> bool:
        """初始化 Playwright 瀏覽器"""
        try:
            print(f"🚀 初始化 Playwright ({self.browser_type})...")

            self.playwright = sync_playwright().start()

            # 選擇瀏覽器
            if self.browser_type == "firefox":
                print("🦊 使用 Firefox（推薦）")
                self.browser = self.playwright.firefox.launch(
                    headless=self.headless,
                    firefox_user_prefs={
                        "dom.webdriver.enabled": False,
                        "useAutomationExtension": False,
                    }
                )
                user_agent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:133.0) Gecko/20100101 Firefox/133.0"

            elif self.browser_type == "webkit":
                print("🧭 使用 WebKit")
                self.browser = self.playwright.webkit.launch(headless=self.headless)
                user_agent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15"

            else:  # chromium
                print("🌐 使用 Chromium（較容易被偵測）")
                self.browser = self.playwright.chromium.launch(
                    headless=self.headless,
                    args=['--no-sandbox', '--disable-blink-features=AutomationControlled']
                )
                user_agent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/140.0.0.0 Safari/537.36"

            # 載入 Session
            storage_state_file = Path(self.user_data_dir) / "storage_state.json"
            context_options = {
                "user_agent": user_agent,
                "viewport": {"width": 1280, "height": 720},
                "locale": "zh-TW",
                "timezone_id": "Asia/Taipei",
            }

            if storage_state_file.exists():
                print(f"📂 載入 Session: {storage_state_file}")
                context_options["storage_state"] = str(storage_state_file)
            else:
                os.makedirs(self.user_data_dir, exist_ok=True)

            self.context = self.browser.new_context(**context_options)
            self.page = self.context.new_page()

            # Chromium 套用 stealth
            if self.browser_type == "chromium" and stealth_sync:
                stealth_sync(self.page)
                print("🥷 Stealth 已啟用")

            self._initialized = True
            print("✅ Playwright 初始化成功")
            return True

        except Exception as e:
            print(f"❌ 初始化失敗: {e}")
            return False

    def close(self) -> None:
        """關閉瀏覽器並儲存 Session"""
        try:
            if self.context:
                storage_state_file = Path(self.user_data_dir) / "storage_state.json"
                os.makedirs(self.user_data_dir, exist_ok=True)
                self.context.storage_state(path=str(storage_state_file))
                print(f"💾 Session 已儲存: {storage_state_file}")

            if self.page:
                self.page.close()
            if self.context:
                self.context.close()
            if self.browser:
                self.browser.close()
            if self.playwright:
                self.playwright.stop()

            self._initialized = False
            print("🔚 瀏覽器已關閉")

        except Exception as e:
            print(f"⚠️ 關閉時發生錯誤: {e}")

    # =========================================================================
    # Navigation & Auth
    # =========================================================================

    def navigate_to_threads(self) -> bool:
        """導航到 Threads"""
        try:
            print("🌐 前往 Threads...")
            self.page.goto(self.base_url, wait_until="domcontentloaded", timeout=30000)
            
            try:
                self.page.wait_for_load_state("networkidle", timeout=15000)
            except Exception:
                pass  # Threads 常 timeout，正常

            print(f"📍 已到達: {self.page.url}")
            return True
        except Exception as e:
            print(f"❌ 導航失敗: {e}")
            return "threads.net" in str(self.page.url) if self.page else False

    def check_login_status(self) -> bool:
        """檢查登入狀態"""
        try:
            print("🔍 檢查登入狀態...")

            # 檢查登入按鈕（未登入才會出現）
            try:
                if self.page.get_by_text("登入或註冊").is_visible(timeout=3000):
                    print("❌ 未登入")
                    return False
            except:
                pass

            # 檢查發佈按鈕（已登入才會出現）
            try:
                if self.page.get_by_role("button", name="發佈").is_visible(timeout=3000):
                    print("✅ 已登入")
                    return True
            except:
                pass

            print("❌ 無法確認登入狀態")
            return False

        except Exception as e:
            print(f"⚠️ 檢查登入時發生錯誤: {e}")
            return False

    # =========================================================================
    # Utilities
    # =========================================================================

    def human_like_delay(self, min_ms: int = 500, max_ms: int = 1500) -> None:
        """模擬人類操作延遲"""
        delay = random.randint(min_ms, max_ms)
        self.page.wait_for_timeout(delay)

    def _save_error_screenshot(self, error_type: str) -> str:
        """儲存錯誤截圖"""
        timestamp = int(time.time())
        screenshot_path = f"{self.log_dir}/error_{error_type}_{timestamp}.png"
        os.makedirs(self.log_dir, exist_ok=True)
        self.page.screenshot(path=screenshot_path, full_page=True)
        print(f"📸 錯誤截圖: {screenshot_path}")
        return screenshot_path

    # =========================================================================
    # Publishing
    # =========================================================================

    def create_post(self, content: str, schedule_time: datetime) -> bool:
        """
        建立排程貼文
        
        Args:
            content: 貼文內容
            schedule_time: 排程時間（必須是未來時間）
            
        Returns:
            bool: 是否成功
            
        Raises:
            LoginRequiredError: 未登入
            ContentInputError: 內容輸入失敗
        """
        import re
        
        try:
            print(f"\n{'='*60}")
            print("📝 建立貼文")
            print(f"{'='*60}")
            print(f"內容長度: {len(content)} 字")
            print(f"排程時間: {schedule_time.strftime('%Y-%m-%d %H:%M')}")

            if not self.check_login_status():
                raise LoginRequiredError("請先登入")

            # Step 1: 點擊發佈按鈕
            print("🎯 Step 1: 開啟編輯器...")
            self.page.get_by_role("button", name="發佈").click()
            self.human_like_delay(1000, 2000)

            # Step 2: 輸入內容
            print("⌨️ Step 2: 輸入內容...")
            text_area = self.page.locator('[contenteditable="true"][aria-label*="文字欄位"]').first
            text_area.click()
            self.human_like_delay(500, 1000)
            text_area.type(content, delay=random.randint(50, 150))
            self.human_like_delay(1000, 2000)

            # Step 3: 開啟更多選項
            print("⏰ Step 3: 開啟排程選項...")
            dialog = self.page.locator('div[role="dialog"]').or_(self.page.locator('div[aria-modal="true"]'))
            more_button = dialog.locator('div[role="button"]:has(svg[aria-label="更多"])').first
            more_button.click()
            self.human_like_delay(1000, 1500)

            # Step 4: 選擇「排定時間」
            print("📅 Step 4: 選擇排程...")
            self.page.get_by_text("排定時間").click()
            self.human_like_delay(1000, 1500)

            # Step 5: 選擇日期
            print(f"📆 Step 5: 設定日期 ({schedule_time.day}日)...")
            date_pattern = re.compile(f".*{schedule_time.day}日.*")
            self.page.get_by_role("gridcell", name=date_pattern).first.click()
            self.human_like_delay(500, 1000)

            # Step 6: 設定時間
            print(f"🕐 Step 6: 設定時間 ({schedule_time.strftime('%H:%M')})...")
            self.page.get_by_placeholder("hh").click()
            self.page.get_by_placeholder("hh").fill(schedule_time.strftime("%H"))
            self.human_like_delay(300, 500)
            
            self.page.get_by_placeholder("mm").click()
            self.page.get_by_placeholder("mm").fill(schedule_time.strftime("%M"))
            self.human_like_delay(300, 500)

            # Step 7: 確認排程
            print("✅ Step 7: 確認設定...")
            self.page.locator('div[role="button"]:has-text("完成")').last.click()
            self.human_like_delay(2000, 3000)

            # Step 8: 發布
            print("🚀 Step 8: 發布...")
            self.page.locator('div[role="button"]:has-text("預排時間")').last.click()
            self.human_like_delay(3000, 5000)

            print(f"\n{'='*60}")
            print("✅ 貼文排程成功！")
            print(f"{'='*60}\n")

            return True

        except LoginRequiredError:
            raise
        except Exception as e:
            print(f"\n❌ 發布失敗: {e}")
            self._save_error_screenshot("post_failed")
            return False


# =============================================================================
# CLI Entry Point
# =============================================================================

if __name__ == "__main__":
    import argparse
    from datetime import timedelta
    
    parser = argparse.ArgumentParser(description="Threads Publisher CLI")
    parser.add_argument("--login", action="store_true", help="手動登入模式")
    parser.add_argument("--check", action="store_true", help="檢查登入狀態")
    parser.add_argument("--post", type=str, help="發布內容")
    parser.add_argument("--hours", type=int, default=24, help="排程時間（小時後）")
    parser.add_argument("--browser", default="firefox", help="瀏覽器類型")
    parser.add_argument("--session-dir", default="./playwright_user_data", help="Session 目錄")
    
    args = parser.parse_args()
    
    publisher = ThreadsPublisher(
        headless=False,
        browser_type=args.browser,
        user_data_dir=args.session_dir
    )
    
    with publisher as p:
        if args.login:
            print("🔑 手動登入模式")
            print("請在瀏覽器中登入，完成後按 Enter...")
            input()
            print("✅ Session 已儲存")
            
        elif args.check:
            is_logged_in = p.check_login_status()
            print(f"登入狀態: {'✅ 已登入' if is_logged_in else '❌ 未登入'}")
            
        elif args.post:
            schedule_time = datetime.now() + timedelta(hours=args.hours)
            result = p.create_post(args.post, schedule_time)
            if result:
                print(f"✅ 已排程於: {schedule_time}")
            else:
                print("❌ 發布失敗")
