"""Apply editorial identity decisions after names and source-specific map labels are loaded."""
from copy import deepcopy
from hashlib import sha256
import json


def unique(values):
    return list(dict.fromkeys(values))


def add_source(item, ref):
    refs = item.setdefault("sources", [])
    if ref.get("url") and not any(old["url"] == ref["url"] for old in refs):
        refs.append(ref)


def fingerprint(section):
    # Ignore only the exact index paragraphs already reconciled by the editor.
    # If an old source is enriched later, its new facts must survive the build.
    serialized = json.dumps(section, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return sha256(serialized.encode()).hexdigest()[:16]


def merge_media(data, target, old, protect):
    key = target["id"]
    photos = [data["media"].pop(old["id"], None), *old.get("gallery", [])]
    for photo in filter(None, photos):
        if protect and not photo.get("reveal"):
            photo = {**photo, "reveal": "발견과 보상", "originalReveal": True}
        if key not in data["media"]:
            data["media"][key] = photo
        elif photo != data["media"][key] and photo not in target.get("gallery", []):
            # The renderer displays a physical image once. Keep distinct originals,
            # source credit, license and disclosure on every record underneath it.
            target.setdefault("gallery", []).append(photo)


def merge_references(item, references):
    if not references:
        return
    current = item.setdefault("fieldReferences", {})
    labels = {"map": "현장 위치 지도", "photo": references.get("caption") or "현장 사진",
              "areaMap": "주변 지도", "printUrl": "공략집 원본", "candidate": "목격 지점"}
    changed = False
    for field, value in references.items():
        if field not in current:
            current[field] = value
        elif current[field] != value:
            changed = True
            if field in labels and isinstance(value, str) and value.startswith("https://"):
                add_source(item, {"label": labels[field], "url": value})
    if changed and references not in item.get("otherFieldReferences", []):
        item.setdefault("otherFieldReferences", []).append(references)
        if references.get("note"):
            include_section(item, {"title":"현장 자료를 볼 때", "paragraphs":[references["note"]], "reveal":"location"})


def include_section(target, incoming):
    # Keep disclosure levels, sequential instructions and location-specific actions intact.
    sections = target["sections"]
    if incoming in sections:
        return
    for prior in sections:
        if incoming["title"] != prior["title"] or incoming.get("reveal") != prior.get("reveal"):
            continue
        if set(incoming) <= {"title", "reveal", "paragraphs", "places"} and set(prior) <= {"title", "reveal", "paragraphs", "places"}:
            prior["paragraphs"] = unique([*prior.get("paragraphs", []), *incoming.get("paragraphs", [])])
            if incoming.get("places"):
                prior["places"] = unique([*prior.get("places", []), *incoming["places"]])
            return
        if set(incoming) - {"title", "reveal", "table", "places"} or set(prior) - {"title", "reveal", "table", "places"}:
            continue
        table = incoming.get("table")
        previous = prior.get("table")
        if table and previous and table["headers"] == previous["headers"]:
            for row in table["rows"]:
                if row not in previous["rows"]:
                    previous["rows"].append(row)
            if incoming.get("places"):
                prior["places"] = unique([*prior.get("places", []), *incoming["places"]])
            return
    sections.append(incoming)


def combine(target, old, group):
    old_id = old["id"]
    for name in ("aliases", "related", "originalTerms", "legacyIds"):
        values = old.get(name, [])
        if name == "aliases":
            values = [old["title"], *values]
        if values:
            target[name] = unique([*target.get(name, []), *values])
    old_category = old["category"]
    pages = old.get("sourcePages", [])
    if target["category"] != old_category:
        if pages:
            by_book = target.setdefault("alsoSourcePages", {})
            by_book[old_category] = sorted(set(by_book.get(old_category, [])) | set(pages))
    elif pages:
        target["sourcePages"] = sorted(set(target.get("sourcePages", [])) | set(pages))

    for book, source_pages in old.get("alsoSourcePages", {}).items():
        by_book = target.setdefault("alsoSourcePages", {})
        by_book[book] = sorted(set(by_book.get(book, [])) | set(source_pages))
    for ref in old.get("sources", []):
        add_source(target, ref)
    merge_references(target, old.get("fieldReferences"))
    for references in old.get("otherFieldReferences", []):
        merge_references(target, references)
    if old.get("unlock") and old["unlock"] != target.get("unlock"):
        if not target.get("unlock"):
            target["unlock"] = old["unlock"]
        else:
            include_section(target, {"title": "해금과 이용 시점", "paragraphs": [old["unlock"]]})
    summary = old.get("summary", "").strip()
    represented = group.get("representedSummaries", [])
    if summary and summary != target["summary"] and summary not in represented:
        existing_text = json.dumps(target["sections"] + old["sections"], ensure_ascii=False)
        if summary not in existing_text:
            note = {"title": "현장에서 알아볼 점", "paragraphs":[summary]}
            if group.get("protectAliasSections"):
                note["reveal"] = group["protectAliasSections"]
            elif target["category"] == "P05":
                note["reveal"] = "location"
            include_section(target, note)

    for source_section in old["sections"]:
        if fingerprint(source_section) in group.get("representedSections", []):
            if source_section.get("places"):
                target["related"] = unique([*target.get("related", []), *source_section["places"]])
            continue
        section = deepcopy(source_section)
        if level := group.get("protectAliasSections"):
            section.setdefault("reveal", "solution" if "보상" in section["title"] else level)
        if section.get("paragraphs") == ["장소 이름이 다른 기록과 겹칠 수 있다. 정확한 위치와 등장 조건은 미확인이다."]:
            continue
        if table := section.get("table"):
            table["rows"] = [row for row in table["rows"] if row[0] != "별칭 후보" and row not in (
                ["유형", "추가 출처 후보"], ["지역", "지점 핀 참조"])]
            if not table["rows"]:
                continue
        include_section(target, section)


def merge_pins(data, aliases, by_id):
    redirects = {}
    retained = []
    positions = {}
    # A canonical marker takes precedence when both rows used the exact same coordinates.
    # Identical coordinates for unrelated objects or multiple distinct stops stay separate.
    for pin in sorted(data["pins"], key=lambda pin: pin["item"].lower() in aliases):
        old = pin["item"].lower()
        key = aliases.get(old, old)
        if key not in by_id:
            raise ValueError(f"Map marker refers to missing guide: {key}")
        if key != old:
            pin["item"] = key
        marker_key = (key, pin["x"], pin["y"])
        if old in aliases and marker_key in positions:
            saved = positions[marker_key]
            redirects[pin["id"]] = saved["id"]
            if saved.get("url") != pin.get("url"):
                add_source(by_id[key], {"url":pin["url"], "label": pin.get("mapTitle") or "현장 위치 지도"})
            continue
        pin["category"] = by_id[key]["category"]
        retained.append(pin)
        positions.setdefault(marker_key, pin)
    data["pins"] = retained
    previous = data.get("pinRedirects", {})
    data["pinRedirects"] = {**{key: redirects.get(value, value) for key, value in previous.items()}, **redirects}


def rewire(items, redirects, pin_redirects):
    for item in items:
        key = item["id"]
        clean = lambda value: redirects.get(value.lower(), value.lower())
        if item.get("related"):
            item["related"] = unique(clean(x) for x in item["related"] if clean(x) != key)
        for section in item["sections"]:
            for field in ("places", "hints", "checklist"):
                if field in section:
                    section[field] = unique(clean(x) for x in section[field] if clean(x) != key)
            if section.get("checklistRisk"):
                section["checklistRisk"] = {clean(k):v for k,v in section["checklistRisk"].items()}
            if ref := section.get("relatedGuide"):
                section["relatedGuide"] = clean(ref)
                if section["relatedGuide"] == key:
                    del section["relatedGuide"]
            if marker := section.get("locationPin"):
                section["locationPin"] = pin_redirects.get(marker, marker)
            if section.get("mapPins"):
                section["mapPins"] = unique(pin_redirects.get(x, x) for x in section["mapPins"])


def apply_merges(data, groups):
    """Mutate the build output; raw records remain available for provenance and legacy links."""
    by_id = {r["id"].lower():r for r in data["items"]}
    aliases = {}
    for canonical, group in groups.items():
        if canonical not in by_id:
            raise ValueError(f"Missing representative: {canonical}")
        for old in group["aliases"]:
            if old not in by_id or old in aliases or old in groups:
                raise ValueError(f"Invalid or repeated merge: {old} → {canonical}")
            aliases[old] = canonical
    for key, group in groups.items():
        item = by_id[key]
        covered = group.get("representedSections", [])
        for section in item["sections"]:
            if fingerprint(section) in covered and section.get("places"):
                item["related"] = unique([*item.get("related", []), *section["places"]])
        item["sections"] = [s for s in item["sections"] if fingerprint(s) not in covered]
        data["pins"].extend(group.get("newPins", []))
        if group.get("summary"):
            item["summary"] = group["summary"]
        if group.get("region"):
            item["region"] = group["region"]
        if group.get("newSections"):
            item["sections"] = [*group["newSections"], *item["sections"]]
        for old in group["aliases"]:
            combine(item, by_id[old], group)
            merge_media(data, item, by_id[old], group.get("protectAliasMedia", False))
    data["items"] = [r for r in data["items"] if r["id"].lower() not in aliases]
    redirects = data.setdefault("redirects", {})
    for key, value in list(redirects.items()):
        redirects[key] = aliases.get(value.lower(), value.lower())
    redirects.update(aliases)
    merge_pins(data, aliases, by_id)
    for pin in data["pins"]:
        region = groups.get(pin["item"].lower(), {}).get("preferredPinRegion")
        if region:
            pin["region"] = region
    rewire(data["items"], redirects, data["pinRedirects"])
    return aliases

def classify_guides(data, decisions):
    """Publish one primary category and retain the actual source book for page citations."""
    by_id = {item["id"].lower(): item for item in data["items"]}
    categories = {}
    for category, keys in decisions["categories"].items():
        if category not in data["categories"] or set(keys) & categories.keys():
            raise ValueError(f"Unknown or conflicting primary category: {category}")
        categories.update(dict.fromkeys(keys, category))
    for item in by_id.values():
        if item.get("track") == "story":
            categories[item["id"].lower()] = "P01"
    for key, category in categories.items():
        item = by_id[key]
        previous = item["category"]
        if previous != category:
            pages = item.pop("sourcePages", [])
            books = item.setdefault("alsoSourcePages", {}) if pages or item.get("alsoSourcePages") else {}
            if pages:
                books[previous] = sorted(set(pages) | set(books.get(previous, [])))
            if category in books:
                item["sourcePages"] = books.pop(category)
            item["category"] = category
    for mission_type, keys in decisions["missionTypes"].items():
        for key in keys:
            item = by_id[key]
            if item["category"] != "P09":
                raise ValueError(f"Activity classification outside P09: {key}")
            item["missionType"] = mission_type
    for pin in data["pins"]:
        pin["category"] = by_id[pin["item"].lower()]["category"]
