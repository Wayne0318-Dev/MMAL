import { promises as fs } from "fs";
import path from "path";
import { buildDataset, emptyDataset } from "@/lib/build-dataset";
import { parseWorkbookBuffer } from "@/lib/parse-workbook";
import { isPersistentServer } from "@/lib/hosting";
import type { RebuildResult, WorkbookFile } from "@/lib/storage-types";
import { safeXlsxName } from "@/lib/storage-types";
import type { Dataset } from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), "data");
const LOCAL_SNAPSHOT = path.join(process.cwd(), "src/data/dataset.json");
const SERVER_SNAPSHOT = path.join(process.cwd(), "data", "dataset.json");

export function dataDir() {
  return DATA_DIR;
}

export function datasetPath() {
  return isPersistentServer() ? SERVER_SNAPSHOT : LOCAL_SNAPSHOT;
}

export async function listLocalXlsx(): Promise<string[]> {
  try {
    const names = await fs.readdir(dataDir());
    return names
      .filter((n) => n.toLowerCase().endsWith(".xlsx") && !n.startsWith("~$"))
      .sort();
  } catch {
    return [];
  }
}

export async function readLocalWorkbooks(): Promise<WorkbookFile[]> {
  const names = await listLocalXlsx();
  const files: WorkbookFile[] = [];
  for (const filename of names) {
    const buffer = await fs.readFile(path.join(dataDir(), filename));
    files.push({ filename, buffer });
  }
  return files;
}

export async function rebuildFromWorkbooks(
  files: WorkbookFile[]
): Promise<RebuildResult> {
  const warnings: string[] = [];
  const records = [];
  const sources = [];
  for (const file of files) {
    const parsed = await parseWorkbookBuffer(file.buffer, file.filename);
    warnings.push(...parsed.warnings);
    records.push(...parsed.records);
    sources.push({
      filename: file.filename,
      recordCount: parsed.records.length,
      dateMin: parsed.dateMin,
      dateMax: parsed.dateMax,
      sheets: parsed.sheets,
    });
  }
  const dataset = files.length ? buildDataset(records, sources) : emptyDataset();
  return { dataset, warnings };
}

export async function writeLocalSnapshot(dataset: Dataset) {
  await fs.mkdir(path.dirname(datasetPath()), { recursive: true });
  await fs.writeFile(datasetPath(), JSON.stringify(dataset, null, 2), "utf8");
}

export async function readLocalSnapshot(): Promise<Dataset | null> {
  try {
    const text = await fs.readFile(datasetPath(), "utf8");
    return JSON.parse(text) as Dataset;
  } catch {
    return null;
  }
}

export async function saveLocalUpload(filename: string, buffer: Buffer) {
  const safe = safeXlsxName(filename);
  await fs.mkdir(dataDir(), { recursive: true });
  await fs.writeFile(path.join(dataDir(), safe), buffer);
}

export async function removeLocalUpload(filename: string) {
  const safe = safeXlsxName(filename);
  await fs.unlink(path.join(dataDir(), safe));
}
