"""Classify the missing cards from a fresh tests/thumbnails.py coverage report.

Run build.py and tests/thumbnails.py --output /tmp/coverage.json first.
Reasons describe the checked material. No repository metadata proves an internet
search failed, and a PDF page association does not identify any particular photo.
"""
import argparse
from collections import Counter, defaultdict
import json
from pathlib import Path
import re
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
IMAGE_FILE = re.compile(r"\.(?:avif|jpe?g|png|webp)(?:[?#]|$)", re.I)
REASONS = {
    "candidate": "기존 원본은 있으나 썸네일 연결 누락",
    "failed": "이미지 서버 접근 실패",
    "rights": "이용 조건 또는 저작권 확인 불가",
    "mismatch": "기존 이미지가 다른 콘텐츠와 불일치",
    "spoiler": "스포일러가 포함된 사진만 존재",
    "map": "해당 장소의 지도만 존재",
    "notFound": "실제 사진을 검색했으나 찾지 못함",
    "pending": "아직 이미지 조사 미실시",
    "overview": "대표 이미지가 불필요한 종합 안내",
    "unconfirmed": "미확인 제보 또는 실제 콘텐츠 확인 불가",
}
POTENTIAL = {
    "candidate": "기존 후보 우선 확인", "failed": "다른 제공처 또는 접근 가능한 원본 필요",
    "rights": "허가 또는 다른 제공처 필요", "mismatch": "다른 장면 필요",
    "spoiler": "발견 전이나 입구를 보여주는 다른 장면 필요",
    "map": "지도 외의 사진 조사 필요", "notFound": "조사한 범위에서는 추가 확보 어려움",
    "pending": "추가 확보 가능성 미평가", "overview": "개별 대상 사진 확보에서 제외",
    "unconfirmed": "콘텐츠 실재와 장소 확인 선행",
}


def read(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def read_build():
    prefix = "window.FIELD_GUIDE="
    text = (ROOT / "dist/guide-data.js").read_text(encoding="utf-8")
    if not text.startswith(prefix):
        raise ValueError("Run build.py first")
    return json.loads(text[len(prefix):].strip().removesuffix(";"))


def source_index():
    index = {}
    for path in sorted((ROOT / "data").glob("*.jsonl")):
        for line, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            if raw.strip():
                index[json.loads(raw)["id"].lower()] = f"data/{path.name}#L{line}"
    return index


def map_image(label, url):
    # An image within a map site's submission gallery can be an actual screenshot.
    # Use explicit figure metadata, not the server name or presence of 'loc='.
    return "지도" in label or "/img/s/" in url and urlsplit(url).hostname == "gta6map.city"


def collect_media(item, primary):
    photos, maps, protected, videos = set(), set(), set(), set()
    refs = item.get("sources", [])
    for source in refs:
        url = source.get("url", "")
        if not url:
            continue
        if IMAGE_FILE.search(url):
            target = maps if map_image(source.get("label", ""), url) else photos
            target.add(url)
        if urlsplit(url).hostname in {"youtu.be", "www.youtube.com", "youtube.com"}:
            videos.add(url)
    for info in [item.get("fieldReferences", {}), *item.get("otherFieldReferences", [])]:
        for key in ("map", "areaMap"):
            if (url := info.get(key)) and IMAGE_FILE.search(url):
                maps.add(url)
                photos.discard(url)
        if url := info.get("photo"):
            if map_image(info.get("caption", ""), url):
                maps.add(url)
            else:
                photos.add(url)
    for media in [primary, *item.get("gallery", [])]:
        for key, flag in (("src", "reveal"), ("originalPhoto", "originalReveal")):
            if not (url := media.get(key)):
                continue
            if media.get(flag) or media.get("reveal"):
                protected.add(url)
            elif map_image(media.get("originalCaption" if key == "originalPhoto" else "caption", ""), url):
                maps.add(url)
            else:
                photos.add(url)
    return sorted(photos - maps - protected), sorted(maps), sorted(protected), sorted(videos)


def automatic_reason(item, overview, photos, maps, protected, checks):
    if item["id"] in overview:
        return "overview", "여러 대상의 비교·진행 기준·색인을 안내하는 페이지로, 한 장면이 내용을 대표하기 어렵다."
    if item.get("evidenceGroup") == "미확인 미스터리":
        return "unconfirmed", "탐험 대장에서 실재 또는 발생 조건이 미확인인 제보다. 장소·사건을 식별해 줄 현장 증거 대조가 필요하다."
    if photos:
        if all(urlsplit(url).hostname in {"powerpyx.com", "www.powerpyx.com"} for url in photos):
            return "rights", "확인한 후보는 PowerPyx 자료다. 이용 약관 제5조가 요구하는 공개 재게시 허가를 프로젝트에서 확인하지 못했다."
        if all(url in checks and len(checks[url]) >= 2 and all(a.get("error") for a in checks[url]) for url in photos):
            return "failed", "기존 사진 URL을 배포 사이트와 같은 출처의 브라우저에서 두 차례 시험했지만 이미지가 열리지 않았다. URL별 응답과 실패 유형은 검사 기록에 있다."
        return "candidate", "원본 사진 후보 URL은 있으나 대표 사진에 연결되지 않았다. URL 등록만으로 대상 일치·스포일러·표시 권한의 확인을 뜻하지 않는다."
    if protected:
        return "spoiler", "기존 사진 기록은 보호 대상으로 지정돼 있다. 기본 카드에 쓸 다른 식별 사진을 확인하지 못했다."
    if maps:
        return "map", "확인한 기존 이미지 링크는 위치를 나타내는 지도다. 이 목록에서 개별 대상의 현장 사진은 확인되지 않았다."
    return "pending", "공개 자료 목록과 기존 배정 기록을 대조했으나 항목 전용 사진 후보가 없다. 개별 외부 사진 검색은 확인되지 않았다."


def resolved_history(data, history, missing, items):
    result = []
    for old_id, entry in sorted(history.items()):
        canonical = data["redirects"].get(old_id, data["redirects"].get(entry["id"], entry["id"]))
        if canonical not in items:
            raise ValueError(f"Lost historical ID {old_id}")
        result.append({
            **entry, "oldId": old_id, "id": canonical, "title": items[canonical]["title"],
            "result": "대표 이미지 표시" if canonical not in missing else "대표 이미지 미확보",
        })
    return result


def generate(coverage, evidence):
    data = read_build()
    items = {v["id"]: v for v in data["items"] if not (v.get("status") == "reference" and v.get("summary") == "–")}
    missing = set(coverage["missingCard"])
    if len(items) != coverage["overall"]["entries"] or not missing.issubset(items):
        raise ValueError("Coverage and built public entries disagree")
    sources = source_index()
    pdf_sources = read(ROOT / "audit/visual-review.json")["originals"]
    pdf_by_item = defaultdict(lambda: defaultdict(set))
    for row in read(ROOT / "audit/page-routes.json")["pages"]:
        for ids in row.get("routes", {}).values():
            for old in ids:
                canonical = data["redirects"].get(old, old)
                pdf_by_item[canonical][row["book"]].add(row["page"])
    history = resolved_history(data, evidence["historical"], missing, items)
    previous = {row["id"]: row for row in history}
    overview = set(evidence["overviewIDs"])
    inspections = defaultdict(list)
    for old, note in evidence.get("byId", {}).items():
        inspections[data["redirects"].get(old, old)].append(note)
    output = []
    for key in sorted(missing):
        item = items[key]
        primary = data["media"].get(key, {})
        photos, maps, protected, videos = collect_media(item, primary)
        code, detail = automatic_reason(item, overview, photos, maps, protected, evidence["urlChecks"])
        scope = ["기존 자산·항목 출처 대조"]
        searched = False
        old = previous.get(key)
        extra_sources = []
        if old and key not in overview and old["disposition"] != "ready":
            code = old["disposition"]
            detail = old["visualFinding"]
            scope.append("구판 ZIP의 해당 이미지 개봉·시각 대조")
        pdf_notes = [note for note in evidence.get("pdfVisualChecks", []) if key in note["ids"]]
        for note in pdf_notes:
            if override := note.get("reasonCode"):
                code, detail = override, note["finding"]
            scope.append("원본 PDF 지면 시각 대조")
        observations = inspections.get(key, [])
        for note in observations:
            searched |= bool(note.get("searchedWeb"))
            extra_sources.extend(note.get("sources", []))
            value = note.get("reason")
            reviewed_code = value if value in REASONS else next((k for k, label in REASONS.items() if label == value), None)
            if reviewed_code and (note.get("detail") or note.get("finding")):
                code, detail = reviewed_code, note.get("detail") or note["finding"]
            if note.get("status"):
                scope.append(note["status"])
        if code == "notFound" and not searched:
            raise ValueError(f"{key}: cannot call a search unsuccessful without a recorded search")
        source_urls = list(dict.fromkeys([*extra_sources, *[s["url"] for s in item.get("sources", []) if s.get("url")]]))
        checked = [u for u in photos + maps + protected if u in evidence["urlChecks"]]
        if checked:
            scope.append("기존 URL 브라우저 표시 검사")
        if code == "pending":
            if videos:
                detail = "기존 영상 링크를 확인했다. 정확히 이 대상을 보여 주는 대표 프레임 검수와 별도 사진 검색을 완료한 기록이 없다."
            elif any("지도" in s.get("label", "") or "위치 핀" in s.get("label", "") for s in item.get("sources", [])):
                detail = "해당 항목의 위치 출처는 있으나 대표 이미지 등록 또는 직접 사진 후보가 없다. 지도 페이지 안의 사진과 추가 외부 제공처는 미조사다."
            elif item.get("sources"):
                detail = "연결된 설명 자료에서 이 항목에 배정된 직접 이미지 경로는 확인되지 않았다. 자료 안의 도판과 별도 외부 사진은 추가 검토 대상이다."
            else:
                detail = "항목에 직접 사진 또는 외부 출처가 등록되지 않았다. 원본 DB 행 외에 장면을 찾는 개별 검색은 미실시다."
        books = pdf_by_item.get(key, {})
        row = {
            "id": key, "title": item["title"], "category": item["category"],
            "reason": REASONS[code], "detail": detail, "scope": list(dict.fromkeys(scope)),
            "webSearched": searched, "recoveryPotential": POTENTIAL[code],
            "sources": source_urls, "repositorySource": sources.get(key),
        }
        if observations:
            row["investigations"] = observations
        if pdf_notes:
            row["pdfVisualChecks"] = [f'{n["book"]} {n["page"]}쪽 · {n["finding"]}' for n in pdf_notes]
        if books:
            row["pdfPages"] = {book: sorted(pages) for book, pages in books.items()}
        if photos or maps or protected or videos:
            row["existingCandidates"] = {k: v for k, v in (("photos", photos), ("mapImages", maps),
                ("protected", protected), ("videos", videos)) if v}
        if checked:
            row["checkedURLs"] = checked
        if code == "rights":
            if any(urlsplit(u).hostname in {"www.powerpyx.com", "powerpyx.com"} for u in photos):
                row["termsSource"] = evidence["powerPyxTerms"]["url"]
        if not (row["repositorySource"] or row["sources"] or books):
            raise ValueError(f"No provenance for {key}")
        output.append(row)
    reason_counts = Counter(row["reason"] for row in output)
    candidate_groups = Counter(row["recoveryPotential"] for row in output)
    return {
        "methods": [
            "최종 빌드에서 실제 카드 이미지를 만들지 않은 공개 대표 ID만 포함했다. 표시 여부는 tests/thumbnails.py의 브라우저 결과다.",
            "조사 여부의 webSearched는 해당 항목에 외부 후보 탐색이 실제로 기록된 경우에만 참이다. 기존 URL·PDF·사진과 원본 등록 이력 대조는 별도로 표시한다.",
            "지도 이미지만 남았다는 판정은 대조한 범위에 한정한다. 좌표·지도 페이지 링크만으로 지도 이미지나 실제 사진을 확보했다고 간주하지 않는다.",
            "같은 이미지에 실패 원인이 여럿이면 대표 사유를 한 번만 집계한다. PDF 쪽수는 원본 대조 경로이며 사진 사용 허가나 개별 대상을 보증하지 않는다.",
        ],
        "beforeRegistration": evidence["baselineMissingRegistration"],
        "reasonCounts": {label: reason_counts[label] for label in REASONS.values()},
        "recoveryPotential": dict(candidate_groups), "historicalReview": history,
        "pdfSourceURLs": {k: v["url"] for k, v in pdf_sources.items()},
        "sourceURLCheckMethod": evidence["probeMethod"],
        "sourceURLChecks": evidence["urlChecks"],
        "missingItems": output,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--coverage", type=Path, required=True, help="Output of tests/thumbnails.py on the same dist")
    parser.add_argument("--evidence", type=Path, default=ROOT / "audit/image-source-evidence.json")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    report = generate(read(args.coverage), read(args.evidence))
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f'{len(report["missingItems"])} missing canonical entries; {len(report["historicalReview"])} historical IDs')
