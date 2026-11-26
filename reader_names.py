"""Apply the guide's editorial Korean names while preserving source-language searches."""
from collections import defaultdict
import re


# The map supplies the editorial spellings for these two location variants.
def consistent_places(text):
    return text.replace("스탈릿 모텔", "스타렛 모텔").replace("라 페를", "라 펄")


def prepare_reader_names(data, names):
    by_item = defaultdict(list)
    for pin in data["pins"]:
        pin["mapTitle"] = consistent_places(pin["mapTitle"])
        by_item[pin["item"].lower()].append(pin)
    regions = {
        **data["mapRegions"]["names"], "Starlet Motel": "스타렛 모텔",
        "Gellhorn": "겔혼", "Grayson": "그레이슨", "West Kalaga": "칼라가 서부",
        "North Mariana County": "마리아나 카운티 북부", "West Vice-Dale County": "바이스데일 카운티 서부",
        "East Lummox County": "럼목스 카운티 동부", "South Kelly County": "켈리 카운티 남부",
    }
    tables_with_regions = {"권역", "지역", "현장 위치", "지도 지명", "우선 권역", "보조 권역"}

    def translate_labels(value):
        if value in regions:
            return regions[value]
        # In a location string, each delimited segment is a complete place label.
        return consistent_places("".join(regions.get(part, part) for part in re.split(r"(\s*[·/,]\s*)", value)))

    for item in data["items"]:
        key = item["id"].lower()
        title = item["title"]
        aliases = list(item.get("aliases", []))
        region = item.get("region")
        if region and translate_labels(region) != region:
            aliases.append(region)
            data["regionAliases"][region] = translate_labels(region)
            item["region"] = translate_labels(region)
        if not re.search("[가-힣]", title):
            pins = by_item[key]
            translation = names.get(key) or data["mapReferenceNames"].get(key)
            if not translation and key.startswith("p06-c-"):
                # A common card can occur at both a fixed site and a variable box.
                # Prefer the name matching the guide's variant, without the box label.
                options = [p["mapTitle"].removeprefix("가변 상자 · ") for p in pins]
                translation = next((t for t in options if ("(" in t) == ("(" in title)), None)
            if not translation and pins:
                translation = pins[0]["mapTitle"].removeprefix("가변 상자 · ")
            if translation and translation != title:
                item["title"] = translation
                aliases.append(title)
                item["sourceTitleIndex"] = list(dict.fromkeys(aliases)).index(title)
        if key.startswith("p06-fl-") and len(by_item[key]) == 1:
            # The collectible number distinguishes similar field descriptions and
            # keeps the card, search result and exact map pin under one name.
            pin = by_item[key][0]
            name = pin["mapTitle"]
            if re.fullmatch(r"플라밍고 [0-9]+번", name):
                place = next((row[1] for section in item["sections"]
                              for row in section.get("table", {}).get("rows", [])
                              if len(row) == 2 and row[0] == "지도 지명" and row[1]), "")
                if place:
                    name += " · " + translate_labels(place)
                    pin["mapTitle"] = name
            if item["title"] != name:
                aliases.append(item["title"])
                item["title"] = name
        canonical = consistent_places(item["title"])
        if canonical != item["title"]:
            aliases.append(item["title"])
            item["title"] = canonical
        summary = item.get("summary", "")
        if summary:
            item["summary"] = translate_labels(summary)
        for section in item.get("sections", []):
            section["title"] = consistent_places(section["title"])
            for field in ("paragraphs", "steps"):
                if field in section:
                    section[field] = [consistent_places(line) for line in section[field]]
            for row in section.get("table", {}).get("rows", []):
                row[:] = [consistent_places(cell) if isinstance(cell, str) else cell for cell in row]
                if len(row) == 2 and row[0] in tables_with_regions and isinstance(row[1], str):
                    row[1] = translate_labels(row[1])
        if aliases:
            item["aliases"] = list(dict.fromkeys(aliases))
