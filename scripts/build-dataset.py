#!/usr/bin/env python3
"""Parse 转模记录9月份.xlsx into a queryable mold-machine dataset.

Identity rules are conservative: suspected typos are flagged, never silently merged.
"""

from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from datetime import datetime, time
from pathlib import Path

import openpyxl

SRC = Path(__file__).resolve().parents[1] / "data" / "转模记录9月份.xlsx"
OUT = Path(__file__).resolve().parents[1] / "src" / "data" / "dataset.json"

SUSPECTED_TYPOS = {
    "S25004": {
        "guess": "S250004",
        "reason": "9.4 C09 上模品名为 L09导光柱，同模具在其他天均写作 S250004 / 后模S250004。",
    },
    "S26008": {
        "guess": None,
        "reason": "位数少一位。品名是 Remo触屏支架，但 Remo触屏支架在 C12 上是 S250137；S260080 在 C20 上是试模/T68前壳组件。无法判断应归哪一个。",
    },
    "S2600091": {
        "guess": "S260091",
        "reason": "试模编号多写一个 0。S260091 多次作为试模出现在 C03/C04。",
    },
    "SS230295": {
        "guess": "S230295",
        "reason": "多写一个 S。品名同为 EMMA 高音后罩-EM24。",
    },
    "250187": {
        "guess": "S250187",
        "reason": "缺 S 前缀。品名 LOG Lanky Diffuser。",
    },
    "240110": {
        "guess": "S240110",
        "reason": "Excel 把模具号存成数字，缺 S 前缀。品名 AY7盆架组。",
    },
    "250185B": {
        "guess": "S250185",
        "reason": "缺 S 前缀，末尾带 B。同机台 C03 次日有 S250185 试模。B 可能是后模/版本，也可能是笔误。",
    },
    "s240130": {
        "guess": "S240130",
        "reason": "S 写成小写。",
    },
    "C151-152": {
        "guess": "C0151-152",
        "reason": "与 C0151-153、C0151-149 同属 C0151 系列，但位数和末段不同。品名是 MOJO装饰圈，而 C0151-153 是 MOJO 按键，不一定是同一套模。",
    },
}


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


def parse_mold(raw: str | None) -> dict:
    if not raw:
        return {
            "raw": None,
            "canonical": None,
            "variant": None,
            "extraIds": [],
            "flags": ["missing_mold_number"],
        }

    flags: list[str] = []
    parts = [p.strip() for p in re.split(r"[/／]", raw) if p.strip()]
    primary = parts[0]
    extra_ids = parts[1:]
    if extra_ids:
        flags.append("multiple_ids_in_one_cell")
        # "M2" after C0151-149M1 is likely C0151-149M2
        if extra_ids == ["C0151-149M1", "M2"] or extra_ids[-1] == "M2":
            flags.append("m2_may_mean_c0151_149m2")

    variant = None
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
    elif re.search(r"后模$", primary):
        variant = "后模"
        primary = re.sub(r"后模$", "", primary)
    elif re.search(r"前模$", primary):
        variant = "前模"
        primary = re.sub(r"前模$", "", primary)
    elif re.search(r"[A-Za-z0-9]后$", primary):
        variant = "后模"
        primary = re.sub(r"后$", "", primary)
    elif re.search(r"[A-Za-z0-9]前$", primary):
        variant = "前模"
        primary = re.sub(r"前$", "", primary)

    primary = primary.strip()
    ab = None
    m_ab = re.match(r"^([A-Za-z]+\d+)(AB)$", primary, re.I)
    if m_ab:
        ab = "AB"
        primary = m_ab.group(1)
        flags.append("ab_suffix")

    if re.match(r"^\d", primary):
        flags.append("missing_S_prefix")
    if re.match(r"^SS\d", primary, re.I):
        flags.append("double_S_prefix")
    if primary[:1] == "s":
        flags.append("lowercase_s")
    if variant:
        flags.append("has_front_or_rear_set")

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
            flags.append("trailing_letter:" + m_num.group(2).upper())
            canonical = canonical + m_num.group(2).upper()
    else:
        canonical = primary.upper().replace(" ", "")

    suspected = SUSPECTED_TYPOS.get(raw) or SUSPECTED_TYPOS.get(canonical)
    if suspected:
        flags.append("suspected_typo")

    display = canonical
    if variant:
        display += f"-{variant}"
    if ab:
        display += f"-{ab}"

    return {
        "raw": raw,
        "canonical": canonical,
        "variant": variant,
        "ab": ab,
        "extraIds": extra_ids,
        "flags": flags,
        "display": display,
        "suspectedTypo": suspected,
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

            mold = parse_mold(c)
            issues = list(mold["flags"])
            if inherited:
                issues.append("machine_inherited_from_previous_row")
            if not action:
                issues.append("missing_up_or_down")
            if not b:
                issues.append("missing_product")

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
                    "mold": {k: v for k, v in mold.items() if k != "flags"},
                    "action": action,
                    "orderTime": None if f in (None, "/") else f,
                    "materialTime": None if g in (None, "/") else g,
                    "changeTime": h,
                    "signTime": i,
                    "note": j,
                    "issues": issues,
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
                "id": f"job-{len(jobs)+1:03d}",
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

    for job in jobs:
        steps = [r for r in records if r["jobId"] == job["id"]]
        sequence = []
        for s in steps:
            sequence.append(
                {
                    "action": s["action"] or "未标注",
                    "mold": (s["mold"]["display"] if s["mold"]["canonical"] else "缺号"),
                    "product": s["product"],
                }
            )
        job["sequence"] = sequence
        job["kind"] = classify_job(sequence)
    return jobs


def classify_job(sequence):
    actions = [s["action"] for s in sequence]
    if actions == ["下", "上"]:
        return "标准转模：下旧模 → 上新模"
    if actions == ["上"]:
        return "仅上模（未记录下模，或机台原本空置）"
    if actions == ["下"]:
        return "仅下模（未记录上模）"
    if len(sequence) == 2 and sequence[0]["mold"] == sequence[1]["mold"]:
        return "同一模具下了又上（常见于修模/重装）"
    if len(sequence) >= 3:
        return "同机台连续多次上下模"
    if "未标注" in actions:
        return "类别缺失，按机台归属保留"
    return "其他"


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
                "issues": [],
                "suspectedTypo": None,
                "extraIdsSeen": [],
            }
        return molds[canonical]

    for rec in records:
        m = rec["mold"]
        canonical = m["canonical"] or "MISSING"
        bucket = mold_bucket(canonical)
        bucket["recordIds"].append(rec["id"])
        if m["raw"] and m["raw"] not in bucket["rawForms"]:
            bucket["rawForms"].append(m["raw"])
        if m["variant"] and m["variant"] not in bucket["variants"]:
            bucket["variants"].append(m["variant"])
        if rec["product"] and rec["product"] not in bucket["products"]:
            bucket["products"].append(rec["product"])
        for extra in m.get("extraIds") or []:
            if extra not in bucket["extraIdsSeen"]:
                bucket["extraIdsSeen"].append(extra)
        for issue in rec["issues"]:
            if issue not in bucket["issues"]:
                bucket["issues"].append(issue)
        if m.get("suspectedTypo"):
            bucket["suspectedTypo"] = m["suspectedTypo"]

        mach = rec["machine"]
        existing = next((x for x in bucket["machines"] if x["machine"] == mach), None)
        edge_issues = [
            i
            for i in rec["issues"]
            if i
            not in (
                "has_front_or_rear_set",
                "machine_inherited_from_previous_row",
            )
        ]
        confidence = "high"
        if rec["inheritedMachine"]:
            confidence = "inherited"
        if not rec["action"]:
            confidence = "action_missing"
        if "missing_mold_number" in rec["issues"]:
            confidence = "mold_missing"
        if existing is None:
            bucket["machines"].append(
                {
                    "machine": mach,
                    "upCount": 1 if rec["action"] == "上" else 0,
                    "downCount": 1 if rec["action"] == "下" else 0,
                    "unknownCount": 1 if rec["action"] not in ("上", "下") else 0,
                    "variants": [m["variant"] or "未标注"],
                    "products": [rec["product"]] if rec["product"] else [],
                    "dates": [rec["date"]],
                    "confidence": confidence,
                    "issues": list(edge_issues),
                }
            )
        else:
            if rec["action"] == "上":
                existing["upCount"] += 1
            elif rec["action"] == "下":
                existing["downCount"] += 1
            else:
                existing["unknownCount"] += 1
            v = m["variant"] or "未标注"
            if v not in existing["variants"]:
                existing["variants"].append(v)
            if rec["product"] and rec["product"] not in existing["products"]:
                existing["products"].append(rec["product"])
            if rec["date"] not in existing["dates"]:
                existing["dates"].append(rec["date"])
            rank = {"high": 3, "inherited": 2, "action_missing": 1, "mold_missing": 0}
            if rank[confidence] > rank[existing["confidence"]]:
                existing["confidence"] = confidence
            for issue in edge_issues:
                if issue not in existing["issues"]:
                    existing["issues"].append(issue)

        if mach not in machines:
            machines[mach] = {
                "id": mach,
                "series": mach[:1],
                "molds": [],
                "recordIds": [],
                "products": [],
            }
        machines[mach]["recordIds"].append(rec["id"])
        if canonical != "MISSING" and canonical not in machines[mach]["molds"]:
            machines[mach]["molds"].append(canonical)
        if rec["product"] and rec["product"] not in machines[mach]["products"]:
            machines[mach]["products"].append(rec["product"])

    # Explicit conflict: S250188 cannot be two products on two machines the same night.
    if "S250188" in molds:
        for edge in molds["S250188"]["machines"]:
            if edge["machine"] == "B09":
                edge["confidence"] = "conflict"
                if "same_night_different_product" not in edge["issues"]:
                    edge["issues"].append("same_night_different_product")

    for bucket in molds.values():
        bucket["searchText"] = " ".join(
            [
                bucket["canonical"],
                *bucket["rawForms"],
                *bucket["products"],
                *bucket["variants"],
                *bucket["extraIdsSeen"],
                *[m["machine"] for m in bucket["machines"]],
            ]
        ).upper()
        named = [p for p in bucket["products"] if p not in ("试模", "试产")]
        trial = [p for p in bucket["products"] if p in ("试模", "试产")]
        bucket["isTrialOnly"] = bool(trial) and not named
        bucket["hasTrialAndNamed"] = bool(trial) and bool(named)
        distinct_named = set(named)
        # collapse trivial whitespace/punctuation differences later in UI; here keep raw
        bucket["conflictingProducts"] = len(distinct_named) > 1

    return (
        [molds[k] for k in sorted(molds.keys())],
        [machines[k] for k in sorted(machines.keys(), key=lambda x: (x[0], int(x[1:] or 0) if x[1:].isdigit() else x))],
        jobs,
    )


QUESTIONS = [
    {
        "id": "Q1",
        "severity": "rule",
        "title": "「上 / 下」是否就是上机 / 下机？",
        "assumption": "D 列勾选 = 上模（把模具装到机台上），E 列勾选 = 下模（把模具从机台拆下来）。证据：绝大多数成对记录是「下旧模 → 上新模」，时间段首尾相接，例如 C20 14:01-14:17 下 S240131，14:17-14:35 上 S260080。",
        "need": "请确认这个理解是否 100% 正确。如果「上/下」其实是前模/后模（定模/动模）而不是装卸动作，后面整套关系都要重做。",
    },
    {
        "id": "Q2",
        "severity": "rule",
        "title": "机台单元格空白，是否一律继承上一行机台？",
        "assumption": "同一班次内，机台列空白的行属于上一行已填写的机台。14 天里 140/350 行是这样写的，且时间连续。",
        "need": "请确认。有一处特别容易理解偏差：9月12日 B班，A09 下 S250165（0:30-0:43），下一行 A10 下 C0151-153（0:50-1:01），再下一行空白机台、上 S250165（1:01-1:16）。按「继承上一行」规则，S250165 是从 A09 拆下后装到 A10。如果空白行其实应跟品名相同的 A09，关系就反了。",
    },
    {
        "id": "Q3",
        "severity": "rule",
        "title": "编号里的「前模 / 后模」是什么意思？",
        "assumption": "同一模具编号的前模、后模是同一产品的两套（或两副）模具，不是一副模的定模/动模两半。证据：Charge6箱体 的 S240122 前/后 都在 D19 上，S240261 前/后 都在 D22 上；品名相同，只是前/后标注不同。",
        "need": "请确认。查询时我目前把 S240122、S240122后、前模S240122 归到同一个编号 S240122，同时保留「前模/后模」标签。如果前模和后模必须当成两套完全独立的模具，我改成分开索引。",
    },
    {
        "id": "Q4",
        "severity": "scope",
        "title": "这份表只能证明「曾经装过」，不能证明「只能装这些机台」。",
        "assumption": "9月1–14日转模记录 = 历史装机事实。模具没出现在某台机器上，不代表不能装。",
        "need": "后续「用模具找适配机台」如果要做成生产排程依据，还需要锁模力/模具尺寸/牙板规格。请确认目前是否先用历史装机作为适配清单，还是必须等规格表。",
    },
    {
        "id": "Q5",
        "severity": "scope",
        "title": "机台字母 A/B/C/D/E 是否代表不同吨位或车间？",
        "assumption": "编号形态是字母+两位数字，共 62 台：A10 台、B8 台、C26 台、D16 台、E4 台。同一模具多数只在同一字母段出现，例如 Charge6箱体 S240122 只在 D19，S240261 只在 D22。",
        "need": "如果 C 组是同一吨位，历史只上过 C04 的模具，是否也应提示「C 组其他机台可能也可装」？还是必须严格按出现过的机台号？",
    },
    {
        "id": "Q6",
        "severity": "data",
        "title": "S250188 同一晚写了两个完全不同的产品。",
        "assumption": "9月10日 B班：B09 上 S250188「PB120转接板防火罩」（0:55-1:16）；同时 D03 上 S250188「LOG Lanky左右上盖」（1:30-2:10）。次日 D03 继续按 LOG Lanky 装卸 S250188。",
        "need": "请确认哪一条写错了。B09 那条很像把模具号抄成了 S250188（同晚 D03 的模号）。在纠正前，我不会把 B09 当成 S250188 的可靠适配机台。",
    },
    {
        "id": "Q7",
        "severity": "data",
        "title": "9月13日 C05 上「Meridian支架」没有模具编号。",
        "assumption": "次日 9月14日 C05 下模 ZDX3464，品名仍是 Meridian支架。推断 9月13日缺号的那一刀就是 ZDX3464。",
        "need": "请确认是否可以这样补号。未确认前这条记录不会并进 ZDX3464 的适配清单。",
    },
    {
        "id": "Q8",
        "severity": "data",
        "title": "疑似写错的模具编号（未自动合并）。",
        "assumption": "S25004≈S250004；S2600091≈S260091；SS230295≈S230295；250187≈S250187；240110≈S240110；s240130≈S240130。S26008 和 250185B 无法单靠上下文钉死。",
        "need": "请逐条确认。特别是 S26008（C09 / Remo触屏支架）不要和 S260080、S250137 混在一起。",
    },
    {
        "id": "Q9",
        "severity": "data",
        "title": "一个单元格里写了两个模具号。",
        "assumption": "9月11日 D17 上模写 S240037/S240151；C27 上模写 ZDX3308/C0151-149M1/M2。可能是两套模一起上，也可能是一个模有厂内号和外协号。",
        "need": "请说明应把它当成 1 套模还是 2 套模。M2 是否就是 C0151-149M2？",
    },
    {
        "id": "Q10",
        "severity": "data",
        "title": "ZDX3312 在同一机台 C25 上写过两个品名。",
        "assumption": "9月2日 C25 下 ZDX3312「MOJO后壳」；9月14日 C25 上 ZDX3312「Optical左右后壳」。可能是同一副模做不同项目，也可能是品名写错。",
        "need": "请确认是不是同一副模。",
    },
    {
        "id": "Q11",
        "severity": "data",
        "title": "S240217 的品名从 EX1H 变成了 T68。",
        "assumption": "D17 上 S240217 前三天都叫「EX1H后门低音-盆架组」，9月11日 B班下这副模时写成了「T68 盆架组」，随后上 S240037/S240151。更像是当班把下模品名跟着新模写成了 T68。",
        "need": "请确认 S240217 是否始终是 EX1H，而不是 T68。",
    },
    {
        "id": "Q12",
        "severity": "data",
        "title": "两行没有勾选「上」或「下」。",
        "assumption": "9月2日 A09 WY01按键 S260024（16:31-16:51）无勾选；9月10日 B02 在下了 S250144 右箱后，下一行 S250143 左箱无勾选，时间 18:55-19:30，很像是上模漏勾。",
        "need": "请补类别。未补之前这两条仍挂在对应机台上，但标记为类别缺失。",
    },
    {
        "id": "Q13",
        "severity": "data",
        "title": "「试模」是状态，不是品名。",
        "assumption": "试模行仍有真实模具编号。例如 S260080 白天在 C20 写作试模，夜班同一机台下模时写成 T68前壳组件。S260063、S260024、S260074、S250189 也是先试模后出现正式品名。",
        "need": "查询时我按模具编号归并，品名里同时保留「试模」和后来的正式名。这样可以吗？",
    },
    {
        "id": "Q14",
        "severity": "data",
        "title": "S240127AB 的 AB 是什么？",
        "assumption": "只出现一次：9月12日 C28 上 Charge6导光件。可能是 A+B 穴、AB 件，或前模+后模一起写。",
        "need": "请说明 AB 是否要拆成两套编号。",
    },
]


def main():
    records = parse_workbook()
    jobs = attach_jobs(records)
    molds, machines, jobs = build_indexes(records, jobs)

    flagged_records = [r["id"] for r in records if any(
        i not in ("has_front_or_rear_set", "machine_inherited_from_previous_row")
        for i in r["issues"]
    )]

    dataset = {
        "meta": {
            "sourceFile": "转模记录9月份.xlsx",
            "period": "2026-09-01 ~ 2026-09-14",
            "sheets": [f"9.{i}" for i in range(1, 15)],
            "recordCount": len(records),
            "jobCount": len(jobs),
            "moldCount": len([m for m in molds if m["canonical"] != "MISSING"]),
            "machineCount": len(machines),
            "generatedNote": "关系来自转模历史，不是模具规格书。编号疑点未自动合并。",
        },
        "parsingRules": [
            "每个工作表是一天，表内分 A班 / B班两段。",
            "列：机台、机种品名、模具编号、类别上/下、开单时间、转料时间、转模完成时间、签板时间、备注。",
            "机台列有值：开始一台新的转模作业。",
            "机台列空白：继承本班次上一行机台（待 Q2 确认）。",
            "类别「上」= 上机，「下」= 下机（待 Q1 确认）。",
            "模具号去掉「前模/后模/前/后」前缀后缀后得到主编号，前/后作为套别标签保留（待 Q3 确认）。",
            "疑似笔误只打标，不改号。",
        ],
        "questions": QUESTIONS,
        "stats": {
            "upCount": sum(1 for r in records if r["action"] == "上"),
            "downCount": sum(1 for r in records if r["action"] == "下"),
            "missingAction": sum(1 for r in records if not r["action"]),
            "inheritedMachineRows": sum(1 for r in records if r["inheritedMachine"]),
            "moldsOnMultipleMachines": sum(1 for m in molds if len(m["machines"]) > 1),
            "flaggedRecordCount": len(flagged_records),
        },
        "records": records,
        "jobs": jobs,
        "molds": molds,
        "machines": machines,
        "flaggedRecordIds": flagged_records,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(dataset, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {OUT} records={len(records)} molds={len(molds)} machines={len(machines)} jobs={len(jobs)}")


if __name__ == "__main__":
    main()
