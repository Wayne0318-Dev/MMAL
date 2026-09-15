"use client";

import { useState } from "react";
import { FileUp, Trash2 } from "lucide-react";
import type { Dataset } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch("/api/import", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "导入失败");
        return;
      }
      onDataset(json.dataset);
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
    if (!confirm(`从汇总里去掉「${filename}」？磁盘上的这份表也会删除。`)) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/sources?filename=${encodeURIComponent(filename)}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "删除失败");
        return;
      }
      onDataset(json.dataset);
      setMessage(`已去掉「${filename}」。`);
    } catch {
      setError("删除失败，请再试一次。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>继续往上加月份</CardTitle>
          <CardDescription>
            转模记录是滚动的。十月、十一月把新表导进来即可，同一模具号会把各月出现过的机台合在一起。
            同名文件再导一次只替换该文件，不会把同一月加两遍。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
