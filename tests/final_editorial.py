"""Check category membership through the reader, map and search on desktop and touch."""
import argparse
import json
import os
import re
from contextlib import nullcontext
from pathlib import Path
from urllib.parse import quote, urlsplit

from playwright.sync_api import expect, sync_playwright

from release import ROOT, serve


def open_route(page, base, route):
    page.goto(base + "#/" + route, wait_until="domcontentloaded", timeout=90000)
    page.wait_for_function("typeof categoryItems === 'function'")
    page.wait_for_function("location.hash.startsWith('#/entry/') ? !!document.querySelector('main article h1') : !!document.querySelector('main h1')")


def list_ids(page):
    # Use the same "more" action as the reader. Batch it in-page to avoid thousands
    # of screenshot/layout round trips on a 1,200-entry mobile collection.
    return page.evaluate("""() => {
        let more;
        while ((more = document.querySelector('.more[data-action="more"]'))) more.click();
        const key = a => a.getAttribute('href').split('/').pop();
        return {
            cards: Array.from(document.querySelectorAll('.cards article h3 a'), key),
            guides: Array.from(document.querySelectorAll('.catalog-guides a[href^="#/entry/"]'), key),
            count: document.querySelector('.browse-filters .count').textContent
        };
    }""")


def verify_catalogs(page, base):
    open_route(page, base, "guide/p01")
    expected = page.evaluate("""() => Object.fromEntries(Object.keys(categories).map(key => {
        const entries = readerItems.filter(v => v.category === key);
        const separated = ['V','P02'].includes(key);
        return [key, {
            cards: entries.filter(v => !separated || catalogEntry(v)).map(v => v.id),
            guides: entries.filter(v => separated && !catalogEntry(v)).map(v => v.id)
        }];
    }))""")
    counts = {}
    for category, owned in expected.items():
        open_route(page, base, "guide/" + category.lower())
        expect(page.locator("main h1")).to_have_text(page.evaluate("c => categories[c][0]", category))
        result = list_ids(page)
        cards = result["cards"]
        expected_cards = set(owned["cards"])
        assert set(cards) == expected_cards, (category, "foreign or missing cards", set(cards) ^ expected_cards)
        assert len(cards) == len(expected_cards), (category, "duplicate cards")
        assert set(owned["guides"]).issubset(result["guides"]), (category, "missing catalog guides")
        numeric_count = int(re.search(r"[0-9,]+", result["count"]).group().replace(",", ""))
        assert numeric_count == len(cards), (category, result["count"], len(cards))
        counts[category] = {"cards": len(cards), "separateGuides": len(owned["guides"])}
    return counts


def verify_map(page, base):
    open_route(page, base, "map")
    expected = page.evaluate("""() => Object.fromEntries(mapCategories.map(c => [c,
        mapped.filter(p => findItem(p.item).category === c).map(p => p.id)]))""")
    counts = {}
    for cat, owned in expected.items():
        open_route(page, base, "map?cat=" + cat)
        expect(page.locator(f'button[data-map-cat="{cat}"]')).to_have_attribute("aria-pressed", "true")
        active = page.evaluate("""() => ({
          pins: mapList.map(pin => pin.id),
          first: Array.from(document.querySelectorAll('.pinlist button[data-pin]'),b=>b.dataset.pin),
          foreignRefs: Array.from(document.querySelectorAll('.map-references a[href^="#/entry/"]'),
                        a => findItem(a.getAttribute('href').split('/').pop()).category)
        })""")
        assert set(active["pins"]) == set(owned), (cat, set(active["pins"]) ^ set(owned))
        assert len(owned) == len(active["pins"]) == len(set(owned))
        assert active["first"] == active["pins"][:len(active["first"])]
        assert bool(owned) == bool(active["first"]), cat
        assert all(c == cat for c in active["foreignRefs"]), cat
        expect(page.locator(".map-filters .count")).to_have_text(f"{len(owned):,}개 핀")
        counts[cat] = len(owned)
    return counts


def verify_identity(page, base):
    usual = "p07-garages"
    old = "p03-ec39"
    page.evaluate("""([old, id]) => localStorage.setItem('leonida-guide-v1',JSON.stringify({
        version:1, items:{[id]:{later:true}, [old]:{favorite:true, done:true}}}))""", [old, usual])
    page.reload(wait_until="domcontentloaded")
    open_route(page, base, "entry/" + old)
    expect(page.locator("article h1")).to_contain_text("차고")
    assert page.url.endswith("#/entry/" + usual)
    for flag in ("done", "favorite", "later"):
        expect(page.locator(f'article .tools [data-flag="{flag}"]')).to_have_attribute("aria-pressed", "true")
    article = page.locator("article.article")
    # The source-only record supplies the combined purchase cost and the caution
    # against subtracting the same discount twice. Keep its original evidence.
    assert "$160,000" in article.text_content()
    for host in ("gtabase.com", "videogameschronicle.com", "gta.tech4gamers.com"):
        assert article.locator(f'a[href*="{host}"]').count() > 0, host
    saved = page.evaluate("JSON.parse(localStorage.getItem('leonida-guide-v1')).items")
    assert old not in saved and saved[usual]["done"] and saved[usual]["favorite"]

    for c in ("P07", "P03"):
        open_route(page, base, "search?q=" + quote("차고") + "&cat=" + c)
        expect(page.locator("main h1")).to_have_text("검색 결과")
        result = list_ids(page)["cards"]
        assert (usual in result) == (c == "P07")
        assert old not in result
        assert page.evaluate("ids=>ids.map(id=>findItem(id).category)", result) == [c] * len(result)
    open_route(page, base, "map?item=p03-sa036&pin=p03-sa036%2Fsafe-045")
    expect(page.locator('.selectedpin a[href="#/entry/l32"]').first).to_be_visible()
    assert "pin=l32%2Fsafe-045" in page.url
    open_route(page, base, "entry/i026")
    assert page.url.endswith("#/entry/p09-re-149")
    amount = page.locator("article details").filter(has_text="$1,280")
    assert amount.count() >= 1
    expect(amount.first).not_to_have_attribute("open", "")
    assert "$1,280" not in page.locator("article").inner_text()
    # Shared sites and successive stages still have independently tracked entries.
    assert page.evaluate("""() => {
        const distinct = ['p09-m-007','p09-m-008','p02-w-007','p02-w-016','p01-story-checking-out','p01-story-overnight-charges'];
        return new Set(distinct.map(id=>findItem(id)?.id)).size === distinct.length &&
               distinct.every(id=>findItem(id)?.id===id);
    }""")
    open_route(page, base, "guide/p01?track=story")
    expect(page.locator("main .count")).to_have_text("109개 공략")
    ids = list_ids(page)["cards"]
    assert len(set(ids)) == 109 and "p09-m-077" in ids
    assert page.evaluate("""ids=>ids.every(id=>findItem(id).category==='P01' && representativePhoto(findItem(id)))""", ids)
    assert page.evaluate("""() => {
        const vehicles=readerItems.filter(v=>v.category==='V' && catalogEntry(v));
        return vehicles.length===282 && vehicles.every(v=>representativePhoto(v));
    }""")
    open_route(page, base, "entry/p09-m-077")
    expect(page.locator("article h1")).to_contain_text("제이슨")
    assert page.locator('.trail a[href="#/guide/p01"]').count()


def verify(base, offline):
    result = {}
    with sync_playwright() as api:
        opts = {"args": ["--no-sandbox", "--disable-dev-shm-usage"]}
        if os.getenv("CHROMIUM_PATH"):
            opts["executable_path"] = os.environ["CHROMIUM_PATH"]
        if os.getenv("TEST_HTTPS_PROXY"):
            opts["proxy"] = {"server": os.environ["TEST_HTTPS_PROXY"], "bypass": "localhost,127.0.0.1"}
        browser = api.chromium.launch(**opts)
        for width in (1365, 390):
            context = browser.new_context(viewport={"width":width,"height":900}, has_touch=width==390,
                                          is_mobile=width==390, ignore_https_errors=bool(os.getenv("TEST_HTTPS_PROXY")))
            if offline:
                origin = urlsplit(base).netloc
                context.route("**/*", lambda route: route.continue_() if urlsplit(route.request.url).netloc==origin else route.abort())
            page = context.new_page()
            errors = []
            page.on("pageerror", lambda exc: errors.append(str(exc)))
            cats = verify_catalogs(page, base)
            pins = verify_map(page, base)
            verify_identity(page, base)
            assert not errors, errors
            result[str(width)] = {"category": cats, "map": pins, "story":109, "vehicles":282, "saveAndSearch":True}
            print(f"PASS {width}px: category lists, unique pins, redirects, merged save and search", flush=True)
            context.close()
        browser.close()
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url")
    parser.add_argument("--offline", action="store_true", help="Block external requests on local regression runs.")
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    with (nullcontext(args.url.split("#")[0]) if args.url else serve(ROOT/"dist")) as base:
        result = verify(base, args.offline)
    if args.report:
        args.report.write_text(json.dumps(result, indent=2, ensure_ascii=False)+"\n")
