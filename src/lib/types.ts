export type MachineSource = "written" | "inherited";

export type MoldIdentity = {
  raw: string | null;
  canonical: string | null;
  variant: "前模" | "后模" | null;
  ids: string[];
  display: string;
  correctedFrom: string | null;
  correction: string | null;
};

export type RecordRow = {
  id: string;
  sourceFile: string;
  sheet: string;
  date: string;
  shift: string;
  row: number;
  machine: string;
  machineWritten: boolean;
  inheritedMachine: boolean;
  product: string | null;
  mold: MoldIdentity;
  action: "上" | "下" | "上+下" | null;
  orderTime: string | null;
  materialTime: string | null;
  changeTime: string | null;
  signTime: string | null;
  note: string | null;
  jobId: string;
};

export type Job = {
  id: string;
  date: string;
  shift: string;
  machine: string;
  recordIds: string[];
  sequence: { action: string; mold: string; product: string | null }[];
  kind: string;
};

export type MachineEdge = {
  machine: string;
  upCount: number;
  downCount: number;
  unknownCount: number;
  variants: string[];
  products: string[];
  dates: string[];
  files: string[];
  source: MachineSource;
};

export type MoldIndex = {
  id: string;
  canonical: string;
  rawForms: string[];
  variants: string[];
  products: string[];
  machines: MachineEdge[];
  recordIds: string[];
  corrections: string[];
  searchText: string;
};

export type MachineIndex = {
  id: string;
  molds: string[];
  recordIds: string[];
  products: string[];
};

export type Question = {
  id: string;
  status: "confirmed" | "open";
  title: string;
  answer: string;
};

export type SourceFile = {
  filename: string;
  recordCount: number;
  dateMin: string | null;
  dateMax: string | null;
  sheets: string[];
};

export type Dataset = {
  meta: {
    sourceFile: string;
    sourceFiles: SourceFile[];
    period: string;
    sheets: string[];
    recordCount: number;
    jobCount: number;
    moldCount: number;
    machineCount: number;
    generatedNote: string;
    storage?: {
      mode: "cloud" | "local";
      writeProtected: boolean;
      label: string;
    };
  };
  parsingRules: string[];
  questions: Question[];
  stats: {
    upCount: number;
    downCount: number;
    missingAction: number;
    inheritedMachineRows: number;
    moldsOnMultipleMachines: number;
    correctedRows: number;
  };
  records: RecordRow[];
  jobs: Job[];
  molds: MoldIndex[];
  machines: MachineIndex[];
};
