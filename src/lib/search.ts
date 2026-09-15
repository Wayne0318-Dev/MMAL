import type { Dataset, MoldIndex, MachineIndex, RecordRow } from "@/lib/types";

export function normalizeQuery(q: string) {
  return q
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/前模|后模/g, "")
    .replace(/[前后]$/g, "");
}

export function moldMatches(mold: MoldIndex, query: string) {
  const q = query.trim();
  if (!q) return true;
  const n = normalizeQuery(q);
  if (!n) return true;
  if (mold.canonical.includes(n)) return true;
  const hay = mold.searchText.replace(/\s+/g, "").toUpperCase();
  return hay.includes(n);
}

export function machineMatches(machine: MachineIndex, query: string) {
  const q = query.trim();
  if (!q) return true;
  const n = normalizeQuery(q);
  if (machine.id.includes(n)) return true;
  return machine.molds.some((m) => m.includes(n));
}

export function recordsForMold(dataset: Dataset, canonical: string): RecordRow[] {
  return dataset.records.filter((r) => r.mold.ids.includes(canonical));
}

export function recordsForMachine(
  dataset: Dataset,
  machineId: string
): RecordRow[] {
  return dataset.records.filter((r) => r.machine === machineId);
}
