export type Confidence =
  | "high"
  | "inherited"
  | "action_missing"
  | "mold_missing"
  | "conflict";

export type MoldIdentity = {
  raw: string | null;
  canonical: string | null;
  variant: "前模" | "后模" | null;
  ab: string | null;
  extraIds: string[];
  display: string;
  suspectedTypo?: {
    guess: string | null;
    reason: string;
  } | null;
};

export type RecordRow = {
  id: string;
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
  issues: string[];
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
  confidence: Confidence;
  issues: string[];
};

export type MoldIndex = {
  id: string;
  canonical: string;
  rawForms: string[];
  variants: string[];
  products: string[];
  machines: MachineEdge[];
  recordIds: string[];
  issues: string[];
  suspectedTypo: { guess: string | null; reason: string } | null;
  extraIdsSeen: string[];
  searchText: string;
  isTrialOnly: boolean;
  hasTrialAndNamed: boolean;
  conflictingProducts: boolean;
};

export type MachineIndex = {
  id: string;
  series: string;
  molds: string[];
  recordIds: string[];
  products: string[];
};

export type Question = {
  id: string;
  severity: "rule" | "scope" | "data";
  title: string;
  assumption: string;
  need: string;
};

export type Dataset = {
  meta: {
    sourceFile: string;
    period: string;
    sheets: string[];
    recordCount: number;
    jobCount: number;
    moldCount: number;
    machineCount: number;
    generatedNote: string;
  };
  parsingRules: string[];
  questions: Question[];
  stats: {
    upCount: number;
    downCount: number;
    missingAction: number;
    inheritedMachineRows: number;
    moldsOnMultipleMachines: number;
    flaggedRecordCount: number;
  };
  records: RecordRow[];
  jobs: Job[];
  molds: MoldIndex[];
  machines: MachineIndex[];
  flaggedRecordIds: string[];
};
