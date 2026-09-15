import {
  listLocalXlsx,
  readLocalSnapshot,
  readLocalWorkbooks,
  rebuildFromWorkbooks,
  removeLocalUpload,
  saveLocalUpload,
  writeLocalSnapshot,
} from "@/lib/store-files";
import {
  tursoConfigured,
  tursoRebuild,
  tursoReadSnapshot,
  tursoRemoveWorkbook,
  tursoSaveWorkbook,
  tursoWorkbookCount,
} from "@/lib/store-turso";
import type { RebuildResult, StorageInfo } from "@/lib/storage-types";
import { emptyDataset } from "@/lib/build-dataset";
import { isPersistentServer } from "@/lib/hosting";
import type { Dataset } from "@/lib/types";

export function storageInfo(): StorageInfo {
  const writeProtected =
    Boolean(process.env.IMPORT_KEY) ||
    Boolean(process.env.VERCEL) ||
    isPersistentServer();
  if (tursoConfigured()) {
    return {
      mode: "cloud",
      writeProtected,
      label: "云端数据库（关电脑也能查，导入不会丢）",
    };
  }
  if (isPersistentServer()) {
    return {
      mode: "server",
      writeProtected,
      label: "写在这台一直开着的服务器硬盘上。车间电脑关机也能查，不经过 GitHub。",
    };
  }
  return {
    mode: "local",
    writeProtected: Boolean(process.env.IMPORT_KEY),
    label: "本机文件（关电脑或删表格后，查询会受影响）",
  };
}

function attachStorage(dataset: Dataset): Dataset {
  return {
    ...dataset,
    meta: {
      ...dataset.meta,
      storage: storageInfo(),
    },
  };
}

async function seedCloudFromRepo() {
  if ((await tursoWorkbookCount()) > 0) return;
  const local = await readLocalWorkbooks();
  for (const file of local) {
    await tursoSaveWorkbook(file.filename, file.buffer);
  }
}

export async function readDataset(): Promise<Dataset> {
  if (tursoConfigured()) {
    await seedCloudFromRepo();
    const snapshot = await tursoReadSnapshot();
    if (snapshot) return attachStorage(snapshot);
    const rebuilt = await tursoRebuild();
    return attachStorage(rebuilt.dataset);
  }
  const snapshot = await readLocalSnapshot();
  if (snapshot) return attachStorage(snapshot);
  const files = await readLocalWorkbooks();
  if (!files.length) return attachStorage(emptyDataset());
  const rebuilt = await rebuildFromWorkbooks(files);
  await writeLocalSnapshot(rebuilt.dataset);
  return attachStorage(rebuilt.dataset);
}

export async function saveUpload(
  filename: string,
  buffer: Buffer
): Promise<RebuildResult> {
  if (tursoConfigured()) {
    await seedCloudFromRepo();
    await tursoSaveWorkbook(filename, buffer);
    const result = await tursoRebuild();
    return { ...result, dataset: attachStorage(result.dataset) };
  }
  if (process.env.VERCEL) {
    throw new Error(
      "网站已上线但还没接云数据库。请配置 TURSO_DATABASE_URL 和 TURSO_AUTH_TOKEN，否则导入会丢。"
    );
  }
  await saveLocalUpload(filename, buffer);
  const result = await rebuildFromWorkbooks(await readLocalWorkbooks());
  await writeLocalSnapshot(result.dataset);
  return { ...result, dataset: attachStorage(result.dataset) };
}

export async function removeSource(filename: string): Promise<RebuildResult> {
  if (tursoConfigured()) {
    await tursoRemoveWorkbook(filename);
    const result = await tursoRebuild();
    return { ...result, dataset: attachStorage(result.dataset) };
  }
  if (process.env.VERCEL) {
    throw new Error("网站已上线但还没接云数据库，无法改数据。");
  }
  await removeLocalUpload(filename);
  const files = await readLocalWorkbooks();
  const result = files.length
    ? await rebuildFromWorkbooks(files)
    : { dataset: emptyDataset(), warnings: [] };
  await writeLocalSnapshot(result.dataset);
  return { ...result, dataset: attachStorage(result.dataset) };
}

export async function rebuildFromDataDir(): Promise<RebuildResult> {
  if (tursoConfigured()) {
    await seedCloudFromRepo();
    const result = await tursoRebuild();
    return { ...result, dataset: attachStorage(result.dataset) };
  }
  const names = await listLocalXlsx();
  const result = names.length
    ? await rebuildFromWorkbooks(await readLocalWorkbooks())
    : { dataset: emptyDataset(), warnings: [] };
  await writeLocalSnapshot(result.dataset);
  return { ...result, dataset: attachStorage(result.dataset) };
}

export { storageInfo as getStorageInfo };
