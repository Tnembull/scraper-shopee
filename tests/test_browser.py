import os
import unittest
from src.browser import ShopeeBrowserManager

class TestBrowser(unittest.TestCase):
    def test_browser_manager_profile_creation(self):
        profile_dir = "./test_profile_dir"
        # Test class instantiation & profile path check without starting browser in headful mode
        manager = ShopeeBrowserManager.__new__(ShopeeBrowserManager)
        manager.profile_dir = os.path.abspath(profile_dir)
        os.makedirs(manager.profile_dir, exist_ok=True)
        self.assertTrue(os.path.exists(manager.profile_dir))
        
        # Cleanup
        if os.path.exists(profile_dir):
            os.rmdir(profile_dir)

if __name__ == "__main__":
    unittest.main()
