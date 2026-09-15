import type { Dataset } from "@/lib/types";

export type StorageMode = "cloud" | "local";

export type StorageInfo = {
  mode: StorageMode;
  writeProtected: boolean;
  label: string;
};

export type RebuildResult = {
  dataset: Dataset;
  warnings: string[];
};

export type WorkbookFile = {
  filename: string;
  buffer: Buffer;
};

export function safeXlsxName(filename: string) {
  const base = filename.replace(/^.*[/\\]/, "").replace(/[/\\]/g, "");
  if (!base.toLowerCase().endsWith(".xlsx")) {
    throw new Error("只接受 .xlsx 文件（与现用转模记录同一格式）。");
  }
  if (base.startsWith("~$") || base.startsWith(".")) {
    throw new Error("不能导入临时文件。");
  }
  return base;
}

export function toBuffer(value: unknown): Buffer {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof ArrayBuffer) return Buffer.from(value);
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === "string") return Buffer.from(value, "base64");
  throw new Error("无法读取表格二进制内容。");
}
