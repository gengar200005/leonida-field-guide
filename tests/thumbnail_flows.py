"""Exercise the same thumbnails through actual desktop and mobile navigation."""
import argparse
from contextlib import nullcontext
import os

from playwright.sync_api import expect, sync_playwright

from release import ROOT, serve

YACHT = "#/entry/p09-re-041"
TITLE = "요트에서 만나는 트레일러의 여성"
YACHT_PHOTO = "https://fbritoferreira.github.io/gta6/screenshots/random-event-041.webp"


def picture(locator, expected=None):
    locator.scroll_into_view_if_needed()
    expect(locator).to_be_visible()
    if expected:
        expect(locator).to_have_attribute("src", expected)
    size = locator.evaluate("""async img => {
        await img.decode();
        return [img.naturalWidth, img.naturalHeight];
    }""")
    assert min(size) > 32, size
    return locator.get_attribute("src")


def reader(page, base, mobile):
    def visit(route):
        page.goto(base + route, wait_until="domcontentloaded", timeout=90000)

    def activate(control):
        control.tap() if mobile else control.click()

    def card_photo(route):
        return page.locator('a.card-art[href="' + route + '"] img')

    visit("#/guide/p09")
    page.locator('[data-change="region"]').select_option("바이스 시티")
    page.locator('[data-change="mission"]').select_option("랜덤 조우")
    cover = card_photo(YACHT)
    while not cover.count():
        more = page.locator('button[data-action="more"]')
        assert more.count(), "Yacht thumbnail missing from the category"
        activate(more)
    picture(cover, YACHT_PHOTO)

    search = page.locator("#searchbox")
    search.fill(TITLE)
    search.press("Enter")
    expect(page.locator("main h1")).to_have_text("검색 결과")
    picture(card_photo(YACHT), YACHT_PHOTO)
    activate(card_photo(YACHT))
    hero = page.locator("article .intro figure img")
    expect(page.locator("article h1")).to_have_text(TITLE)
    picture(hero, YACHT_PHOTO)
    expect(page.locator("article .intro figcaption")).to_contain_text("요트")
    activate(hero)
    picture(page.locator("#lightbox[open] img"), YACHT_PHOTO)
    activate(page.locator("#lightbox button"))
    activate(page.locator('article .tools [data-flag="favorite"]'))
    activate(page.locator('article a.inset').first)
    panel = page.locator(".selectedpin")
    expect(panel).to_contain_text(TITLE)
    picture(panel.locator("a.pin-cover img"), YACHT_PHOTO)
    activate(panel.locator("a.pin-cover"))
    expect(page.locator("article h1")).to_have_text(TITLE)
    page.reload(wait_until="domcontentloaded")
    expect(page.locator('article .tools [data-flag="favorite"]')).to_have_attribute("aria-pressed", "true")
    visit("#/mine?flag=favorite")
    picture(card_photo(YACHT), YACHT_PHOTO)

    visit("#/entry/p09-hu")
    related = page.locator('a.related-card[href="#/entry/p09-re-051"] img')
    related_src = picture(related)
    activate(related)
    picture(hero, related_src)

    visit("#/guide/p01?track=story")
    more = page.locator('button[data-action="more"]')
    expect(page.locator(".count")).to_contain_text("109")
    while more.count():
        activate(more)
    covers = page.locator(".cards .guide-card a.card-art img")
    expect(covers).to_have_count(109)
    assert len(set(covers.evaluate_all("imgs => imgs.map(img => img.closest('a').hash)"))) == 109

    visit("#/guide/p01?track=story&chapter=1")
    mission = card_photo("#/entry/p01-story-lab-fees")
    mission_src = picture(mission)
    activate(mission)
    picture(hero, mission_src)
    hidden = page.locator("article details.protected-photo").first
    expect(hidden.locator("summary")).to_be_visible()
    expect(hidden.locator("img")).to_have_count(0)
    assert mission_src != hidden.evaluate("d=>d.querySelector('template').content.querySelector('img').getAttribute('src')")

    visit("#/entry/p09-m-083")
    expect(page.locator("article h1")).to_contain_text("와이먼")
    alias_src = picture(hero)
    visit("#/entry/p09-wy")
    picture(hero, alias_src)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", help="Published site to test instead of the local dist.")
    args = parser.parse_args()
    with (nullcontext(args.url.split("#")[0]) if args.url else serve(ROOT / "dist")) as base, sync_playwright() as api:
        options = {"args": ["--no-sandbox", "--disable-dev-shm-usage"]}
        if os.getenv("CHROMIUM_PATH"):
            options["executable_path"] = os.environ["CHROMIUM_PATH"]
        if os.getenv("TEST_HTTPS_PROXY"):
            options["proxy"] = {"server": os.environ["TEST_HTTPS_PROXY"], "bypass": "localhost,127.0.0.1"}
        browser = api.chromium.launch(**options)
        for width in (1365, 390):
            mobile = width == 390
            ctx = browser.new_context(viewport={"width": width, "height": 900}, has_touch=mobile, is_mobile=mobile,
                                      ignore_https_errors=bool(os.getenv("TEST_HTTPS_PROXY")))
            reader(ctx.new_page(), base, mobile)
            print(f"PASS {width}px: category, search, detail, lightbox, map, favorites, related, spoiler and redirect", flush=True)
            ctx.close()
        browser.close()
