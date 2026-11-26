"""Run player regressions on a build or on Pages; optionally collect viewport captures."""
import argparse
import functools
import json
import os
import threading
from contextlib import contextmanager
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import quote, urlsplit

from playwright.sync_api import expect, sync_playwright

from player_flows import run as player_flows


ROOT = Path(__file__).resolve().parents[1]
VIEWS = (
    ("home", "/"),
    ("story", "/guide/p01?track=story"),
    ("missions", "/guide/p09"),
    ("mission", "/entry/p09-wy"),
    ("story-detail", "/entry/p01-story-lab-fees"),
    ("chapter-four", "/guide/p01?track=story&chapter=4"),
    ("campaign-finale", "/entry/p01-story-the-end-of-the-road"),
    ("aquarium", "/entry/p09-m-004"),
    ("shipwreck", "/entry/w22"),
    ("vehicles", "/guide/v"),
    ("weapons", "/guide/p02"),
    ("secret", "/entry/l03"),
    ("collection", "/entry/p06-c-vfl-04"),
    ("map", "/map?item=p06-c-lco-23"),
    ("mine", "/mine?flag=favorite"),
)


@contextmanager
def serve(directory):
    class Quiet(SimpleHTTPRequestHandler):
        def log_message(self, *args):
            pass

    handler = functools.partial(Quiet, directory=str(directory))
    with ThreadingHTTPServer(("127.0.0.1", 0), handler) as server:
        worker = threading.Thread(target=server.serve_forever, daemon=True)
        worker.start()
        try:
            yield f"http://127.0.0.1:{server.server_port}/"
        finally:
            server.shutdown()
            worker.join()


def verify_merged_entry(page, address):
    # A save can contain different flags on the old aliases and on the representative.
    page.goto(address + "#/", wait_until="domcontentloaded")
    page.evaluate("""() => localStorage.setItem('leonida-guide-v1', JSON.stringify({
        version: 1, items: {'p09-m-083': {favorite:true}, 'p09-wy-guide': {done:true},
                            'p09-wy': {later:true}}}))""")
    page.goto(address + "#/entry/p09-m-083", wait_until="domcontentloaded")
    article = page.locator("article.article")
    expect(article.locator("h1")).to_contain_text("와이먼")
    for flag in ("favorite", "done", "later"):
        expect(article.locator(f'.tools [data-flag="{flag}"]')).to_have_attribute("aria-pressed", "true")
    for fragment in ("루시아", "$50", "+3%"):
        expect(article).to_contain_text(fragment)
    assert article.locator('a[href*="howtovideogame.com/gta-6-wyman-car"]').count()
    assert article.locator('a[href*="metaforge.app/gta-6/gta-6-chapter-2-optional-tasks"]').count()
    page.reload(wait_until="domcontentloaded")
    expect(article.locator('.tools [data-flag="done"]')).to_have_attribute("aria-pressed", "true")
    assert page.evaluate("""() => {
        const {items, redirects, pins} = window.FIELD_GUIDE;
        const ids = new Set(items.map(i=>i.id.toLowerCase()));
        const distinct = ['p09-m-007','p09-m-008','v-01','v-21','p09-at','p09-re-221'];
        const resolve = k=>redirects[k] || k;
        return !ids.has('p09-m-083') && !ids.has('p09-wy-guide') &&
               resolve('p09-wy-guide') === 'p09-wy' && resolve('p09-m-083') === 'p09-wy' &&
               resolve('p03-go01') === 'p04-01' &&
               distinct.every(k=>ids.has(resolve(k))) && new Set(distinct.map(resolve)).size===distinct.length &&
               pins.every(p=>ids.has(p.item.toLowerCase())) &&
               items.every(i=>(i.related||[]).every(k=>ids.has(resolve(k.toLowerCase())))) &&
               Object.entries(redirects).every(([old, id])=>old!==id && ids.has(id.toLowerCase()));
    }""")
    page.goto(address + "#/map?item=p03-go01&pin=p03-go01%2Fgang-operation-001", wait_until="domcontentloaded")
    expect(page.locator('.selectedpin .links a[href="#/entry/p04-01"]')).to_be_visible()
    assert "item=p04-01" in page.url
    page.goto(address + "#/search?q=" + quote("와이먼의 열린 보닛"), wait_until="domcontentloaded")
    expect(page.locator('main a[href="#/entry/p09-wy"]').first).to_be_visible()
    assert not page.locator('main a[href="#/entry/p09-wy-guide"]').count()
    page.goto(address + "#/mine?flag=done", wait_until="domcontentloaded")
    expect(page.locator('main a[href="#/entry/p09-wy"]').first).to_be_visible()
    assert not page.locator('main a[href="#/entry/p09-wy-guide"], main a[href="#/entry/p09-m-083"]').count()


def verify_shores(page, address, mobile, output=None):
    page.goto(address + "#/map?q=qa-empty-pin-list", wait_until="domcontentloaded")
    view = page.locator(".mapview")
    expect(view).to_be_visible()
    tip = page.locator(".map-region-tooltip")
    assert not view.locator("canvas.map-region-shade").count()
    path = view.locator(".map-boundary-overlay path").first
    switch = page.get_by_role("button", name="지역 음영", exact=True)
    expect(switch).to_have_attribute("aria-pressed", "true")

    def point_at(x, y):
        view.scroll_into_view_if_needed()
        screen = view.evaluate("""async (v, [x,y])=>{
            const c=v.querySelector('.mapcanvas'), fx=(x+12288)/18432, fy=(12288-y)/22528;
            v.scrollLeft=fx*c.clientWidth-v.clientWidth/2;
            v.scrollTop=fy*c.clientHeight-v.clientHeight/2;
            await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
            const r=c.getBoundingClientRect();
            return [r.left+fx*r.width,r.top+fy*r.height];
        }""", [x, y])
        if mobile:
            page.touchscreen.tap(*screen)
        else:
            page.mouse.move(screen[0]-2, screen[1]-1)
            page.mouse.move(*screen)

    # Ocean Beach's former circle includes the stretch of sea at (2350,605).
    points = ((902, 495, "스타피시", False), (-7484, 5025, "드레이퍼", False),
              (-5580, -1418, "빅 파인", True), (-6402, 3766, "포트 겔혼", True),
              (-3950, 80, None, False), (2350, 605, None, False), (-10800, -9000, None, False))
    for enlarged in (False, True):
        if enlarged:
            page.get_by_role("button", name="지도 확대", exact=True).click()
        for x, y, name, estimated in points:
            point_at(x, y)
            if not name:
                expect(tip).to_be_hidden()
                assert not path.get_attribute("d")
                continue
            expect(tip).to_be_visible()
            expect(tip).to_contain_text(name)
            assert ("대략적인 지역 범위" in tip.inner_text()) == estimated
            assert path.evaluate("p=>getComputedStyle(p).strokeDasharray !== 'none'") == estimated
            expect(path).to_be_visible()
            assert len(path.get_attribute("d") or "") > 50
            if output and enlarged and name in ("스타피시", "빅 파인"):
                kind = "inland" if estimated else "coast"
                view.screenshot(path=output/f"{390 if mobile else 1365}-{kind}.jpg", type="jpeg", quality=85)
    switch.click()
    page.reload(wait_until="domcontentloaded")
    expect(switch).to_have_attribute("aria-pressed", "false")
    point_at(-5580, -1418)
    expect(tip).to_contain_text("빅 파인")
    assert not path.get_attribute("d")
    switch.click()
    point_at(-5580, -1418)
    expect(switch).to_have_attribute("aria-pressed", "true")
    assert path.get_attribute("d")


def verify_icons(page):
    manifest_url = page.locator('link[rel="manifest"]').evaluate("a=>a.href")
    response = page.request.get(manifest_url)
    assert response.ok
    manifest = response.json()
    assert (manifest["name"], manifest["short_name"]) == ("리오나이다 필드 가이드", "GTA VI 가이드")
    assert manifest["display"] == "standalone"
    ico_url = page.locator('link[href$=".ico"]').evaluate("a=>a.href")
    assert page.request.get(ico_url).ok
    page.evaluate("""async ([m, url]) => {
        const resolve = p=>new URL(p,url).href;
        if(resolve(m.scope)!==new URL('./',location.href).href || resolve(m.start_url)!==resolve('./#/'))
            throw Error('Incorrect Pages scope or launch URL');
        for(const [purpose,size] of [['any',192],['any',512],['maskable',512],['apple',180],['svg',0],['ico',0]]){
            const asset=m.icons.find(i=>i.purpose===purpose && i.sizes===size+'x'+size);
            const selector={apple:'link[rel="apple-touch-icon"]',svg:'link[type="image/svg+xml"]',ico:'link[href$=".ico"]'}[purpose];
            const href=selector?document.querySelector(selector).href:resolve(asset.src);
            if(!href.startsWith(resolve(m.scope)))throw Error(href);
            // Playwright intercepts the implicit /favicon.ico request when routing is enabled.
            const response=await fetch(purpose==="ico"?href+"?decode":href);
            if(!response.ok)throw Error(href + " " + response.status);
            const img=new Image(); img.src=URL.createObjectURL(await response.blob());
            try { await img.decode(); } catch(e) { throw Error(href + " " + e.message); }
            finally { URL.revokeObjectURL(img.src); }
            if(!img.naturalWidth || (size && (img.naturalWidth!==size || img.naturalHeight!==size)))throw Error(href);
        }
    }""", [manifest, manifest_url])


def verify_story(page, base):
    page.goto(base + "#/", wait_until="domcontentloaded")
    page.locator('main a[href="#/guide/p01?track=story"]').first.click()
    page.locator('main a[href="#/entry/p01-story-lab-fees"]').first.click()
    title = page.locator("article.article h1")
    expect(title).to_contain_text("월세")
    article = page.locator("article.article")
    expect(article).to_contain_text("우편함")
    dark = article.locator("details.protected-photo").first
    expect(dark.locator("summary")).to_be_attached()
    source = dark.evaluate("d=>d.querySelector('template').content.querySelector('img').getAttribute('src')")
    assert not any(url.endswith(source) for url in page.evaluate('performance.getEntriesByType("resource").map(v=>v.name)'))
    assert not dark.locator("img").count()
    answer = article.locator('details.panel').filter(has=page.locator('summary', has_text='두 키패드'))
    expect(answer.locator("ol")).to_be_hidden()
    dark.locator("summary").click()
    image = dark.locator("img")
    expect(image).to_be_visible()
    image.scroll_into_view_if_needed()
    expect(image).to_have_js_property("complete", True)
    assert image.evaluate("im=>im.decode().then(()=>im.naturalWidth>0)"), source
    dark.get_by_role("button").click()
    expect(page.locator("#lightbox img")).to_be_visible()
    page.get_by_role("button", name="닫기", exact=True).click()
    answer.locator("summary").click()
    expect(answer.locator("ol")).to_contain_text("0420")



def verify_campaign(page, base):
    article = page.locator("article.article")
    page.goto(base + "#/guide/p01?track=story", wait_until="domcontentloaded")
    expect(page.locator("main .count")).to_have_text("109개 공략")
    page.locator('select[data-change="chapter"]').select_option("1")
    page.locator('select[data-change="purpose"]').select_option("필수 진행 과제")
    expect(page.locator("main .count")).to_have_text("3개 공략")
    page.get_by_text("함께 할 선택 의뢰", exact=False).first.click()
    expect(page.locator('main li').filter(has_text="시한 주의").first).to_be_visible()
    page.goto(base + "#/entry/p01-story-pipework", wait_until="domcontentloaded")
    expect(article.get_by_text("지도 목표 · 맨디에게 월세 받기")).to_be_visible()
    original = article.get_by_text("Collect Mandy’s Rent", exact=True).last
    expect(original).to_be_hidden()
    article.get_by_text("지도 목표 영문 표기").click()
    expect(original).to_be_visible()
    article.get_by_text("확인된 선행 미션 보기").click()
    expect(article.locator('details[open] a[href="#/entry/p01-story-just-a-scratch"]')).to_be_visible()
    page.goto(base + "#/guide/p01?track=story", wait_until="domcontentloaded")
    page.locator('select[data-change="chapter"]').select_option("2")
    expect(page.locator("main .count")).to_have_text("18개 공략")
    page.locator('.card a[href="#/entry/p09-m-077"]').first.click()
    expect(article.locator("h1")).to_contain_text("제이슨")
    walk = article.get_by_role("navigation", name="스토리 미션 이동")
    walk.get_by_role("link", name="다음 공략").click()
    expect(article.locator("h1")).to_be_visible()
    assert page.url.endswith("#/entry/p01-story-overnight-charges")
    walk.get_by_text("챕터 2 미션 목록").click()
    expect(page.locator('select[data-change="chapter"]')).to_have_value("2")

    page.goto(base + "#/search?q=" + quote("Blood Sweat and Gear"), wait_until="domcontentloaded")
    page.locator('main a[href="#/entry/p01-story-making-gainz"]').first.click()
    expect(article).to_contain_text("트라우마 플로어")
    page.goto(base + "#/entry/p01-story-the-end-of-the-road", wait_until="domcontentloaded")
    ending = article.locator("details.panel").filter(has=page.locator("summary", has_text="다리의 두 선택"))
    expect(ending.locator("summary")).to_be_visible()
    expect(ending.locator("ol, p").first).to_be_hidden()
    assert not page.locator("main iframe").count()
    ending.locator("summary").click()
    expect(ending.locator("ol, p").first).to_be_visible()

    page.goto(base + "#/entry/p09-m-004", wait_until="domcontentloaded")
    expect(article).to_contain_text("크리스털")
    hero = article.locator(".intro img").first
    expect(hero).to_be_visible()
    assert hero.evaluate("im=>im.decode().then(()=>im.naturalWidth>0)")
    point = article.locator('a.inset[href*="p09-m-004"]').first
    point.click()
    expect(page.locator(".selectedpin a[href='#/entry/p09-m-004']").first).to_be_visible()

    page.goto(base + "#/entry/l04", wait_until="domcontentloaded")
    hint = article.locator("details.panel").filter(has=page.locator("summary", has_text="위층에서 단서"))
    answer = article.locator("details.panel").filter(has=page.locator("summary", has_text="금고의 정답"))
    expect(answer.locator("ol")).to_be_hidden()
    hint.locator("summary").click()
    expect(hint).not_to_contain_text("955214")
    expect(answer.locator("ol")).to_be_hidden()
    answer.locator("summary").click()
    expect(answer.locator("ol")).to_contain_text("955214")


def inspect_views(page, address, output, width):
    samples = []
    for name, path in VIEWS:
        page.goto(address + "#" + path, wait_until="domcontentloaded")
        heading = page.locator("main h1").first
        expect(heading).to_be_visible()
        assert "찾을 수 없습니다" not in heading.inner_text(), path
        page.evaluate("document.fonts.ready")
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth+1"), (width, path)
        broken = page.locator('main a[href^="#/entry/"]').evaluate_all("""links => {
            if (!window.FIELD_GUIDE) return [];
            const d = window.FIELD_GUIDE;
            const ids = new Set(d.items.map(i=>i.id.toLowerCase()));
            return links.map(a=>decodeURIComponent(a.hash.slice(8)).split('?')[0].toLowerCase())
                .filter(id=>!ids.has(id) && !ids.has(d.redirects[id]));
        }""")
        assert not broken, (path, broken)
        if output:
            # Lazy media outside the viewport is intentionally not forced to download.
            page.evaluate("""async () => {
                const shown=[...document.images].filter(im=>{
                    const r=im.getBoundingClientRect();return r.width && r.bottom>0 && r.top<innerHeight;
                });
                await Promise.race([Promise.allSettled(shown.map(im=>im.decode())),
                                    new Promise(resolve=>setTimeout(resolve,6000))]);
            }""")
            page.screenshot(path=output/f"{width}-{name}.jpg", type="jpeg", quality=80, timeout=20000)
        samples.append({"route": path, "heading": heading.inner_text()})
    return samples


def inspect(base, offline, output):
    if output:
        output.mkdir(parents=True, exist_ok=True)
    results = {}
    with sync_playwright() as api:
        options = {"args": ["--no-sandbox", "--disable-dev-shm-usage"]}
        if os.environ.get("CHROMIUM_PATH"):
            options["executable_path"] = os.environ["CHROMIUM_PATH"]
        if os.environ.get("TEST_HTTPS_PROXY"):
            options["proxy"] = {"server": os.environ["TEST_HTTPS_PROXY"], "bypass": "localhost,127.0.0.1"}
        browser = api.chromium.launch(**options)
        for width in (1365, 390):
            ctx = browser.new_context(viewport={"width":width,"height":900}, has_touch=width==390,
                                      ignore_https_errors=bool(os.getenv("TEST_HTTPS_PROXY")))
            if offline:
                netloc = urlsplit(base).netloc
                ctx.route("**/*", lambda req: req.continue_() if urlsplit(req.request.url).netloc == netloc else req.abort())
            player_flows(ctx, base, width==390)
            page = ctx.new_page()
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            verify_merged_entry(page, base)
            verify_icons(page)
            verify_shores(page, base, width==390, output)
            verify_story(page, base)
            verify_campaign(page, base)
            results[width] = inspect_views(page, base, output, width)
            assert not errors, errors
            print(f"PASS {width}px: legacy URLs, union of save flags, source retention, coastal and inland overlays, install icons, 109-mission chronology, shared mission IDs, aquarium route, progressive clues, protected endings and reader routes", flush=True)
            ctx.close()
        browser.close()
    if output:
        (output/"routes.json").write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", help="Test a published site instead of serving a local build.")
    parser.add_argument("--directory", type=Path, default=ROOT/"dist")
    parser.add_argument("--offline", action="store_true", help="Disable third-party requests. Bundled assets must work.")
    parser.add_argument("--captures", type=Path)
    args = parser.parse_args()
    if args.url:
        inspect(args.url.split("#")[0], args.offline, args.captures)
    else:
        with serve(args.directory) as local:
            inspect(local, args.offline, args.captures)
