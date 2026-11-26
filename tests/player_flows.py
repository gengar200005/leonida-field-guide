"""Exercise player-visible routes on a local build or GitHub Pages.

Run: python tests/player_flows.py http://localhost:8000/
Requires Playwright for Python and Chromium. Each run uses fresh browser storage.
"""
import os
import re
import sys
from urllib.parse import quote

from playwright.sync_api import expect, sync_playwright


def run(context, base, mobile):
    page = context.new_page()
    page.set_default_timeout(18000)
    errors = []
    page.on("pageerror", lambda err: errors.append(str(err)))

    def visit(path):
        page.goto(base + "#" + path, wait_until="domcontentloaded", timeout=90000)
        page.locator("main h1").first.wait_for()

    visit("/")
    expect(page.locator("h1")).to_contain_text("리오나이다")
    assert not page.evaluate('performance.getEntriesByType("resource").some(r=>r.name.includes("guide-data.js"))')
    page.locator('a[href="#/guide/v"]').first.click()
    vehicle = page.locator(".catalog-card").filter(has=page.locator('a[href="#/entry/v-56"]')).first
    thumb = vehicle.locator(".catalog-appearance img")
    thumb.scroll_into_view_if_needed()
    assert thumb.evaluate("img=>img.decode().then(()=>img.naturalWidth>0)")
    vehicle.locator(".catalog-appearance button").click()
    expect(page.locator("#lightbox")).to_be_visible()
    expect(page.locator("#lightbox img")).to_be_visible()
    page.get_by_role("button", name="닫기", exact=True).click()
    vehicle.locator('a[href^="#/map"]').first.click()
    expect(page.locator(".selectedpin")).to_contain_text("치타")
    page.locator('.selectedpin .links a[href="#/entry/v-56"]').click()
    expect(page.locator("h1")).to_contain_text("치타")

    page.locator("#searchbox").fill("Assassin Nipper")
    page.locator("#searchbox").press("Enter")
    page.locator('main a[href="#/entry/p02-w-001"]').first.click()
    expect(page.locator("article.article")).to_contain_text("난파선")
    visit("/entry/l03")
    answer = page.locator("details.panel").filter(has=page.locator("summary", has_text="상호작용")).first
    expect(answer.locator("summary")).to_be_visible()
    assert not answer.evaluate("el=>el.open")
    answer.locator("summary").click()
    assert answer.evaluate("el=>el.open") and len(answer.inner_text()) > 40

    visit("/guide/p01")
    page.locator('select[data-change="chapter"]').select_option("2")
    page.locator('main a[href="#/entry/p01-c02-motel"]').first.click()
    expect(page.locator("article.article")).to_contain_text("카드")
    expect(page.locator("article.article")).to_contain_text("저장")
    check = page.locator('.discovery-checklist button[data-flag="done"]').first
    check.click()
    expect(check).to_have_attribute("aria-pressed", "true")
    check.click()
    expect(check).to_have_attribute("aria-pressed", "false")

    for landmark, region in [("발코니", "사우스사이드"), ("노란 상자", "포트 겔혼")]:
        visit("/entry/p06-c-vfl-04")
        section = page.locator("section.panel").filter(has=page.locator("h2", has_text=landmark)).first
        section.get_by_role("link", name="이 획득 지점 지도에서 보기").click()
        expect(page.locator(".selectedpin")).to_contain_text(region)

    item = "p06-c-lco-23"
    visit("/map?item=" + item)
    selected = page.locator(".selectedpin")
    expect(selected.locator('.links a[href="#/entry/' + item + '"]')).to_be_visible()
    # The second tab stays on the live record while the map writes to the same save.
    other = context.new_page()
    other.goto(base + "#/entry/" + item, wait_until="domcontentloaded", timeout=90000)
    detail_done = other.locator('.tools button[data-flag="done"]')
    expect(detail_done).to_have_attribute("aria-pressed", "false")
    page.locator('[data-map-action="done"]').click()
    expect(detail_done).to_have_attribute("aria-pressed", "true")
    page.locator('[data-map-filter="undone"]').check()
    expect(page.locator('.selectedpin a[href="#/entry/' + item + '"]')).to_have_count(0)
    page.reload(wait_until="domcontentloaded")
    expect(page.locator('[data-map-filter="undone"]')).to_be_checked()
    page.locator('nav a[href="#/mine"]').click()
    page.locator('a[href="#/mine?flag=done"]').click()
    expect(page.locator('main a[href="#/entry/' + item + '"]').first).to_be_visible()
    detail_done.click()
    expect(page.locator('main a[href="#/entry/' + item + '"]')).to_have_count(0)
    other.close()

    visit("/map?q=" + quote("레인보우 리플"))
    expect(page.locator(".pinlist")).to_contain_text("보트")
    page.locator('[data-map-cat="V"]').click()
    page.locator('[data-map-cat="P06"]').click()
    expect(page.locator('[data-map-cat="V"]')).to_have_attribute("aria-pressed", "true")
    expect(page.locator('[data-map-cat="P06"]')).to_have_attribute("aria-pressed", "true")
    page.get_by_role("button", name="지도 확대", exact=True).click()
    expect(page.locator(".mapcontrols")).to_contain_text("150%")
    page.locator('[data-map-action="fullscreen"]').click()
    expect(page.locator("body")).to_have_class(re.compile("map-full"))
    viewport = page.locator(".mapview")
    viewport.scroll_into_view_if_needed()
    bounds = viewport.bounding_box()
    x, y = bounds["x"] + bounds["width"] * .5, bounds["y"] + bounds["height"] * .5
    if mobile:
        device = context.new_cdp_session(page)
        def pinch(event, span=None):
            points = [] if span is None else [{"x": x + sign * span, "y": y, "id": idx}
                                               for idx, sign in [(1, -1), (2, 1)]]
            device.send("Input.dispatchTouchEvent", {"type": event, "touchPoints": points})
        pinch("touchStart", 30)
        pinch("touchMove", 45)
        pinch("touchMove", 63)
        pinch("touchEnd")
        device.detach()
    else:
        page.mouse.move(x, y)
        page.mouse.wheel(0, -120)
    expect(page.locator(".mapcontrols span")).not_to_have_text("150%")
    page.locator('[data-map-action="fullscreen"]').click()
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1")
    assert not errors, errors
    print("PASS", "mobile touch viewport" if mobile else "desktop", flush=True)


if __name__ == "__main__":
    base = sys.argv[1].split("#", 1)[0]
    with sync_playwright() as api:
        args = {"args": ["--no-sandbox"]}
        if os.getenv("CHROMIUM_PATH"):
            args["executable_path"] = os.environ["CHROMIUM_PATH"]
        if os.getenv("TEST_HTTPS_PROXY"):
            args["proxy"] = {"server": os.environ["TEST_HTTPS_PROXY"], "bypass": "localhost,127.0.0.1"}
        browser = api.chromium.launch(**args)
        for mobile in (False, True):
            context = browser.new_context(viewport={"width": 390 if mobile else 1365, "height": 900},
                                          has_touch=mobile, ignore_https_errors=True)
            run(context, base, mobile)
            context.close()
        browser.close()
