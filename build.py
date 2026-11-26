"""Build the static guide. Requires only the Python standard library."""
import hashlib
from html import escape
import json
import re
import shutil
import zipfile
from pathlib import Path

from reader_names import prepare_reader_names

ROOT = Path(__file__).resolve().parent
SITE = ROOT / "dist"

def read(name):
    return json.loads((ROOT / name).read_text(encoding="utf-8"))


def localize(data, sources):
    names = {key.casefold(): name for source in sources for key, name in source["terms"].items()}
    alternatives = "|".join(re.escape(term) for term in sorted(names, key=len, reverse=True))
    pattern = re.compile(r"(?<![A-Za-z0-9])(?:" + alternatives + r")(?![A-Za-z0-9])", re.IGNORECASE)
    korean_text = re.compile(r"[가-힣]")
    separator = re.compile(r"( [·–—-] )")
    regions = {}

    def translate(value, matched=None, *, proper_name=False):
        if proper_name and " / " in value and korean_text.search(value):
            return " / ".join(translate(part, matched, proper_name=True) for part in value.split(" / "))
        if proper_name and not korean_text.search(value) and value.casefold() not in names:
            parts = separator.split(value)
            return "".join(translate(part, matched) if part.casefold() in names else part for part in parts)

        def replace(match):
            english = match[0]
            korean = names[english.casefold()]
            preceding = value[:match.start()]
            if preceding.endswith("(") and preceding[:-1].rstrip().endswith(korean):
                return english
            following = value[match.end():]
            if (english.casefold() == "leonida" and re.match(r" Man\b", following)
                or english.casefold() == "vice city" and re.match(r" FM\b", following)):
                return english
            if matched is not None:
                matched.add(english)
            return korean

        return pattern.sub(replace, value)

    def region(record):
        original = record.get("region")
        if original:
            korean = translate(original)
            if original != korean:
                regions[original] = korean
                record["region"] = korean

    for item in data["items"]:
        original_title = item["title"]
        item["title"] = translate(original_title, proper_name=True)
        if item["title"] != original_title:
            item["aliases"] = list(dict.fromkeys([*item.get("aliases", []), original_title]))
        original_region = item.get("region")
        region(item)
        matched = set()
        if original_region and item["region"] != original_region:
            matched.add(original_region)
        if item.get("summary"):
            item["summary"] = translate(item["summary"], matched, proper_name=True)
        for section in item["sections"]:
            search_terms = None if section.get("reveal") else matched
            section["title"] = translate(section["title"], search_terms, proper_name=True)
            for field in ("steps", "paragraphs"):
                if field in section:
                    section[field] = [translate(line, search_terms, proper_name=True) for line in section[field]]
            for row in section.get("table", {}).get("rows", []):
                if row[0].startswith("영문") or row[0] == "스타일":
                    continue
                row[:] = [translate(cell, search_terms) if isinstance(cell, str) else cell for cell in row]
        for field in ("caption", "note"):
            references = item.get("fieldReferences", {})
            if references.get(field):
                references[field] = translate(references[field], matched)
        if matched:
            item["originalTerms"] = sorted(matched)

    for pin in data["pins"]:
        original_region = pin.get("region")
        region(pin)
        if pin.get("region") != original_region:
            pin["originalRegion"] = original_region
        name = translate(pin["name"], proper_name=True)
        if name != pin["name"]:
            pin["originalName"] = pin["name"]
            pin["name"] = name
    for photo in data["media"].values():
        for field in ("caption", "originalCaption"):
            if photo.get(field):
                photo[field] = translate(photo[field])
    data["regionAliases"] = regions
    data["nameSources"] = [{"label": s["label"], "url": s["source"]} for s in sources]


def prepare_map_titles(data):
    # These map-specific editorial readings can differ from an official Korean name.
    labels = {}
    for path in sorted(ROOT.glob("map-names-*.json")):
        batch = read(path.name)
        if labels.keys() & batch.keys():
            raise ValueError(f"Duplicate map title in {path.name}")
        labels.update(batch)
    item_titles = {item["id"].lower(): item["title"] for item in data["items"]}
    pin_ids = {pin["id"] for pin in data["pins"]}
    if labels.keys() - pin_ids:
        raise ValueError("Map title has no matching pin")
    for pin in data["pins"]:
        # Each P04/P07/P09 pin describes the same place or event as its guide.
        fallback = item_titles[pin["item"].lower()] if pin["category"] in {"P04", "P07", "P09"} else pin["name"]
        pin["mapTitle"] = labels.get(pin["id"], fallback)


def home_markup(data):
    categories = data["categories"]

    def category_link(key, description=False):
        name, code, detail = categories[key]
        extra = f"<small>{escape(detail)}</small>" if description else ""
        return (f'<a href="#/guide/{key.lower()}"><span class="glyph" aria-hidden="true">{code}</span>'
                f'<span>{escape(name)}{extra}</span></a>')

    primary = "".join(category_link(k) for k in ("V", "P02", "P05", "P06"))
    all_categories = "".join(category_link(k, True) for k in categories)
    indexed = {item["id"].lower(): item for item in data["items"]}
    cards = []
    for key in ("v-04", "p02-w-001", "l03"):
        item = indexed[key]
        photo = data["media"].get(key, {})
        if item["category"] in {"V", "P02"}:
            src = photo.get("src") if photo.get("kind") == "appearance" else None
            if not src:
                src = next((ref["url"] for ref in item.get("sources", [])
                            if ref["label"] in {"차량 외형 원본", "무기 외형 원본"} and ref["url"].startswith("https://")), None)
            alt = item["title"] + " 외형"
        else:
            src, alt = photo.get("src"), photo.get("caption", "")
        image = (f'<img class="art home-art" loading="lazy" decoding="async" src="{escape(src)}" alt="{escape(alt)}">'
                 if src and not photo.get("reveal") else "")
        cards.append(f'<a class="card" href="#/entry/{key}">{image}<div class="cardbody">'
                     f'<span class="kicker">{escape(categories[item["category"]][0])}</span>'
                     f'<h3>{escape(item["title"])}</h3><p>{escape(item["summary"])}</p></div></a>')
    return ('<section class="hero"><div class="scene" style="background-image:url(media/landmark-l36.webp)"></div>'
            '<div class="herotext"><h1>리오나이다 필드 가이드</h1><p>챕터별 진행, 차량과 장비, 비밀 장소와 수집품을 찾아보세요.</p>'
            '<a class="btn primary" href="#/guide/p01">챕터별 공략 보기 →</a></div>'
            '<a class="photocredit" href="#/credits">오션 뷰 호텔 · GTADB</a></section>'
            f'<div class="quick">{primary}</div><section class="section"><div class="heading"><h2>탐험 수첩</h2>'
            f'<a href="#/map">지도에서 찾기 ↗</a></div><div class="cards">{"".join(cards)}</div></section>'
            f'<section class="section"><h2>공략 전체 보기</h2><div class="catgrid">{all_categories}</div></section>')


def build():
    SITE.mkdir(exist_ok=True)
    data = {
        "categories": read("categories.json"),
        "items": [json.loads(line) for file in sorted((ROOT / "data").glob("*.jsonl")) for line in file.read_text(encoding="utf-8").splitlines() if line],
        "media": read("photos.json"),
        "pins": read("atlas.json"),
        "mapRegions": read("map-regions.json"),
        "mapReferenceNames": read("map-reference-names.json"),
        "redirects": read("redirects.json")
    }
    localize(data, read("official-names.json"))
    prepare_map_titles(data)
    prepare_reader_names(data, read("reader-names.json"))
    ids = {row["id"].lower() for row in data["items"]}
    assert len(ids) == len(data["items"])
    pin_ids = {pin["id"]: pin["item"].lower() for pin in data["pins"]}
    assert len(pin_ids) == len(data["pins"])
    assert all(item in ids for item in pin_ids.values())
    for item in data["items"]:
        for section in item["sections"]:
            pin = section.get("locationPin")
            if pin and pin_ids.get(pin) != item["id"].lower():
                raise ValueError(f"Location pin does not belong to guide {item['id']}: {pin}")
    assert all(record["title"] and isinstance(record["sections"], list) for record in data["items"])
    media_dir = SITE / "media"
    media_dir.mkdir(exist_ok=True)
    for package in sorted((ROOT / "media").glob("*.zip")):
        with zipfile.ZipFile(package) as archive:
            for record in archive.infolist():
                name = record.filename
                if name != Path(name).name or not name.endswith(".webp"):
                    raise ValueError(f"Invalid media member: {name}")
                (media_dir / name).write_bytes(archive.read(record))
    for photo in data["media"].values():
        if photo.get("src") and not (SITE / photo["src"]).is_file():
            raise ValueError(f"Missing media: {photo['src']}")
    (SITE / "guide-data.js").write_text("window.FIELD_GUIDE=" + json.dumps(data,ensure_ascii=False,separators=(",",":")) + ";\n", encoding="utf-8")
    bundles = {"style.css": ["style.css", "catalog.css", "map-ui.css"], "guide.js": ["catalog.js", "guide.js"]}
    for output, components in bundles.items():
        (SITE / output).write_text("\n".join((ROOT / file).read_text(encoding="utf-8") for file in components), encoding="utf-8")
    shutil.copyfile(ROOT / "start.js", SITE / "start.js")
    index = SITE / "index.html"
    html = (ROOT / "index.html").read_text(encoding="utf-8").replace("<!-- guide-home -->", home_markup(data))
    for filename in ("style.css", "guide-data.js", "guide.js", "start.js"):
        digest = hashlib.sha256((SITE / filename).read_bytes()).hexdigest()[:12]
        html = html.replace(f'"{filename}"', f'"{filename}?v={digest}"')
    index.write_text(html, encoding="utf-8")
    print(f"{len(ids)} guides, {len(data['pins'])} positions, {len(data['media'])} photo assignments")

if __name__ == "__main__":
    build()
