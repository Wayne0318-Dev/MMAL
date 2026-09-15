import { createClient, type Client } from "@libsql/client";
import { rebuildFromWorkbooks } from "@/lib/store-files";
import type { RebuildResult, WorkbookFile } from "@/lib/storage-types";
import { safeXlsxName, toBuffer } from "@/lib/storage-types";
import type { Dataset } from "@/lib/types";

let client: Client | null = null;
let schemaReady = false;

export function tursoConfigured() {
  return Boolean(process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN);
}

function getClient() {
  if (!client) {
    client = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return client;
}

async function ensureSchema() {
  if (schemaReady) return;
  const db = getClient();
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS workbooks (
      filename TEXT PRIMARY KEY,
      content BLOB NOT NULL,
      uploaded_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS snapshots (
      id TEXT PRIMARY KEY,
      json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  schemaReady = true;
}

export async function tursoListWorkbooks(): Promise<WorkbookFile[]> {
  await ensureSchema();
  const result = await getClient().execute(
    "SELECT filename, content FROM workbooks ORDER BY filename"
  );
  return result.rows.map((row) => ({
    filename: String(row.filename),
    buffer: toBuffer(row.content),
  }));
}

export async function tursoWorkbookCount() {
  await ensureSchema();
  const result = await getClient().execute("SELECT COUNT(*) AS n FROM workbooks");
  return Number(result.rows[0]?.n ?? 0);
}

export async function tursoSaveWorkbook(filename: string, buffer: Buffer) {
  await ensureSchema();
  const safe = safeXlsxName(filename);
  await getClient().execute({
    sql: "INSERT OR REPLACE INTO workbooks (filename, content, uploaded_at) VALUES (?, ?, ?)",
    args: [safe, buffer, new Date().toISOString()],
  });
}

export async function tursoRemoveWorkbook(filename: string) {
  await ensureSchema();
  const safe = safeXlsxName(filename);
  await getClient().execute({
    sql: "DELETE FROM workbooks WHERE filename = ?",
    args: [safe],
  });
}

export async function tursoSaveSnapshot(dataset: Dataset) {
  await ensureSchema();
  const copy = structuredClone(dataset);
  delete copy.meta.storage;
  await getClient().execute({
    sql: "INSERT OR REPLACE INTO snapshots (id, json, updated_at) VALUES ('current', ?, ?)",
    args: [JSON.stringify(copy), new Date().toISOString()],
  });
}

export async function tursoReadSnapshot(): Promise<Dataset | null> {
  await ensureSchema();
  const result = await getClient().execute(
    "SELECT json FROM snapshots WHERE id = 'current'"
  );
  const json = result.rows[0]?.json;
  if (typeof json !== "string" || !json) return null;
  return JSON.parse(json) as Dataset;
}

export async function tursoRebuild(): Promise<RebuildResult> {
  const files = await tursoListWorkbooks();
  const result = await rebuildFromWorkbooks(files);
  await tursoSaveSnapshot(result.dataset);
  return result;
}
