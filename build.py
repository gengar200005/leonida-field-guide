"""Build the static guide. Requires only the Python standard library."""
import hashlib
import json
import re
import shutil
import zipfile
from pathlib import Path

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


def build():
    SITE.mkdir(exist_ok=True)
    data = {
        "items": [json.loads(line) for file in sorted((ROOT / "data").glob("*.jsonl")) for line in file.read_text(encoding="utf-8").splitlines() if line],
        "media": read("photos.json"),
        "pins": read("atlas.json"),
        "mapRegions": read("map-regions.json"),
        "mapReferenceNames": read("map-reference-names.json"),
        "redirects": read("redirects.json")
    }
    localize(data, read("official-names.json"))
    prepare_map_titles(data)
    ids = {row["id"].lower() for row in data["items"]}
    assert len(ids) == len(data["items"])
    assert all(pin["item"].lower() in ids for pin in data["pins"])
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
    for filename in ("index.html","style.css","guide.js"):
        shutil.copyfile(ROOT / filename, SITE / filename)
    index = SITE / "index.html"
    html = index.read_text(encoding="utf-8")
    for filename in ("style.css", "guide-data.js", "guide.js"):
        digest = hashlib.sha256((SITE / filename).read_bytes()).hexdigest()[:12]
        html = html.replace(f'"{filename}"', f'"{filename}?v={digest}"')
    index.write_text(html, encoding="utf-8")
    print(f"{len(ids)} guides, {len(data['pins'])} positions, {len(data['media'])} photo assignments")

if __name__ == "__main__":
    build()
