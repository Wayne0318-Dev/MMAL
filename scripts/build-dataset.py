#!/usr/bin/env python3
"""Parse 转模记录9月份.xlsx into mold ↔ machine associations.

Rules confirmed by the user (2026-09-15):
- 上/下 = mount / unmount. Checkmarks are optional.
- Blank 机台 inherits the previous machine in the same shift.
- 前模/后模 are two halves of one mold; lookup is by main number.
- Only record machines that actually appeared. Do not infer same-letter machines.
- Product names are annotations, not identity.
- Different mold numbers in one cell are different molds, all linked to that machine.
- M2 after C0151-149M1 means C0151-149M2.
"""

from __future__ import annotations

import json
import re
from datetime import datetime, time
from pathlib import Path

import openpyxl

SRC = Path(__file__).resolve().parents[1] / "data" / "转模记录9月份.xlsx"
OUT = Path(__file__).resolve().parents[1] / "src" / "data" / "dataset.json"

# Confirmed identity fixes (not guesses).
MOLD_ID_ALIASES = {
    "S26008": "S250137",  # Q8 Remo触屏支架
    "SS230295": "S230295",  # extra S prefix, same digits
}

# Mechanical writing-format only: add missing S, uppercase.
# Digit-count changes (S25004, S2600091) are NOT applied.


def cell_str(v):
    if v is None:
        return None
    if isinstance(v, time):
        return v.strftime("%H:%M")
    if isinstance(v, datetime):
        return v.strftime("%H:%M")
    if isinstance(v, bool):
        return str(v)
    if isinstance(v, (int, float)):
        if float(v).is_integer():
            return str(int(v))
        return str(v)
    s = str(v).replace("\xa0", " ").replace("　", " ").strip()
    s = re.sub(r"\s+", " ", s)
    return s if s else None


def strip_half_marker(token: str) -> tuple[str, str | None]:
    variant = None
    primary = token.strip()
    if re.search(r"前模", primary):
        variant = "前模"
        primary = re.sub(r"前模\s*", "", primary)
    elif re.search(r"后模", primary):
        variant = "后模"
        primary = re.sub(r"后模\s*", "", primary)
    elif re.match(r"^前", primary):
        variant = "前模"
        primary = re.sub(r"^前", "", primary)
    elif re.match(r"^后", primary):
        variant = "后模"
        primary = re.sub(r"^后", "", primary)
    elif re.search(r"[A-Za-z0-9]后$", primary):
        variant = "后模"
        primary = re.sub(r"后$", "", primary)
    elif re.search(r"[A-Za-z0-9]前$", primary):
        variant = "前模"
        primary = re.sub(r"前$", "", primary)
    return primary.strip(), variant


def canonicalize_token(token: str) -> tuple[str, str | None, str | None]:
    """Return (canonical, half_variant, corrected_from_or_none)."""
    raw_token = token.strip()
    primary, variant = strip_half_marker(raw_token)

    # Q14: AB stays on the same main number.
    m_ab = re.match(r"^([A-Za-z]+\d+)(AB)$", primary, re.I)
    if m_ab:
        primary = m_ab.group(1)

    m_s = re.match(r"^[sS](\d+)$", primary)
    m_ss = re.match(r"^SS(\d+)$", primary, re.I)
    m_num = re.match(r"^(\d+)([A-Za-z])?$", primary)
    if m_s:
        canonical = "S" + m_s.group(1)
    elif m_ss:
        canonical = "S" + m_ss.group(1)
    elif m_num:
        canonical = "S" + m_num.group(1)
        if m_num.group(2):
            canonical += m_num.group(2).upper()
    else:
        canonical = primary.upper().replace(" ", "")

    corrected_from = None
    if canonical in MOLD_ID_ALIASES:
        corrected_from = canonical
        canonical = MOLD_ID_ALIASES[canonical]
    return canonical, variant, corrected_from


def expand_cell_tokens(raw: str) -> list[str]:
    parts = [p.strip() for p in re.split(r"[/／]", raw) if p.strip()]
    expanded = []
    prev = None
    for part in parts:
        if part.upper() == "M2" and prev and re.search(r"M1$", prev, re.I):
            expanded.append(re.sub(r"M1$", "M2", prev, flags=re.I))
        else:
            expanded.append(part)
        prev = expanded[-1]
    return expanded


def parse_mold_cell(raw: str | None, product: str | None) -> dict:
    notes = []
    if not raw:
        if product and "Meridian" in product:
            # Q7
            return {
                "raw": None,
                "canonical": "ZDX3464",
                "variant": None,
                "ids": ["ZDX3464"],
                "display": "ZDX3464",
                "correctedFrom": "(空)",
                "correction": "Q7：Meridian支架补号 ZDX3464",
            }
        return {
            "raw": None,
            "canonical": None,
            "variant": None,
            "ids": [],
            "display": "缺号",
            "correctedFrom": None,
            "correction": None,
        }

    tokens = expand_cell_tokens(raw)
    ids = []
    variants = []
    corrections = []
    for token in tokens:
        canonical, variant, corrected_from = canonicalize_token(token)
        if canonical not in ids:
            ids.append(canonical)
        if variant and variant not in variants:
            variants.append(variant)
        if corrected_from:
            corrections.append(f"{corrected_from}→{canonical}")

    primary = ids[0] if ids else None
    variant = variants[0] if len(variants) == 1 else None
    display = " / ".join(ids)
    if variant:
        display = f"{primary}-{variant}" if len(ids) == 1 else display

    correction = None
    if corrections:
        correction = "；".join(corrections)
        notes.append(correction)

    return {
        "raw": raw,
        "canonical": primary,
        "variant": variant,
        "ids": ids,
        "display": display,
        "correctedFrom": corrections[0].split("→")[0] if corrections else None,
        "correction": correction,
    }


def parse_workbook():
    wb = openpyxl.load_workbook(SRC, data_only=True)
    records = []
    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        m = re.match(r"9\.(\d+)", sheet_name)
        day = int(m.group(1)) if m else None
        date = f"2026-09-{day:02d}" if day else None
        current_shift = None
        current_machine = None
        in_data = False

        for r in range(1, ws.max_row + 1):
            a = cell_str(ws.cell(r, 1).value)
            b = cell_str(ws.cell(r, 2).value)
            c = cell_str(ws.cell(r, 3).value)
            d = cell_str(ws.cell(r, 4).value)
            e = cell_str(ws.cell(r, 5).value)
            f = cell_str(ws.cell(r, 6).value)
            g = cell_str(ws.cell(r, 7).value)
            h = cell_str(ws.cell(r, 8).value)
            i = cell_str(ws.cell(r, 9).value)
            j = cell_str(ws.cell(r, 10).value)

            shift_src = a or b or ""
            if "班别" in shift_src:
                if "A班" in shift_src:
                    current_shift = "A班"
                elif "B班" in shift_src:
                    current_shift = "B班"
                current_machine = None
                in_data = False
                continue
            if a == "机台" or (b == "机种品名" and c == "模具编号"):
                in_data = True
                current_machine = None
                continue
            if d == "上" and e == "下" and not a and not b and not c:
                continue
            if not in_data or not any([a, b, c, d, e, f, g, h, i, j]):
                continue

            inherited = False
            if a:
                machine = a.replace(" ", "").upper()
                current_machine = machine
            else:
                machine = current_machine
                inherited = True

            action = None
            if d == "√":
                action = "上"
            if e == "√":
                action = "下" if action is None else "上+下"

            mold = parse_mold_cell(c, b)
            records.append(
                {
                    "id": f"{sheet_name}-R{r}",
                    "sheet": sheet_name,
                    "date": date,
                    "shift": current_shift,
                    "row": r,
                    "machine": machine,
                    "machineWritten": bool(a),
                    "inheritedMachine": inherited,
                    "product": b,
                    "mold": mold,
                    "action": action,
                    "orderTime": None if f in (None, "/") else f,
                    "materialTime": None if g in (None, "/") else g,
                    "changeTime": h,
                    "signTime": i,
                    "note": j,
                }
            )
    return records


def attach_jobs(records):
    jobs = []
    current = None
    for rec in records:
        start_new = (
            current is None
            or rec["machineWritten"]
            or rec["date"] != current["date"]
            or rec["shift"] != current["shift"]
            or rec["machine"] != current["machine"]
        )
        if start_new:
            if current:
                jobs.append(current)
            current = {
                "id": f"job-{len(jobs) + 1:03d}",
                "date": rec["date"],
                "shift": rec["shift"],
                "machine": rec["machine"],
                "recordIds": [rec["id"]],
            }
        else:
            current["recordIds"].append(rec["id"])
        rec["jobId"] = current["id"]
    if current:
        jobs.append(current)

    rec_by_id = {r["id"]: r for r in records}
    for job in jobs:
        steps = [rec_by_id[i] for i in job["recordIds"]]
        sequence = []
        for s in steps:
            sequence.append(
                {
                    "action": s["action"] or "未勾选",
                    "mold": s["mold"]["display"],
                    "product": s["product"],
                }
            )
        job["sequence"] = sequence
        job["kind"] = classify_job(sequence)
    return jobs


def classify_job(sequence):
    actions = [s["action"] for s in sequence]
    molds = [s["mold"] for s in sequence]
    if actions == ["下", "上"]:
        if molds[0] == molds[1]:
            return "同一副模下了再上（半边维修/保养后重装）"
        return "标准转模：下旧模 → 上新模"
    if len(sequence) == 1:
        return "单行记录（机台与模具仍关联）"
    if len(sequence) >= 3:
        return "同机台连续多次装卸"
    return "同机台多行记录"


def add_machine_edge(bucket, rec, mold_id, variant):
    mach = rec["machine"]
    existing = next((x for x in bucket["machines"] if x["machine"] == mach), None)
    source = "inherited" if rec["inheritedMachine"] else "written"
    if existing is None:
        bucket["machines"].append(
            {
                "machine": mach,
                "upCount": 1 if rec["action"] == "上" else 0,
                "downCount": 1 if rec["action"] == "下" else 0,
                "unknownCount": 1 if rec["action"] not in ("上", "下") else 0,
                "variants": [variant or "未标注"],
                "products": [rec["product"]] if rec["product"] else [],
                "dates": [rec["date"]],
                "source": source,
            }
        )
        return
    if rec["action"] == "上":
        existing["upCount"] += 1
    elif rec["action"] == "下":
        existing["downCount"] += 1
    else:
        existing["unknownCount"] += 1
    v = variant or "未标注"
    if v not in existing["variants"]:
        existing["variants"].append(v)
    if rec["product"] and rec["product"] not in existing["products"]:
        existing["products"].append(rec["product"])
    if rec["date"] not in existing["dates"]:
        existing["dates"].append(rec["date"])
    if source == "written":
        existing["source"] = "written"


def build_indexes(records, jobs):
    molds = {}
    machines = {}

    def mold_bucket(canonical):
        if canonical not in molds:
            molds[canonical] = {
                "id": canonical,
                "canonical": canonical,
                "rawForms": [],
                "variants": [],
                "products": [],
                "machines": [],
                "recordIds": [],
                "corrections": [],
            }
        return molds[canonical]

    for rec in records:
        m = rec["mold"]
        ids = m.get("ids") or ([m["canonical"]] if m.get("canonical") else [])
        if not ids:
            continue
        for mold_id in ids:
            bucket = mold_bucket(mold_id)
            if rec["id"] not in bucket["recordIds"]:
                bucket["recordIds"].append(rec["id"])
            if m["raw"] and m["raw"] not in bucket["rawForms"]:
                bucket["rawForms"].append(m["raw"])
            if m.get("variant") and m["variant"] not in bucket["variants"]:
                bucket["variants"].append(m["variant"])
            if rec["product"] and rec["product"] not in bucket["products"]:
                bucket["products"].append(rec["product"])
            if m.get("correction") and m["correction"] not in bucket["corrections"]:
                bucket["corrections"].append(m["correction"])
            add_machine_edge(bucket, rec, mold_id, m.get("variant"))

            mach = rec["machine"]
            if mach not in machines:
                machines[mach] = {
                    "id": mach,
                    "molds": [],
                    "recordIds": [],
                    "products": [],
                }
            if rec["id"] not in machines[mach]["recordIds"]:
                machines[mach]["recordIds"].append(rec["id"])
            if mold_id not in machines[mach]["molds"]:
                machines[mach]["molds"].append(mold_id)
            if rec["product"] and rec["product"] not in machines[mach]["products"]:
                machines[mach]["products"].append(rec["product"])

    for bucket in molds.values():
        bucket["searchText"] = " ".join(
            [
                bucket["canonical"],
                *bucket["rawForms"],
                *bucket["products"],
                *bucket["variants"],
                *[m["machine"] for m in bucket["machines"]],
            ]
        ).upper()
        bucket["machines"].sort(key=lambda x: x["machine"])

    mold_list = [molds[k] for k in sorted(molds.keys())]
    machine_list = [
        machines[k]
        for k in sorted(
            machines.keys(),
            key=lambda x: (x[0], int(x[1:]) if x[1:].isdigit() else x),
        )
    ]
    return mold_list, machine_list, jobs


QUESTIONS = [
    {
        "id": "Q1",
        "status": "confirmed",
        "title": "上 / 下 的含义",
        "answer": "对。上 = 上机，下 = 下机。",
    },
    {
        "id": "Q2",
        "status": "confirmed",
        "title": "空白机台是否继承上一行",
        "answer": "对。同一班次内，机台格空白的行属于上一行机台。",
    },
    {
        "id": "Q3",
        "status": "confirmed",
        "title": "前模 / 后模",
        "answer": "一套模分成前模、后模，合起来才是完整模具。上机后若后模异常，只下后模保养或维修，好了再上。查询按主编号，前/后只表示这次动的是哪一半。",
    },
    {
        "id": "Q4",
        "status": "confirmed",
        "title": "历史装机是否可查",
        "answer": "可以。目前用这 14 天实际出现过的机台作为查询结果。",
    },
    {
        "id": "Q5",
        "status": "confirmed",
        "title": "字母段是否要联想同组机台",
        "answer": "不是。A/B/C/D/E 只是机台编号分组。只给实际出现过的机台号，不做同组联想。",
    },
    {
        "id": "Q6",
        "status": "confirmed",
        "title": "S250188 出现在 B09 和 D03",
        "answer": "没有问题。9月10日 B09：下 S260009、上 S250188；D03：下 S250162、上 S250188。品名不同不影响。S250188 同时关联 B09 和 D03。",
    },
    {
        "id": "Q7",
        "status": "confirmed",
        "title": "Meridian支架缺号",
        "answer": "模具编号就是 ZDX3464，9月13日 C05 那条按同一副模补号。",
    },
    {
        "id": "Q8",
        "status": "confirmed",
        "title": "Remo触屏支架编号",
        "answer": "Remo触屏支架模具编号是 S250137。表里写成 S26008 的那条已改归 S250137。",
    },
    {
        "id": "Q9",
        "status": "confirmed",
        "title": "一格多个模号",
        "answer": "模号不同就是两套模，都关联到该机台。M2 即 C0151-149M2。",
    },
    {
        "id": "Q10",
        "status": "confirmed",
        "title": "ZDX3312 两个品名",
        "answer": "同模不同镶件，记录都是同一套模。",
    },
    {
        "id": "Q11",
        "status": "confirmed",
        "title": "S240217 的品名",
        "answer": "是 EX1H。品名只作备注，关联仍按模具号。",
    },
    {
        "id": "Q12",
        "status": "confirmed",
        "title": "未勾选上/下",
        "answer": "上下勾选非必要。必要的是机台编号和模具号是否关联。",
    },
    {
        "id": "Q13",
        "status": "confirmed",
        "title": "试模 / 机种名",
        "answer": "机种名非关键信息。只要机台编号和模具号关联即可。",
    },
    {
        "id": "Q14",
        "status": "confirmed",
        "title": "S240127AB",
        "answer": "不用拆。记同一主编号 S240127。",
    },
]


def main():
    records = parse_workbook()
    jobs = attach_jobs(records)
    molds, machines, jobs = build_indexes(records, jobs)

    dataset = {
        "meta": {
            "sourceFile": "转模记录9月份.xlsx",
            "period": "2026-09-01 ~ 2026-09-14",
            "sheets": [f"9.{i}" for i in range(1, 15)],
            "recordCount": len(records),
            "jobCount": len(jobs),
            "moldCount": len(molds),
            "machineCount": len(machines),
            "generatedNote": "只记录表里实际出现过的 模具号↔机台号。不做同组机台联想。",
        },
        "parsingRules": [
            "每个工作表是一天，表内分 A班 / B班。",
            "查询只认机台编号和模具编号的关联；机种品名只作备注。",
            "机台列有值：该行机台。机台列空白：继承本班次上一行机台。",
            "上 = 上机，下 = 下机。没有勾选也不影响关联。",
            "前模/后模是同一套模的两半。主编号相同即同一套模；下后模再上是半边维修。",
            "一格里多个不同模号 = 多套模，都关联到这一台。M2 展开为 C0151-149M2。",
            "S240127AB 记作 S240127。S26008 按确认改为 S250137。Meridian支架缺号补 ZDX3464。",
            "只列出实际出现过的机台，不按字母组联想其他机台。",
        ],
        "questions": QUESTIONS,
        "stats": {
            "upCount": sum(1 for r in records if r["action"] == "上"),
            "downCount": sum(1 for r in records if r["action"] == "下"),
            "missingAction": sum(1 for r in records if not r["action"]),
            "inheritedMachineRows": sum(1 for r in records if r["inheritedMachine"]),
            "moldsOnMultipleMachines": sum(1 for m in molds if len(m["machines"]) > 1),
            "correctedRows": sum(1 for r in records if r["mold"].get("correction")),
        },
        "records": records,
        "jobs": jobs,
        "molds": molds,
        "machines": machines,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(dataset, ensure_ascii=False, indent=2), encoding="utf-8")
    print(
        f"wrote {OUT} records={len(records)} molds={len(molds)} "
        f"machines={len(machines)} jobs={len(jobs)} "
        f"multi={dataset['stats']['moldsOnMultipleMachines']} "
        f"corrected={dataset['stats']['correctedRows']}"
    )


if __name__ == "__main__":
    main()
