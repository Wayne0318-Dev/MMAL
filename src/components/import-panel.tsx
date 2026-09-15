"use client";

import { useEffect, useState } from "react";
import { FileUp, Trash2 } from "lucide-react";
import type { ImportPreview } from "@/lib/import-preview";
import { datasetDiff } from "@/lib/lookup";
import type { Dataset } from "@/lib/types";
import {
  storageHeadline,
  type StorageInfo,
} from "@/lib/storage-types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ImportDiff = ReturnType<typeof datasetDiff>;

export function ImportPanel({
  dataset,
  onDataset,
}: {
  dataset: Dataset;
  onDataset: (dataset: Dataset) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importKey, setImportKey] = useState("");
  const [storage, setStorage] = useState<StorageInfo | null>(
    dataset.meta.storage ?? null
  );
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [diff, setDiff] = useState<ImportDiff | null>(null);

  useEffect(() => {
    fetch("/api/storage")
      .then((r) => r.json())
      .then((info: StorageInfo) => setStorage(info))
      .catch(() => {});
  }, []);

  const writeProtected = storage?.writeProtected ?? dataset.meta.storage?.writeProtected;

  async function postFile(file: File, previewOnly: boolean) {
    const body = new FormData();
    body.set("file", file);
    if (importKey) body.set("importKey", importKey);
    if (previewOnly) body.set("preview", "1");
    const res = await fetch("/api/import", { method: "POST", body });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || (previewOnly ? "无法预览" : "导入失败"));
    }
    return json;
  }

  async function loadPreview(file: File) {
    setBusy(true);
    setError(null);
    setMessage(null);
    setDiff(null);
    try {
      const json = await postFile(file, true);
      setPendingFile(file);
      setPreview(json.preview as ImportPreview);
    } catch (err) {
      setPendingFile(null);
      setPreview(null);
      setError(err instanceof Error ? err.message : "无法预览这张表。");
    } finally {
      setBusy(false);
    }
  }

  async function confirmImport() {
    if (!pendingFile) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const before = dataset;
    try {
      const json = await postFile(pendingFile, false);
      onDataset(json.dataset);
      if (json.dataset?.meta?.storage) setStorage(json.dataset.meta.storage);
      const nextDiff = datasetDiff(before, json.dataset);
      setDiff(nextDiff);
      const warnings = (json.warnings as string[] | undefined)?.filter(Boolean) ?? [];
      setMessage(
        `已纳入「${pendingFile.name}」。当前共 ${json.dataset.meta.sourceFiles.length} 份表、${json.dataset.meta.recordCount} 条记录。` +
          (warnings.length ? ` ${warnings.join(" ")}` : "")
      );
      setPendingFile(null);
      setPreview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "导入时网络中断，请再试一次。");
    } finally {
      setBusy(false);
    }
  }

  function cancelPreview() {
    setPendingFile(null);
    setPreview(null);
    setError(null);
  }

  async function remove(filename: string) {
    const where =
      storage?.mode === "cloud"
        ? "会从云端汇总里去掉这份表。"
        : storage?.mode === "server"
          ? "会从这台服务器硬盘上的表格里去掉。"
          : "本机这份表文件也会删除。";
    if (!confirm(`去掉「${filename}」？${where}`)) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    setDiff(null);
    try {
      const res = await fetch(
        `/api/sources?filename=${encodeURIComponent(filename)}`,
        {
          method: "DELETE",
          headers: importKey ? { "x-import-key": importKey } : undefined,
        }
      );
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "删除失败");
        return;
      }
      onDataset(json.dataset);
      if (json.dataset?.meta?.storage) setStorage(json.dataset.meta.storage);
      setMessage(`已去掉「${filename}」。`);
    } catch {
      setError("删除失败，请再试一次。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Alert>
        <AlertTitle>{storageHeadline(storage?.mode)}</AlertTitle>
        <AlertDescription>
          {storage?.label ||
            "未配置云数据库时，导入只写到这台电脑；关电脑或删表格后，查询会变。"}
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>继续往上加月份</CardTitle>
          <CardDescription>
            先预览再写入。同名文件会替换该月，不会把同一月加两遍。十月、十一月用不同文件名即可累加。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {writeProtected ? (
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="import-key">
                导入口令
              </label>
              <Input
                id="import-key"
                type="password"
                value={importKey}
                onChange={(e) => setImportKey(e.target.value)}
                placeholder="导入或删除前填写"
                autoComplete="off"
              />
            </div>
          ) : null}
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-8 text-sm hover:bg-muted/50">
            <FileUp className="size-5" />
            <span>{busy ? "正在读表…" : "选择 .xlsx 转模记录表"}</span>
            <span className="text-muted-foreground">
              表头需与现表相同：机台、机种品名、模具编号、上/下
            </span>
            <input
              type="file"
              accept=".xlsx"
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void loadPreview(file);
              }}
            />
          </label>

          {preview ? (
            <PreviewCard
              preview={preview}
              busy={busy}
              onConfirm={() => void confirmImport()}
              onCancel={cancelPreview}
            />
          ) : null}

          {message ? (
            <Alert>
              <AlertTitle>导入完成</AlertTitle>
              <AlertDescription>
                <p>{message}</p>
                {diff ? <DiffLines diff={diff} /> : null}
              </AlertDescription>
            </Alert>
          ) : null}
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>没有导入成功</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>已经纳入的表</CardTitle>
          <CardDescription>
            {dataset.meta.sourceFiles.length
              ? `覆盖 ${dataset.meta.period}`
              : "还没有表。先导入一份转模记录。"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dataset.meta.sourceFiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">空。</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>文件</TableHead>
                  <TableHead>日期范围</TableHead>
                  <TableHead>记录</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {dataset.meta.sourceFiles.map((file) => (
                  <TableRow key={file.filename}>
                    <TableCell className="font-medium">{file.filename}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {file.dateMin && file.dateMax
                        ? file.dateMin === file.dateMax
                          ? file.dateMin
                          : `${file.dateMin} ~ ${file.dateMax}`
                        : "—"}
                    </TableCell>
                    <TableCell>{file.recordCount}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => void remove(file.filename)}
                      >
                        <Trash2 className="size-4" />
                        去掉
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PreviewCard({
  preview,
  busy,
  onConfirm,
  onCancel,
}: {
  preview: ImportPreview;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
      <div>
        <p className="font-medium">预览「{preview.filename}」</p>
        <p className="text-sm text-muted-foreground">
          {preview.replacing
            ? `将替换已有的同名文件（现在 ${preview.existing?.recordCount ?? 0} 条，日期 ${formatSpan(preview.existing?.dateMin, preview.existing?.dateMax)}）。`
            : "这是一份新文件，会累加进现有汇总。"}
        </p>
      </div>
      <ul className="grid gap-1 text-sm sm:grid-cols-2">
        <li>识别到 {preview.dayCount} 天，{preview.recordCount} 条记录</li>
        <li>
          日期 {formatSpan(preview.dateMin, preview.dateMax)}
        </li>
        <li>工作表 {preview.sheets.length} 张</li>
        <li>新模具 {preview.newMolds.length} 个，新机台 {preview.newMachines.length} 台</li>
      </ul>
      {preview.sheets.length ? (
        <p className="text-xs text-muted-foreground">
          表：{preview.sheets.slice(0, 12).join("、")}
          {preview.sheets.length > 12 ? ` 等 ${preview.sheets.length} 张` : ""}
        </p>
      ) : null}
      <IdList
        label={
          preview.replacing
            ? "这份表里有、其他月份没有的模具"
            : "新出现的模具"
        }
        ids={preview.newMolds}
      />
      <IdList
        label={
          preview.replacing
            ? "这份表里有、其他月份没有的机台"
            : "新出现的机台"
        }
        ids={preview.newMachines}
      />
      {preview.droppedMolds.length ? (
        <IdList
          label="替换后将从汇总里消失的模具（只出现在旧的同名文件里）"
          ids={preview.droppedMolds}
        />
      ) : null}
      {preview.missingMoldCount ? (
        <p className="text-sm text-amber-800">
          有 {preview.missingMoldCount} 行缺模具编号（未补上确认过的缺号规则）。
        </p>
      ) : null}
      {preview.warnings.length ? (
        <div className="space-y-1 text-sm text-amber-800">
          <p className="font-medium">解析警告</p>
          <ul className="list-disc pl-5">
            {preview.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button onClick={onConfirm} disabled={busy}>
          {busy ? "正在写入…" : "确认导入"}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={busy}>
          取消
        </Button>
      </div>
    </div>
  );
}

function DiffLines({ diff }: { diff: ImportDiff }) {
  const bits = [
    diff.recordDelta === 0
      ? "记录条数不变"
      : `记录 ${diff.recordDelta > 0 ? "+" : ""}${diff.recordDelta} 条`,
    diff.addedMolds.length ? `新模具 ${diff.addedMolds.length} 个` : null,
    diff.removedMolds.length ? `减少模具 ${diff.removedMolds.length} 个` : null,
    diff.addedMachines.length ? `新机台 ${diff.addedMachines.length} 台` : null,
    diff.removedMachines.length ? `减少机台 ${diff.removedMachines.length} 台` : null,
  ].filter(Boolean);
  return (
    <div className="mt-2 space-y-1 text-sm">
      <p>{bits.join(" · ")}</p>
      {diff.addedMolds.length ? (
        <p>新模具：{previewIds(diff.addedMolds)}</p>
      ) : null}
      {diff.addedMachines.length ? (
        <p>新机台：{previewIds(diff.addedMachines)}</p>
      ) : null}
      {diff.removedMolds.length ? (
        <p>减少模具：{previewIds(diff.removedMolds)}</p>
      ) : null}
    </div>
  );
}

function IdList({ label, ids }: { label: string; ids: string[] }) {
  if (!ids.length) return null;
  return (
    <p className="text-sm">
      <span className="text-muted-foreground">{label}：</span>
      {previewIds(ids)}
    </p>
  );
}

function previewIds(ids: string[]) {
  const shown = ids.slice(0, 16).join("、");
  return ids.length > 16 ? `${shown} 等 ${ids.length} 个` : shown;
}

function formatSpan(min?: string | null, max?: string | null) {
  if (!min && !max) return "—";
  if (min && max && min !== max) return `${min} ~ ${max}`;
  return min || max || "—";
}
