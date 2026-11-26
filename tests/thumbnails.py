"""Audit the actual list, detail and pin renderers. Run after build.py; use --decode online."""
import argparse
from contextlib import nullcontext
import json
import os
from pathlib import Path

from release import ROOT, serve, sync_playwright


def check(base, decode):
    with sync_playwright() as api:
        options = {"args": ["--no-sandbox"]}
        if os.getenv("CHROMIUM_PATH"):
            options["executable_path"] = os.environ["CHROMIUM_PATH"]
        if os.getenv("TEST_HTTPS_PROXY"):
            options["proxy"] = {"server": os.environ["TEST_HTTPS_PROXY"], "bypass": "localhost,127.0.0.1"}
        browser = api.chromium.launch(**options)
        page = browser.new_page(ignore_https_errors=bool(os.getenv("TEST_HTTPS_PROXY")))
        page.goto(base + "#/entry/p09-re-041", wait_until="domcontentloaded", timeout=90000)
        page.wait_for_function("typeof relatedCard==='function'", timeout=60000)
        rows = page.evaluate("""()=>readerItems.map(v=>{
          const src=markup=>{const t=document.createElement('template');t.innerHTML=markup;
            return t.content.querySelector('img')?.getAttribute('src')||''};
          const pic=src(card(v)),hero=src(photoFigure(v)),pin=pinLinks(v)[0];
          const related=src(relatedCard(v)),map=pin?src(pinCover(pin)):null;
          if(pic!==related || (pin && pic!==map) || (pic && !hero))throw Error(v.id+' inconsistent surfaces');
          const guarded=[photo(v),...(v.gallery||[])].filter(Boolean).flatMap(m=>
              [m.reveal && m.src,m.originalReveal && m.originalPhoto].filter(Boolean));
          if(pic && guarded.includes(pic))throw Error(v.id+' protected thumbnail');
          return {id:v.id,category:v.category,story:v.track==='story',major:['현장 안내','조건부 접근'].includes(v.evidenceGroup),
                  readerGroup:v.category==="P09"?missionBrowseType(v):null,pic,hero,map};
        })""")
        redirects = page.evaluate("redirects")
        home_mismatches = page.evaluate("""()=>{
            const tpl = document.createElement('template');
            tpl.innerHTML = window.guideHomeMarkup;
            return Array.from(tpl.content.querySelectorAll('.cards a.card')).filter(card => {
                const id = card.getAttribute('href').split('/').pop();
                const src = card.querySelector('img')?.getAttribute('src');
                return src !== representativePhoto(findItem(id))?.src;
            }).map(card=>card.getAttribute('href'));
        }""")
        assert not home_mismatches, home_mismatches
        failed = set()
        urls = sorted({r[s] for r in rows for s in ("pic", "hero") if r[s]})
        if decode:
            def failures(batch):
                return page.evaluate("""async urls=>(await Promise.all(urls.map(async src=>{
                  const im=new Image();im.src=src;let timer;
                  try{return await Promise.race([im.decode().then(()=>im.naturalWidth?null:src),
                    new Promise(r=>timer=setTimeout(()=>r(src),25000))]);}catch{return src}finally{clearTimeout(timer)}
                }))).filter(Boolean)""", batch)
            for i in range(0,len(urls),24):
                failed.update(failures(urls[i:i+24]))
            if failed:
                retry = sorted(failed)
                failed.clear()
                for i in range(0,len(retry),8):
                    failed.update(failures(retry[i:i+8]))
        browser.close()
    baseline=json.loads((ROOT/"audit/thumbnail-baseline.json").read_text())
    previous={redirects.get(k,k) for k in baseline["cardIds"]}
    def stats(group):
        return {"entries":len(group),"before":sum(r["id"] in previous for r in group),
                "card":sum(bool(r["pic"]) for r in group),"hero":sum(bool(r["hero"]) for r in group),
                "mapEntries":sum(r["map"] is not None for r in group),"mapImages":sum(bool(r["map"]) for r in group)}
    current={r["id"] for r in rows if r["pic"]}
    previous_patch=previous | {redirects.get(k,k) for k in baseline["v102AddedCardIds"]}
    gained=current-previous
    mission_groups={r["readerGroup"] for r in rows if r["readerGroup"]}
    historical={k:redirects.get(k,k) for k in baseline["historicalAssignments"]}
    return {"baseline":baseline["commit"],"overall":stats(rows),
            "byCategory":{c:stats([r for r in rows if r["category"]==c]) for c in sorted({r["category"] for r in rows})},
            "campaign":stats([r for r in rows if r["story"]]),"fieldExploration":stats([r for r in rows if r["major"] and r["category"]=='P05']),
            "eventsByType":{g:stats([r for r in rows if r["readerGroup"]==g]) for g in sorted(mission_groups)},
            "newlyVisible":sorted(gained),"lostSinceBaseline":sorted(previous-current),
            "lostSinceV102":sorted(previous_patch-current),"newSinceV102":sorted(current-previous_patch),
            "restoredFromHistory":sorted(gained.intersection(historical.values())),"firstVisibleInAudit":sorted(gained-set(historical.values())),
            "olderAssignmentsWithoutCard":{k:v for k,v in sorted(historical.items()) if v not in current},
            "missingCard":[r["id"] for r in rows if not r["pic"]],"missingHero":[r["id"] for r in rows if not r["hero"]],
            "missingMapImage":[r["id"] for r in rows if r["map"]==""],"distinctURLs":len(urls),
            "decodeChecked":decode,"decodeFailures":sorted(failed),
            "failedEntryIds":[r["id"] for r in rows if r["pic"] in failed or r["hero"] in failed]}


if __name__=="__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url")
    parser.add_argument("--decode",action="store_true")
    parser.add_argument("--output",type=Path)
    args=parser.parse_args()
    with (nullcontext(args.url) if args.url else serve(ROOT/"dist")) as base:
        report=check(base,args.decode)
    if args.output:
        args.output.write_text(json.dumps(report,ensure_ascii=False,indent=1)+"\n",encoding="utf-8")
    print({k:report[k] for k in ("overall","campaign","fieldExploration","distinctURLs","decodeFailures")})
    assert not report["lostSinceBaseline"] and not report["lostSinceV102"] and not report["decodeFailures"]
    assert report["campaign"]["entries"]==report["campaign"]["card"]
    assert "p09-re-041" not in report["missingCard"]
