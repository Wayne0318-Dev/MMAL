"use client";

import { useEffect, useState } from "react";
import { FileUp, Trash2 } from "lucide-react";
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

  useEffect(() => {
    fetch("/api/storage")
      .then((r) => r.json())
      .then((info: StorageInfo) => setStorage(info))
      .catch(() => {});
  }, []);

  const writeProtected = storage?.writeProtected ?? dataset.meta.storage?.writeProtected;

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const body = new FormData();
      body.set("file", file);
      if (importKey) body.set("importKey", importKey);
      const res = await fetch("/api/import", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "导入失败");
        return;
      }
      onDataset(json.dataset);
      if (json.dataset?.meta?.storage) setStorage(json.dataset.meta.storage);
      const warnings = (json.warnings as string[] | undefined)?.filter(Boolean) ?? [];
      setMessage(
        `已纳入「${file.name}」。当前共 ${json.dataset.meta.sourceFiles.length} 份表、${json.dataset.meta.recordCount} 条记录。` +
          (warnings.length ? ` ${warnings.join(" ")}` : "")
      );
    } catch {
      setError("导入时网络中断，请再试一次。");
    } finally {
      setBusy(false);
    }
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
        <AlertTitle>
          {storageHeadline(storage?.mode)}
        </AlertTitle>
        <AlertDescription>
          {storage?.label ||
            "未配置云数据库时，导入只写到这台电脑；关电脑或删表格后，查询会变。"}
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>继续往上加月份</CardTitle>
          <CardDescription>
            十月、十一月把新表导进来即可。同一模具号会把各月机台合在一起。同名文件再导一次只替换该文件。
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
                if (file) void upload(file);
              }}
            />
          </label>
          {message ? (
            <Alert>
              <AlertTitle>导入完成</AlertTitle>
              <AlertDescription>{message}</AlertDescription>
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
