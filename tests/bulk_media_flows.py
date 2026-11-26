"""Exercise photo failures and separate map visuals in a real browser."""
import argparse
import os
from contextlib import nullcontext
from pathlib import Path
from urllib.parse import quote

from playwright.sync_api import expect, sync_playwright

from release import ROOT, serve


def verify(browser, base, width):
    context = browser.new_context(viewport={"width": width, "height": 900},
                                  has_touch=width == 390, is_mobile=width == 390,
                                  ignore_https_errors=bool(os.getenv("TEST_HTTPS_PROXY")))
    # Abort only images. Data, application scripts and the real guide remain unchanged.
    context.route("**/*", lambda route: route.abort() if route.request.resource_type == "image" else route.continue_())
    page = context.new_page()
    def visit(path):
        page.goto(base + "#/" + path, wait_until="domcontentloaded", timeout=90000)

    visit("")
    home = page.locator(".card:has(.home-art)").first
    home.scroll_into_view_if_needed()
    expect(home.locator(".home-art")).to_be_hidden()
    expect(home.locator("h3")).to_be_visible()
    assert "사진을 불러오지 못했습니다" in home.evaluate("c=>getComputedStyle(c,'::before').content")

    visit("entry/p09-re-041")
    article = page.locator("article.article")
    expect(article.locator(".intro .unavailable-photo")).to_be_visible()
    expect(article.locator(".intro figcaption a").first).to_be_visible()
    inset = article.locator("a.inset").first
    expect(inset).to_contain_text("위치 지도")
    inset.click()
    expect(page.locator(".selectedpin a.pin-cover .unavailable-photo")).to_be_visible()
    expect(page.locator('.selectedpin a[href="#/entry/p09-re-041"]').first).to_be_visible()

    visit("search?q=" + quote("요트에서 만나는 트레일러의 여성"))
    card = page.locator(".guide-card").filter(has=page.locator('h3 a[href="#/entry/p09-re-041"]'))
    expect(card.locator(".card-art .unavailable-photo")).to_be_visible()
    expect(card.locator('h3 a')).to_be_visible()

    visit("guide/p02")
    equipped = page.locator(".catalog-appearance").first
    expect(equipped.locator('a:not([data-action])')).to_be_visible()
    visit("entry/p09-hu")
    related = page.locator('a.related-card[href="#/entry/p09-re-051"]')
    related.scroll_into_view_if_needed()
    expect(related.locator("img")).to_have_count(0)
    expect(related.locator("span")).to_be_visible()

    # At least one catalog entry uses a bundled appearance in a zoom button,
    # and at least one links to an original image. Both must stay usable.
    for embedded in (False, True):
        ident = page.evaluate("""flag=> readerItems.find(v=>{
          if(!catalogEntry(v))return false;
          const a=catalogAppearance(v,photo(v));
          return flag?!!a.embedded:!!a.original&&!a.embedded;
        }).id""", embedded)
        title = page.evaluate("id=>findItem(id).title", ident)
        visit("search?q=" + quote(title))
        row = page.locator(f'.catalog-card:has(h3 a[href="#/entry/{ident}"])')
        row.scroll_into_view_if_needed()
        recovery = row.locator(".catalog-appearance a:not([data-action])")
        expect(recovery).to_be_visible()
        assert recovery.get_attribute("href")
        expect(row.locator('.catalog-appearance button')).to_have_count(0)
    # Verify original-only images remain direct references without becoming a
    # fabricated card or hero when the server does not grant preview rights.
    key = page.evaluate("()=>readerItems.find(v=>!representativePhoto(v)&&!catalogEntry(v)&&!photo(v)?.src).id")
    visit("entry/" + key)
    expect(page.locator("article h1")).to_be_visible()
    page.evaluate("""id=>{
      const v=findItem(id);(v.sources ||= []).unshift({url:"https://example.test/item-picture",label:"카드 외형 · 원본"});
      render();
    }""", key)
    original = page.locator('.original-photos a[href="https://example.test/item-picture"]')
    expect(original).to_be_visible()
    assert not page.locator('.article .intro img').count()
    sample = page.evaluate("()=>readerItems.find(v=>v.category==='P05').id")
    visit("entry/" + sample)
    page.evaluate("""id=>{
      findItem(id).sources.unshift({url:'https://youtu.be/abcdefghijk?t=90',label:'보호할 해답',reveal:'solution'});
      render();
    }""", sample)
    protected = page.locator("article .protected-video")
    expect(protected.locator("button")).to_be_hidden()
    assert "보호할 해답" not in page.locator("article").inner_text()
    protected.locator("summary").click()
    expect(protected.locator("button")).to_have_attribute("data-time", "90")
    assert not page.locator("article iframe").count()
    context.close()
    print(f"PASS {width}px: photo fallback on home, guide, search, detail, pin, related and both catalog image modes", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url")
    parser.add_argument("--directory", type=Path, default=ROOT / "dist")
    args = parser.parse_args()
    with (nullcontext(args.url) if args.url else serve(args.directory)) as host, sync_playwright() as api:
        opts = {"args": ["--no-sandbox"]}
        if path := os.getenv("CHROMIUM_PATH"):
            opts["executable_path"] = path
        if proxy := os.getenv("TEST_HTTPS_PROXY"):
            opts["proxy"] = {"server": proxy, "bypass": "localhost,127.0.0.1"}
        browser = api.chromium.launch(**opts)
        for viewport in (1365, 390):
            verify(browser, host, viewport)
        browser.close()
