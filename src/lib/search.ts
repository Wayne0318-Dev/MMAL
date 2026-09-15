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
  const hay = mold.searchText.replace(/\s+/g, "").toUpperCase();
  if (hay.includes(n) || hay.includes(q.toUpperCase().replace(/\s+/g, ""))) {
    return true;
  }
  if (mold.canonical !== "MISSING" && n && mold.canonical.includes(n)) {
    return true;
  }
  return mold.products.some((p) => p.toUpperCase().includes(q.toUpperCase()));
}

export function machineMatches(machine: MachineIndex, query: string) {
  const q = query.trim();
  if (!q) return true;
  const n = normalizeQuery(q);
  if (machine.id.includes(n)) return true;
  if (machine.series === n) return true;
  return (
    machine.molds.some((m) => m.includes(n)) ||
    machine.products.some((p) => p.toUpperCase().includes(q.toUpperCase()))
  );
}

export function recordsForMold(dataset: Dataset, canonical: string): RecordRow[] {
  return dataset.records.filter(
    (r) => (r.mold.canonical || "MISSING") === canonical
  );
}

export function recordsForMachine(dataset: Dataset, machineId: string): RecordRow[] {
  return dataset.records.filter((r) => r.machine === machineId);
}

export function reliableMachines(mold: MoldIndex) {
  return mold.machines.filter(
    (m) => m.confidence === "high" || m.confidence === "inherited"
  );
}

export function flaggedMachines(mold: MoldIndex) {
  return mold.machines.filter(
    (m) => m.confidence !== "high" && m.confidence !== "inherited"
  );
}

export function jobForRecord(dataset: Dataset, jobId: string) {
  return dataset.jobs.find((j) => j.id === jobId);
}
