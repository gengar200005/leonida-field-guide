"""Build the static guide. Requires only the Python standard library."""
import hashlib
import json
import shutil
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SITE = ROOT / "dist"

def read(name):
    return json.loads((ROOT / name).read_text(encoding="utf-8"))

def build():
    SITE.mkdir(exist_ok=True)
    data = {
        "items": [json.loads(line) for file in sorted((ROOT / "data").glob("*.jsonl")) for line in file.read_text(encoding="utf-8").splitlines() if line],
        "media": read("photos.json"),
        "pins": read("atlas.json"),
        "redirects": read("redirects.json")
    }
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
