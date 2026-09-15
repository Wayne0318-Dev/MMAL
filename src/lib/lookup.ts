import { normalizeQuery } from "@/lib/search";
import type { Dataset, MachineEdge, MoldIndex, RecordRow } from "@/lib/types";

export type DateRange = "all" | "month" | "30d";

export const DATE_RANGE_OPTIONS: { id: DateRange; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "month", label: "本月" },
  { id: "30d", label: "近30天" },
];

function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function rangeStart(range: DateRange, today = new Date()): string | null {
  if (range === "all") return null;
  if (range === "30d") {
    const d = new Date(today);
    d.setDate(d.getDate() - 30);
    return isoDate(d);
  }
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
}

export function inDateRange(date: string, start: string | null) {
  if (!start) return true;
  return date >= start;
}

export function filterRecords(records: RecordRow[], start: string | null) {
  if (!start) return records;
  return records.filter((r) => inDateRange(r.date, start));
}

function compareRecords(a: RecordRow, b: RecordRow) {
  if (a.date !== b.date) return a.date.localeCompare(b.date);
  if (a.sheet !== b.sheet) return a.sheet.localeCompare(b.sheet, undefined, { numeric: true });
  return a.row - b.row;
}

export function sortRecordsNewestFirst(records: RecordRow[]) {
  return [...records].sort((a, b) => compareRecords(b, a));
}

export function lastMount(records: RecordRow[]): RecordRow | null {
  if (!records.length) return null;
  const sorted = [...records].sort(compareRecords);
  const ups = sorted.filter((r) => r.action === "上" || r.action === "上+下");
  return ups.length ? ups[ups.length - 1] : sorted[sorted.length - 1];
}

export function lastMountIsUp(row: RecordRow) {
  return row.action === "上" || row.action === "上+下";
}

export function sortEdges(edges: MachineEdge[]): MachineEdge[] {
  return [...edges].sort((a, b) => {
    const da = a.dates[a.dates.length - 1] || "";
    const db = b.dates[b.dates.length - 1] || "";
    if (da !== db) return db.localeCompare(da);
    const ca = a.upCount + a.downCount + a.unknownCount;
    const cb = b.upCount + b.downCount + b.unknownCount;
    return cb - ca || a.machine.localeCompare(b.machine, undefined, { numeric: true });
  });
}

export function machineEdgesFromRecords(records: RecordRow[]): MachineEdge[] {
  const map = new Map<string, MachineEdge>();
  for (const rec of records) {
    if (!rec.machine) continue;
    let edge = map.get(rec.machine);
    if (!edge) {
      edge = {
        machine: rec.machine,
        upCount: 0,
        downCount: 0,
        unknownCount: 0,
        variants: [],
        products: [],
        dates: [],
        files: [],
        source: rec.inheritedMachine ? "inherited" : "written",
      };
      map.set(rec.machine, edge);
    }
    if (!rec.inheritedMachine) edge.source = "written";
    if (rec.action === "上" || rec.action === "上+下") edge.upCount += 1;
    else if (rec.action === "下") edge.downCount += 1;
    else edge.unknownCount += 1;
    if (!edge.dates.includes(rec.date)) edge.dates.push(rec.date);
    if (rec.sourceFile && !edge.files.includes(rec.sourceFile)) {
      edge.files.push(rec.sourceFile);
    }
    if (rec.mold.variant && !edge.variants.includes(rec.mold.variant)) {
      edge.variants.push(rec.mold.variant);
    }
  }
  for (const edge of map.values()) edge.dates.sort();
  return sortEdges([...map.values()]);
}

export function machineListText(edges: MachineEdge[]) {
  return edges.map((e) => e.machine).join("、");
}

export function similarMoldIds(
  query: string,
  molds: MoldIndex[],
  limit = 6
): string[] {
  const n = normalizeQuery(query);
  if (n.length < 3) return [];
  const scored = molds
    .map((m) => ({ id: m.canonical, score: similarScore(n, m.canonical) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const ids: string[] = [];
  for (const item of scored) {
    if (!ids.includes(item.id)) ids.push(item.id);
    if (ids.length >= limit) break;
  }
  return ids;
}

function similarScore(query: string, id: string) {
  if (id === query) return 0;
  if (id.includes(query) || query.includes(id)) return 80 + Math.min(query.length, 15);
  const dq = query.replace(/\D/g, "");
  const di = id.replace(/\D/g, "");
  if (dq.length >= 4 && di.includes(dq)) return 60;
  if (di.length >= 4 && dq.includes(di)) return 55;
  if (query.length >= 5 && id.slice(0, 5) === query.slice(0, 5)) return 40;
  return 0;
}

export function datasetDiff(before: Dataset, after: Dataset) {
  const beforeMolds = new Set(before.molds.map((m) => m.canonical));
  const afterMolds = new Set(after.molds.map((m) => m.canonical));
  const beforeMachines = new Set(before.machines.map((m) => m.id));
  const afterMachines = new Set(after.machines.map((m) => m.id));
  return {
    addedMolds: [...afterMolds].filter((id) => !beforeMolds.has(id)).sort(),
    removedMolds: [...beforeMolds].filter((id) => !afterMolds.has(id)).sort(),
    addedMachines: [...afterMachines].filter((id) => !beforeMachines.has(id)).sort(),
    removedMachines: [...beforeMachines].filter((id) => !afterMachines.has(id)).sort(),
    recordDelta: after.meta.recordCount - before.meta.recordCount,
    fileCount: after.meta.sourceFiles.length,
  };
}
