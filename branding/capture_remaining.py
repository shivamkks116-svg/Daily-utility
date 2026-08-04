import asyncio, os
from playwright.async_api import async_playwright

URL = "https://3c0dacac-6db8-44f9-a6fe-dd3ec7299a00.preview.emergentagent.com"
OUT = "/app/branding/screenshots"


async def wait_content(page, timeout=30):
    for _ in range(timeout):
        text = await page.evaluate("() => document.getElementById('root')?.innerText || ''")
        if text and len(text.strip()) > 0:
            return
        await page.wait_for_timeout(500)


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        ctx = await browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=3)
        page = await ctx.new_page()
        await page.goto(URL, wait_until="load", timeout=60000)
        await wait_content(page)
        await page.wait_for_timeout(3500)

        # Login as guest
        await page.get_by_test_id("login-guest-button").click()
        await page.wait_for_timeout(5000)

        # 05 AI Chat direct from home
        await page.get_by_test_id("quick-ai-chat").click()
        await page.wait_for_timeout(3000)
        inp = page.get_by_test_id("chat-input")
        await inp.fill("Give me 3 quick tips to focus better today")
        await page.get_by_test_id("chat-send-btn").click()
        for _ in range(45):
            await page.wait_for_timeout(1000)
            text = await page.evaluate("() => document.getElementById('root')?.innerText || ''")
            if "DAILYHUB" in text.upper() and len(text) > 800:
                break
        await page.wait_for_timeout(1500)
        await page.screenshot(path=f"{OUT}/raw-05-ai-chat.png", full_page=False)
        print("05 ai chat")

        # Focus
        await page.get_by_test_id("chat-back").click()
        await page.wait_for_timeout(1500)
        await page.get_by_test_id("quick-focus").click()
        await page.wait_for_timeout(3000)
        await page.screenshot(path=f"{OUT}/raw-06-focus.png", full_page=False)
        print("06 focus")

        # Habits
        await page.get_by_test_id("focus-back").click()
        await page.wait_for_timeout(1500)
        await page.get_by_test_id("quick-habits").click()
        await page.wait_for_timeout(3000)
        await page.screenshot(path=f"{OUT}/raw-07-habits.png", full_page=False)
        print("07 habits")

        # Premium - navigate via profile avatar in home
        await page.get_by_test_id("habits-back").click()
        await page.wait_for_timeout(1500)
        await page.get_by_test_id("profile-avatar-button").click()
        await page.wait_for_timeout(2000)
        await page.get_by_test_id("premium-upgrade-btn").click()
        await page.wait_for_timeout(3000)
        await page.screenshot(path=f"{OUT}/raw-08-premium.png", full_page=False)
        print("08 premium")

        await browser.close()

asyncio.run(main())
