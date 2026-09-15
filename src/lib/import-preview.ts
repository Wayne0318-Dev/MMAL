import type { ParsedWorkbook } from "@/lib/parse-workbook";
import type { Dataset } from "@/lib/types";

export type ImportPreview = {
  filename: string;
  replacing: boolean;
  existing?: {
    filename: string;
    recordCount: number;
    dateMin: string | null;
    dateMax: string | null;
  };
  sheets: string[];
  dateMin: string | null;
  dateMax: string | null;
  recordCount: number;
  dayCount: number;
  newMolds: string[];
  newMachines: string[];
  droppedMolds: string[];
  missingMoldCount: number;
  warnings: string[];
};

export function buildImportPreview(
  parsed: ParsedWorkbook,
  current: Dataset
): ImportPreview {
  const filename = parsed.sourceFile;
  const existing = current.meta.sourceFiles.find((f) => f.filename === filename);
  const remaining = current.records.filter((r) => r.sourceFile !== filename);
  const remainingMolds = new Set(remaining.flatMap((r) => r.mold.ids));
  const remainingMachines = new Set(
    remaining.map((r) => r.machine).filter(Boolean)
  );
  const incomingMolds = [
    ...new Set(parsed.records.flatMap((r) => r.mold.ids)),
  ];
  const incomingMachines = [
    ...new Set(parsed.records.map((r) => r.machine).filter(Boolean)),
  ];
  const oldFileMolds = [
    ...new Set(
      current.records
        .filter((r) => r.sourceFile === filename)
        .flatMap((r) => r.mold.ids)
    ),
  ];
  const days = new Set(parsed.records.map((r) => r.date).filter(Boolean));

  return {
    filename,
    replacing: Boolean(existing),
    existing: existing
      ? {
          filename: existing.filename,
          recordCount: existing.recordCount,
          dateMin: existing.dateMin,
          dateMax: existing.dateMax,
        }
      : undefined,
    sheets: parsed.sheets,
    dateMin: parsed.dateMin,
    dateMax: parsed.dateMax,
    recordCount: parsed.records.length,
    dayCount: days.size,
    newMolds: incomingMolds.filter((id) => !remainingMolds.has(id)).sort(),
    newMachines: incomingMachines
      .filter((id) => !remainingMachines.has(id))
      .sort(),
    droppedMolds: existing
      ? oldFileMolds
          .filter((id) => !incomingMolds.includes(id) && !remainingMolds.has(id))
          .sort()
      : [],
    missingMoldCount: parsed.records.filter((r) => r.mold.ids.length === 0)
      .length,
    warnings: parsed.warnings.filter(Boolean),
  };
}
