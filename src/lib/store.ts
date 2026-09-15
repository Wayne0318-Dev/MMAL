import { promises as fs } from "fs";
import path from "path";
import { buildDataset, emptyDataset } from "@/lib/build-dataset";
import { parseWorkbookBuffer } from "@/lib/parse-workbook";
import type { Dataset } from "@/lib/types";

export function dataDir() {
  return path.join(process.cwd(), "data");
}

export function datasetPath() {
  return path.join(process.cwd(), "src/data/dataset.json");
}

function safeXlsxName(filename: string) {
  const base = path.basename(filename).replace(/[/\\]/g, "");
  if (!base.toLowerCase().endsWith(".xlsx")) {
    throw new Error("只接受 .xlsx 文件（与现用转模记录同一格式）。");
  }
  if (base.startsWith("~$") || base.startsWith(".")) {
    throw new Error("不能导入临时文件。");
  }
  return base;
}

export async function listXlsxFiles() {
  try {
    const names = await fs.readdir(dataDir());
    return names
      .filter((n) => n.toLowerCase().endsWith(".xlsx") && !n.startsWith("~$"))
      .sort();
  } catch {
    return [];
  }
}

export async function rebuildFromDataDir(): Promise<{
  dataset: Dataset;
  warnings: string[];
}> {
  const files = await listXlsxFiles();
  const warnings: string[] = [];
  const records = [];
  const sources = [];

  for (const filename of files) {
    const buf = await fs.readFile(path.join(dataDir(), filename));
    const parsed = await parseWorkbookBuffer(buf, filename);
    warnings.push(...parsed.warnings);
    records.push(...parsed.records);
    sources.push({
      filename,
      recordCount: parsed.records.length,
      dateMin: parsed.dateMin,
      dateMax: parsed.dateMax,
      sheets: parsed.sheets,
    });
  }

  const dataset = files.length ? buildDataset(records, sources) : emptyDataset();
  await fs.mkdir(path.dirname(datasetPath()), { recursive: true });
  await fs.writeFile(datasetPath(), JSON.stringify(dataset, null, 2), "utf8");
  return { dataset, warnings };
}

export async function saveUpload(filename: string, buffer: Buffer) {
  const safe = safeXlsxName(filename);
  await fs.mkdir(dataDir(), { recursive: true });
  await fs.writeFile(path.join(dataDir(), safe), buffer);
  return rebuildFromDataDir();
}

export async function removeSource(filename: string) {
  const safe = safeXlsxName(filename);
  await fs.unlink(path.join(dataDir(), safe));
  return rebuildFromDataDir();
}

export async function readDataset(): Promise<Dataset> {
  try {
    const text = await fs.readFile(datasetPath(), "utf8");
    return JSON.parse(text) as Dataset;
  } catch {
    return emptyDataset();
  }
}
