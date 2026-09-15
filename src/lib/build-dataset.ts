import { PARSING_RULES, QUESTIONS } from "@/lib/constants";
import type {
  Dataset,
  Job,
  MachineIndex,
  MoldIndex,
  RecordRow,
  SourceFile,
} from "@/lib/types";

export function attachJobs(records: RecordRow[]): Job[] {
  const sorted = [...records].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.sourceFile !== b.sourceFile) return a.sourceFile.localeCompare(b.sourceFile);
    if (a.sheet !== b.sheet) return a.sheet.localeCompare(b.sheet, undefined, { numeric: true });
    return a.row - b.row;
  });

  const jobs: Job[] = [];
  let current: Job | null = null;
  for (const rec of sorted) {
    const startNew =
      !current ||
      rec.machineWritten ||
      rec.date !== current.date ||
      rec.shift !== current.shift ||
      rec.machine !== current.machine;
    if (startNew) {
      if (current) jobs.push(current);
      current = {
        id: `job-${String(jobs.length + 1).padStart(3, "0")}`,
        date: rec.date,
        shift: rec.shift,
        machine: rec.machine,
        recordIds: [rec.id],
        sequence: [],
        kind: "",
      };
    } else if (current) {
      current.recordIds.push(rec.id);
    }
    if (current) rec.jobId = current.id;
  }
  if (current) jobs.push(current);

  const byId = new Map(sorted.map((r) => [r.id, r]));
  for (const job of jobs) {
    const steps = job.recordIds.map((id) => byId.get(id)!);
    job.sequence = steps.map((s) => ({
      action: s.action || "未勾选",
      mold: s.mold.display,
      product: s.product,
    }));
    job.kind = classifyJob(job.sequence);
  }
  return jobs;
}

function classifyJob(sequence: Job["sequence"]) {
  const actions = sequence.map((s) => s.action);
  const molds = sequence.map((s) => s.mold);
  if (actions[0] === "下" && actions[1] === "上" && actions.length === 2) {
    if (molds[0] === molds[1]) return "同一副模下了再上（半边维修/保养后重装）";
    return "标准转模：下旧模 → 上新模";
  }
  if (sequence.length === 1) return "单行记录（机台与模具仍关联）";
  if (sequence.length >= 3) return "同机台连续多次装卸";
  return "同机台多行记录";
}

function addMachineEdge(
  bucket: MoldIndex,
  rec: RecordRow,
  variant: RecordRow["mold"]["variant"]
) {
  const existing = bucket.machines.find((x) => x.machine === rec.machine);
  const source = rec.inheritedMachine ? "inherited" : "written";
  if (!existing) {
    bucket.machines.push({
      machine: rec.machine,
      upCount: rec.action === "上" ? 1 : 0,
      downCount: rec.action === "下" ? 1 : 0,
      unknownCount: rec.action === "上" || rec.action === "下" ? 0 : 1,
      variants: [variant || "未标注"],
      products: rec.product ? [rec.product] : [],
      dates: [rec.date],
      files: [rec.sourceFile],
      source,
    });
    return;
  }
  if (rec.action === "上") existing.upCount += 1;
  else if (rec.action === "下") existing.downCount += 1;
  else existing.unknownCount += 1;
  const v = variant || "未标注";
  if (!existing.variants.includes(v)) existing.variants.push(v);
  if (rec.product && !existing.products.includes(rec.product)) {
    existing.products.push(rec.product);
  }
  if (!existing.dates.includes(rec.date)) existing.dates.push(rec.date);
  existing.dates.sort();
  if (!existing.files.includes(rec.sourceFile)) existing.files.push(rec.sourceFile);
  if (source === "written") existing.source = "written";
}

function machineSortKey(id: string): [string, number, string] {
  const m = id.match(/^([A-Z]+)(\d+)$/);
  if (m) return [m[1], Number(m[2]), id];
  return [id, 0, id];
}

export function buildDataset(
  records: RecordRow[],
  sourceFiles: SourceFile[]
): Dataset {
  const jobs = attachJobs(records);
  const molds = new Map<string, MoldIndex>();
  const machines = new Map<string, MachineIndex>();

  function moldBucket(canonical: string): MoldIndex {
    let bucket = molds.get(canonical);
    if (!bucket) {
      bucket = {
        id: canonical,
        canonical,
        rawForms: [],
        variants: [],
        products: [],
        machines: [],
        recordIds: [],
        corrections: [],
        searchText: "",
      };
      molds.set(canonical, bucket);
    }
    return bucket;
  }

  for (const rec of records) {
    const ids = rec.mold.ids.length
      ? rec.mold.ids
      : rec.mold.canonical
        ? [rec.mold.canonical]
        : [];
    if (!ids.length) continue;
    for (const moldId of ids) {
      const bucket = moldBucket(moldId);
      if (!bucket.recordIds.includes(rec.id)) bucket.recordIds.push(rec.id);
      if (rec.mold.raw && !bucket.rawForms.includes(rec.mold.raw)) {
        bucket.rawForms.push(rec.mold.raw);
      }
      if (rec.mold.variant && !bucket.variants.includes(rec.mold.variant)) {
        bucket.variants.push(rec.mold.variant);
      }
      if (rec.product && !bucket.products.includes(rec.product)) {
        bucket.products.push(rec.product);
      }
      if (rec.mold.correction && !bucket.corrections.includes(rec.mold.correction)) {
        bucket.corrections.push(rec.mold.correction);
      }
      addMachineEdge(bucket, rec, rec.mold.variant);

      let machine = machines.get(rec.machine);
      if (!machine) {
        machine = { id: rec.machine, molds: [], recordIds: [], products: [] };
        machines.set(rec.machine, machine);
      }
      if (!machine.recordIds.includes(rec.id)) machine.recordIds.push(rec.id);
      if (!machine.molds.includes(moldId)) machine.molds.push(moldId);
      if (rec.product && !machine.products.includes(rec.product)) {
        machine.products.push(rec.product);
      }
    }
  }

  const moldList: MoldIndex[] = [...molds.values()].sort((a, b) =>
    a.canonical.localeCompare(b.canonical)
  );
  for (const bucket of moldList) {
    bucket.searchText = [
      bucket.canonical,
      ...bucket.rawForms,
      ...bucket.products,
      ...bucket.variants,
      ...bucket.machines.map((m) => m.machine),
    ]
      .join(" ")
      .toUpperCase();
    bucket.machines.sort((a, b) => {
      const ka = machineSortKey(a.machine);
      const kb = machineSortKey(b.machine);
      return ka[0].localeCompare(kb[0]) || ka[1] - kb[1] || ka[2].localeCompare(kb[2]);
    });
  }

  const machineList = [...machines.values()].sort((a, b) => {
    const ka = machineSortKey(a.id);
    const kb = machineSortKey(b.id);
    return ka[0].localeCompare(kb[0]) || ka[1] - kb[1] || ka[2].localeCompare(kb[2]);
  });

  const dates = records.map((r) => r.date).filter(Boolean).sort();
  const period =
    dates.length === 0
      ? "无记录"
      : dates[0] === dates[dates.length - 1]
        ? dates[0]
        : `${dates[0]} ~ ${dates[dates.length - 1]}`;

  return {
    meta: {
      sourceFile: sourceFiles.map((s) => s.filename).join("、") || "（无）",
      sourceFiles,
      period,
      sheets: [...new Set(records.map((r) => r.sheet))],
      recordCount: records.length,
      jobCount: jobs.length,
      moldCount: moldList.length,
      machineCount: machineList.length,
      generatedNote:
        "只记录表里实际出现过的 模具号↔机台号。多份转模表按文件累加。不做同组机台联想。",
    },
    parsingRules: PARSING_RULES,
    questions: QUESTIONS,
    stats: {
      upCount: records.filter((r) => r.action === "上").length,
      downCount: records.filter((r) => r.action === "下").length,
      missingAction: records.filter((r) => !r.action).length,
      inheritedMachineRows: records.filter((r) => r.inheritedMachine).length,
      moldsOnMultipleMachines: moldList.filter((m) => m.machines.length > 1).length,
      correctedRows: records.filter((r) => r.mold.correction).length,
    },
    records,
    jobs,
    molds: moldList,
    machines: machineList,
  };
}

export function emptyDataset(): Dataset {
  return buildDataset([], []);
}
