import ExcelJS from "exceljs";
import { cellStr, parseDateLabel, parseSheetNameDate, yearFromIso } from "@/lib/cell-utils";
import { parseMoldCell } from "@/lib/parse-mold";
import type { RecordRow } from "@/lib/types";

export type ParsedWorkbook = {
  sourceFile: string;
  records: RecordRow[];
  sheets: string[];
  dateMin: string | null;
  dateMax: string | null;
  warnings: string[];
};

export async function parseWorkbookBuffer(
  buffer: Buffer,
  sourceFile: string
): Promise<ParsedWorkbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as never);
  const warnings: string[] = [];
  const records: RecordRow[] = [];
  const usedSheets: string[] = [];

  const yearHint = collectYearHint(wb);

  for (const ws of wb.worksheets) {
    if (ws.state === "hidden" || ws.state === "veryHidden") continue;
    const sheetRecords = parseSheet(ws, sourceFile, yearHint, warnings);
    if (sheetRecords.length) {
      usedSheets.push(ws.name);
      records.push(...sheetRecords);
    }
  }

  if (!records.length) {
    warnings.push(
      `${sourceFile} 没有读到转模行。表头需要有「机台」和「模具编号」，格式需与现用转模记录表一致。`
    );
  }

  const dates = records.map((r) => r.date).filter(Boolean).sort();
  return {
    sourceFile,
    records,
    sheets: usedSheets,
    dateMin: dates[0] ?? null,
    dateMax: dates[dates.length - 1] ?? null,
    warnings,
  };
}

function collectYearHint(wb: ExcelJS.Workbook): number | null {
  for (const ws of wb.worksheets) {
    const maxRow = Math.min(ws.actualRowCount || 8, 8);
    const maxCol = Math.min(ws.actualColumnCount || 12, 12);
    for (let r = 1; r <= maxRow; r++) {
      for (let c = 1; c <= maxCol; c++) {
        const iso = parseDateLabel(cellStr(ws.getCell(r, c).value));
        const y = yearFromIso(iso);
        if (y) return y;
      }
    }
  }
  return null;
}

function lastUsedRow(ws: ExcelJS.Worksheet) {
  let last = 0;
  ws.eachRow({ includeEmpty: false }, (_row, rowNumber) => {
    last = Math.max(last, rowNumber);
  });
  return last;
}

function parseSheet(
  ws: ExcelJS.Worksheet,
  sourceFile: string,
  yearHint: number | null,
  warnings: string[]
): RecordRow[] {
  const maxRow = lastUsedRow(ws);
  const maxCol = Math.max(ws.columnCount || 10, 10);
  let sheetDate: string | null = null;
  for (let r = 1; r <= Math.min(maxRow, 6); r++) {
    for (let c = 1; c <= Math.min(maxCol, 12); c++) {
      const iso = parseDateLabel(cellStr(ws.getCell(r, c).value));
      if (iso) {
        sheetDate = iso;
        break;
      }
    }
    if (sheetDate) break;
  }
  if (!sheetDate) {
    sheetDate = parseSheetNameDate(ws.name, yearHint);
  }
  if (!sheetDate) {
    warnings.push(`${sourceFile} 工作表「${ws.name}」找不到日期，已跳过。`);
    return [];
  }

  const records: RecordRow[] = [];
  let currentShift: string | null = null;
  let currentMachine: string | null = null;
  let inData = false;
  let sawHeader = false;

  for (let r = 1; r <= maxRow; r++) {
    const a = cellStr(ws.getCell(r, 1).value);
    const b = cellStr(ws.getCell(r, 2).value);
    const c = cellStr(ws.getCell(r, 3).value);
    const d = cellStr(ws.getCell(r, 4).value);
    const e = cellStr(ws.getCell(r, 5).value);
    const f = cellStr(ws.getCell(r, 6).value);
    const g = cellStr(ws.getCell(r, 7).value);
    const h = cellStr(ws.getCell(r, 8).value);
    const i = cellStr(ws.getCell(r, 9).value);
    const j = cellStr(ws.getCell(r, 10).value);

    const shiftSrc = a || b || "";
    if (shiftSrc.includes("班别")) {
      if (shiftSrc.includes("A班")) currentShift = "A班";
      else if (shiftSrc.includes("B班")) currentShift = "B班";
      currentMachine = null;
      inData = false;
      continue;
    }
    if (a === "机台" || (b === "机种品名" && c === "模具编号")) {
      inData = true;
      sawHeader = true;
      currentMachine = null;
      continue;
    }
    if (d === "上" && e === "下" && !a && !b && !c) continue;
    if (!inData || ![a, b, c, d, e, f, g, h, i, j].some(Boolean)) continue;

    let inherited = false;
    let machine: string | null;
    if (a) {
      machine = a.replace(/\s+/g, "").toUpperCase();
      currentMachine = machine;
    } else {
      machine = currentMachine;
      inherited = true;
    }
    if (!machine || !currentShift) continue;

    let action: RecordRow["action"] = null;
    if (d === "√") action = "上";
    if (e === "√") action = action ? "上+下" : "下";

    const mold = parseMoldCell(c, b);
    records.push({
      id: `${sourceFile}:${ws.name}-R${r}`,
      sourceFile,
      sheet: ws.name,
      date: sheetDate,
      shift: currentShift,
      row: r,
      machine,
      machineWritten: Boolean(a),
      inheritedMachine: inherited,
      product: b,
      mold,
      action,
      orderTime: f === "/" ? null : f,
      materialTime: g === "/" ? null : g,
      changeTime: h,
      signTime: i,
      note: j,
      jobId: "",
    });
  }

  if (!sawHeader && records.length === 0 && maxRow > 0) {
    warnings.push(
      `${sourceFile} 工作表「${ws.name}」没有「机台 / 模具编号」表头，已跳过。`
    );
  }
  return records;
}
