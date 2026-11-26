"""Final copy editing of reader-visible fields after source overlays and merges."""

REVISIONS = {
    "현장 스폰": "현장에서 발견",
    "C1+ / UI 확인": "챕터 1부터 · 이용 가능 여부는 게임 메뉴에서 확인하세요",
    "C3 제보·윈치": "챕터 3에 윈치로 견인했다는 제보가 있습니다",
    "판매 C3 / 수리·도색 각 UI": "차량 판매는 챕터 3부터, 수리와 도색은 각각 게임 메뉴에서 확인하세요",
    "추가 출처 후보": "추가 확인이 필요한 제보",
    "참조·소품": "배경 소품으로 알려진 대상",
    "지도에 표시된다.": "지도에서 확인할 수 있습니다.",
    "공개 지도에 표시된 지점이다.": "공개 지도에 표시된 위치입니다.",
    "GTA6Wiki는 99개를 싣고 있다.": "GTA6Wiki 지도에는 99곳이 표시되어 있습니다.",
    "미확인이다.": "아직 확인되지 않았습니다.",
    "장소 이름이 다른 기록과 겹칠 수 있다.": "다른 기록이 같은 장소를 가리킬 수 있습니다.",
    "랜드마크 또는 상호작용 후보로 알려져 있다.": "랜드마크이거나 상호작용할 수 있는 대상이라는 제보가 있습니다.",
    "이주 자금 $15,000와 남은 스토리 목표를 달성한 뒤": "이주 자금 $15,000를 마련하고 남은 스토리 목표를 마친 뒤",
    "지갑의 현금을 은행 잔액으로 옮기는": "가지고 있는 현금을 은행 계좌에 입금하는",
    "당좌에서 가족 저축으로 보내는 누적 금액이": "당좌 계좌에서 가족 저축 계좌로 보낸 총액이",
    "첫 $5,000 목표와 이후 등급별 기준을 확인하세요.": "먼저 $5,000를 모으세요. 그다음 등급별 목표액을 확인하세요.",
    "청구되는 비용과 다음 준비 절차": "내야 할 금액과 다음 미션 준비 과정",
    "이용 조건은 지점별로 미확인이다.": "지점별 이용 조건은 아직 확인되지 않았습니다.",
    "모세스": "모제스",
    "잔디의 시가": "맨디의 시가",
    "유형별 승계는 상충입니다.": "자금 종류별로 다음 챕터에 얼마나 남는지는 플레이 기록마다 다릅니다.",
    "집 수리는 초반에.": "집 수리는 초반에 마치세요.",
    "미확인입니다.": "아직 확인되지 않았습니다.",
    "해당 여부는 아직 확인되지 않았습니다.": "해당하는지는 아직 확인되지 않았습니다.",
    "현장 획득 후 유지와 재스폰은": "현장에서 얻은 뒤 계속 보관할 수 있는지, 같은 곳에 다시 나타나는지는",
    "개별 핀은": "정확한 지도 위치는",
    "보트를 늦추면": "보트의 속도를 줄이면",
    "아널드 의뢰": "아놀드 의뢰",
    "라울의 차량 인도 뒤": "라울에게 차를 가져다준 뒤",
    "숙박비 상담과 장보기를 끝내고": "관리인에게 숙박비를 문의하고 장을 본 뒤",
    "첫 보트 임무를 완료한 제이슨. 개인 차량 가나도가 필요합니다.": "첫 보트 임무를 마친 뒤 제이슨의 개인 차량인 가나도를 준비하세요.",
    "첫 보트 임무를 마치고 키 렌토에서 제이슨을 조작할 때.": "첫 보트 임무를 마친 뒤 키 렌토에서 제이슨으로 시작하세요.",
    "첫 보트 임무 뒤 브라이언의 기념품점 의뢰가 표시될 때.": "첫 보트 임무를 마치면 브라이언의 기념품점 의뢰가 표시됩니다.",
    "전화를 받고 제이슨으로 햄릿": "전화를 받으면 제이슨으로 햄릿",
    "비키의 외출 의뢰 후 루시아가 소유하고 싶은 차량을 타고": "비키의 외출 의뢰를 마치면 루시아로 등록할 차를 몰고",
    "메가문도 개장 행사 경호를 받으세요.": "메가문도 개장 행사 경호를 맡으세요.",
    "드레콴의 장소 문자가 오면": "드레콴이 문자로 약속 장소를 알려 주면",
    "표식이 잠긴 모양이어도": "표식에 자물쇠가 떠 있어도",
    "첫 송금 뒤 게임 안에서 며칠 지나": "첫 송금 후 게임 시간으로 며칠이 지나",
    "별도 슬롯을 남기면": "다른 슬롯에 저장하면",
    "스타렛 모텔 객실에서 두 사람이 가방을 엽니다.": "스타렛 모텔 객실에서 두 사람이 함께 가방을 엽니다.",
    "접수처 왼쪽 복도를 따라갑니다.": "접수처 왼쪽 복도로 가세요.",
    "임대료를 받으러": "월세를 받으러",
    "Pipework에서는": "맨디의 싱크대를 수리할 때는",
    "Feng Shui 뒤에는": "칼과 집을 꾸민 뒤에는",
    "Day Release에서는": "‘요트에서 보낸 하루’에서는",
    "Home Sweet Home에서는": "‘행복한 우리집’에서는",
    "Company Property를 마치고": "‘비행장의 화물 상자’를 마치고",
    "Party Hard를 마친 뒤": "‘메가문도 행사 경호’를 마친 뒤",
    "안경 관찰 표시": "안경으로 확인할 지점",
    "차가 멈춘 뒤에는 현장 물건을": "차가 멈추면 주변 물건을",
    "이후 이동 조작을 안내합니다.": "이후 어떻게 이동하는지 확인하세요.",
    "아널드를": "아놀드를",
}

def edit_value(value):
    if isinstance(value, list):
        return [edit_value(part) for part in value]
    if isinstance(value, str) and not value.startswith(("https://", "http://")):
        for old, new in REVISIONS.items():
            value = value.replace(old, new)
        return value
    return value


def edit_fields(record, fields):
    for field in fields:
        if field in record:
            record[field] = edit_value(record[field])


def apply_korean_copy(data, copy):
    for item in data["items"]:
        old = item["title"]
        title = copy["titles"].get(item["id"])
        if title and title[0] == old:
            item["title"] = title[1]
        edit_fields(item, ("title", "summary", "unlock", "region"))
        if item["category"] == "P03" and old.startswith("Towable ATM · 지도 "):
            item["title"] = old.replace("Towable ATM · 지도 ", "견인형 ATM · 지점 ", 1)
        if old != item["title"] and old not in item.setdefault("aliases", []):
            item["aliases"].append(old)
        flow = item.get("progression", {})
        if flow.get("mapAlias"):
            flow["mapGoalKo"] = copy["objectives"][flow["mapAlias"]]
            if flow["mapGoalKo"] not in item["aliases"]:
                item["aliases"].append(flow["mapGoalKo"])
        for section in item["sections"]:
            edit_fields(section, ("title", "steps", "paragraphs"))
            edit_fields(section.get("table", {}), ("headers", "rows"))
        for image in item.get("gallery", []):
            edit_fields(image, ("caption", "originalCaption"))
    for image in data["media"].values():
        edit_fields(image, ("caption", "originalCaption"))
    for pin in data["pins"]:
        edit_fields(pin, ("mapTitle",))
