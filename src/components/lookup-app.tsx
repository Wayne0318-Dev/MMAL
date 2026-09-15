"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { CheckCircle2, Copy, Factory, Search } from "lucide-react";
import {
  DATE_RANGE_OPTIONS,
  filterRecords,
  lastMount,
  lastMountIsUp,
  machineEdgesFromRecords,
  machineListText,
  rangeStart,
  similarMoldIds,
  sortRecordsNewestFirst,
  type DateRange,
} from "@/lib/lookup";
import {
  machineMatches,
  moldMatches,
  recordsForMachine,
  recordsForMold,
} from "@/lib/search";
import type { Dataset, MachineEdge, MachineSource, MoldIndex, RecordRow } from "@/lib/types";
import { ImportPanel } from "@/components/import-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const DatasetContext = createContext<Dataset | null>(null);

function useDataset() {
  const value = useContext(DatasetContext);
  if (!value) throw new Error("dataset missing");
  return value;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  if (!text) return null;
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        } catch {
          setCopied(false);
        }
      }}
    >
      <Copy className="size-3.5" />
      {copied ? "已复制" : label}
    </Button>
  );
}

function DateRangeBar({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (value: DateRange) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {DATE_RANGE_OPTIONS.map((opt) => (
        <Button
          key={opt.id}
          type="button"
          size="sm"
          variant={value === opt.id ? "default" : "outline"}
          onClick={() => onChange(opt.id)}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  );
}

function SourceBadge({ value }: { value: MachineSource }) {
  if (value === "inherited") {
    return <Badge variant="outline">机台格空白，继承上一行</Badge>;
  }
  return <Badge variant="secondary">本行写了机台</Badge>;
}

function ActionBadge({ action }: { action: RecordRow["action"] }) {
  if (action === "上") {
    return <Badge className="bg-emerald-700 text-white hover:bg-emerald-700">上机</Badge>;
  }
  if (action === "下") {
    return <Badge className="bg-amber-700 text-white hover:bg-amber-700">下机</Badge>;
  }
  return <Badge variant="outline">未勾选</Badge>;
}

function MachineButton({
  id,
  onPick,
}: {
  id: string;
  onPick: (id: string) => void;
}) {
  return (
    <Button variant="outline" size="sm" className="font-mono" onClick={() => onPick(id)}>
      {id}
    </Button>
  );
}

function MoldIdButtons({
  ids,
  onPick,
}: {
  ids: string[];
  onPick: (id: string) => void;
}) {
  return (
    <div className="flex flex-col items-start gap-1">
      {ids.map((id) => (
        <button
          key={id}
          type="button"
          className="font-mono underline-offset-4 hover:underline"
          onClick={() => onPick(id)}
        >
          {id}
        </button>
      ))}
    </div>
  );
}

function RecordTable({
  rows,
  onPickMachine,
  onPickMold,
}: {
  rows: RecordRow[];
  onPickMachine: (id: string) => void;
  onPickMold: (id: string) => void;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">没有转模记录。</p>;
  }
  const ordered = sortRecordsNewestFirst(rows);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>日期班次</TableHead>
          <TableHead>机台</TableHead>
          <TableHead>动作</TableHead>
          <TableHead>模具</TableHead>
          <TableHead>机种名（备注）</TableHead>
          <TableHead>完成时间</TableHead>
          <TableHead>备注</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ordered.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <div className="whitespace-nowrap">{row.date.slice(5)}</div>
              <div className="text-muted-foreground">{row.shift}</div>
              {row.sourceFile ? (
                <div className="max-w-[140px] truncate text-xs text-muted-foreground">
                  {row.sourceFile}
                </div>
              ) : null}
            </TableCell>
            <TableCell>
              <button
                type="button"
                className="font-mono font-medium underline-offset-4 hover:underline"
                onClick={() => onPickMachine(row.machine)}
              >
                {row.machine}
              </button>
              {row.inheritedMachine ? (
                <div className="text-xs text-muted-foreground">继承</div>
              ) : null}
            </TableCell>
            <TableCell>
              <ActionBadge action={row.action} />
            </TableCell>
            <TableCell>
              <MoldIdButtons ids={row.mold.ids} onPick={onPickMold} />
              {row.mold.variant ? (
                <div className="text-xs text-muted-foreground">{row.mold.variant}</div>
              ) : null}
              {row.mold.correction ? (
                <div className="text-xs text-muted-foreground">
                  原写 {row.mold.raw || "空"}
                </div>
              ) : row.mold.raw && row.mold.ids.length === 1 && row.mold.raw !== row.mold.ids[0] ? (
                <div className="max-w-[180px] truncate text-xs text-muted-foreground">
                  原写 {row.mold.raw}
                </div>
              ) : null}
            </TableCell>
            <TableCell className="max-w-[200px] whitespace-normal text-muted-foreground">
              {row.product || "—"}
            </TableCell>
            <TableCell className="font-mono text-xs">{row.changeTime || "—"}</TableCell>
            <TableCell>{row.note || "—"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function MachineEdgeList({
  edges,
  onPick,
}: {
  edges: MachineEdge[];
  onPick: (id: string) => void;
}) {
  if (!edges.length) {
    return <p className="text-sm text-muted-foreground">当前时间范围内没有机台记录。</p>;
  }
  return (
    <div className="grid gap-2">
      {edges.map((edge) => (
        <div
          key={edge.machine}
          className="flex flex-col gap-2 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <MachineButton id={edge.machine} onPick={onPick} />
              <SourceBadge value={edge.source} />
            </div>
            <p className="text-sm text-muted-foreground">
              出现 {edge.upCount + edge.downCount + edge.unknownCount} 次
              {edge.upCount ? ` · 上机 ${edge.upCount}` : ""}
              {edge.downCount ? ` · 下机 ${edge.downCount}` : ""}
              {edge.variants.filter((v) => v !== "未标注").length
                ? ` · ${edge.variants.filter((v) => v !== "未标注").join("、")}`
                : ""}
            </p>
            {edge.files?.length ? (
              <p className="text-xs text-muted-foreground">{edge.files.join("、")}</p>
            ) : null}
          </div>
          <div className="text-xs text-muted-foreground sm:text-right">
            {edge.dates.length
              ? `最近 ${edge.dates[edge.dates.length - 1].slice(5)}`
              : ""}
            {edge.dates.length > 1 ? (
              <div>{edge.dates.map((d) => d.slice(5)).join("、")}</div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function MoldDetail({
  mold,
  rows,
  onPickMachine,
  onPickMold,
}: {
  mold: MoldIndex;
  rows: RecordRow[];
  onPickMachine: (id: string) => void;
  onPickMold: (id: string) => void;
}) {
  const edges = machineEdgesFromRecords(rows);
  const latest = lastMount(rows);
  const machineText = machineListText(edges);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-mono text-2xl font-semibold tracking-tight">
            {mold.canonical}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            纳入的表里实际出现过的机台：
            {machineText || "无"}
          </p>
          {mold.rawForms.length > 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              表里的写法：{mold.rawForms.join("、")}
            </p>
          ) : null}
          {mold.corrections.length > 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              已按确认改号：{mold.corrections.join("；")}
            </p>
          ) : null}
        </div>
        <CopyButton text={machineText} label="复制机台号" />
      </div>

      {latest ? (
        <div className="rounded-xl border bg-muted/40 p-4">
          <p className="text-xs font-medium tracking-wide text-muted-foreground">
            {lastMountIsUp(latest) ? "最近一次上机" : "最近一次记录（表上未勾选上机）"}
          </p>
          <p className="mt-1 text-lg font-medium">
            <span className="font-mono">{latest.machine}</span>
            <span className="text-muted-foreground"> · {latest.date}</span>
            <span className="text-muted-foreground"> · {latest.shift}</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {latest.sourceFile}
            {latest.mold.variant ? ` · ${latest.mold.variant}` : ""}
            {latest.product ? ` · ${latest.product}` : ""}
            。这是表里的事实，不能据此认定此刻一定还在这台机上。
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          当前时间范围内没有这条模具的转模记录。可改选「全部」。
        </p>
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-medium">关联机台（按最近日期）</h3>
        <MachineEdgeList edges={edges} onPick={onPickMachine} />
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">原始记录</h3>
        <RecordTable
          rows={rows}
          onPickMachine={onPickMachine}
          onPickMold={onPickMold}
        />
      </div>
    </div>
  );
}

export function LookupApp({ initialDataset }: { initialDataset: Dataset }) {
  const [dataset, setDataset] = useState(initialDataset);
  const [tab, setTab] = useState("mold");
  const [moldQuery, setMoldQuery] = useState("");
  const [machineQuery, setMachineQuery] = useState("");
  const [selectedMold, setSelectedMold] = useState<string | null>(null);
  const [selectedMachine, setSelectedMachine] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>("all");

  const start = rangeStart(dateRange);
  const rangedRecords = useMemo(
    () => filterRecords(dataset.records, start),
    [dataset.records, start]
  );

  const moldResults = useMemo(() => {
    return dataset.molds
      .filter((m) => moldMatches(m, moldQuery))
      .filter((m) =>
        dateRange === "all"
          ? true
          : rangedRecords.some((r) => r.mold.ids.includes(m.canonical))
      )
      .sort((a, b) => {
        const ra = lastMount(
          rangedRecords.filter((r) => r.mold.ids.includes(a.canonical))
        );
        const rb = lastMount(
          rangedRecords.filter((r) => r.mold.ids.includes(b.canonical))
        );
        const da = ra?.date ?? "";
        const db = rb?.date ?? "";
        if (da !== db) return db.localeCompare(da);
        return (
          b.machines.length - a.machines.length ||
          a.canonical.localeCompare(b.canonical)
        );
      });
  }, [dataset, moldQuery, dateRange, rangedRecords]);

  const machineResults = useMemo(() => {
    return dataset.machines
      .filter((m) => machineMatches(m, machineQuery))
      .filter((m) =>
        dateRange === "all" ? true : rangedRecords.some((r) => r.machine === m.id)
      )
      .sort((a, b) => {
        const ra = lastMount(rangedRecords.filter((r) => r.machine === a.id));
        const rb = lastMount(rangedRecords.filter((r) => r.machine === b.id));
        const da = ra?.date ?? "";
        const db = rb?.date ?? "";
        if (da !== db) return db.localeCompare(da);
        return b.molds.length - a.molds.length;
      });
  }, [dataset, machineQuery, dateRange, rangedRecords]);

  const activeMold =
    dataset.molds.find((m) => m.canonical === selectedMold) ??
    (moldQuery ? moldResults[0] : undefined);

  const activeMachine =
    dataset.machines.find((m) => m.id === selectedMachine) ??
    (machineQuery ? machineResults[0] : undefined);

  const activeMoldRows = activeMold
    ? filterRecords(recordsForMold(dataset, activeMold.canonical), start)
    : [];
  const similar =
    moldQuery && moldResults.length === 0
      ? similarMoldIds(moldQuery, dataset.molds)
      : [];
  const existsOutsideRange =
    Boolean(moldQuery) &&
    moldResults.length === 0 &&
    dataset.molds.some((m) => moldMatches(m, moldQuery));

  function pickMold(id: string) {
    setSelectedMold(id);
    setMoldQuery(id);
    setTab("mold");
  }

  function pickMachine(id: string) {
    setSelectedMachine(id);
    setMachineQuery(id);
    setTab("machine");
  }

  const multi = moldResults.filter((m) => m.machines.length > 1);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <header className="space-y-3">
        <p className="text-sm font-medium tracking-wide text-amber-800">
          注塑车间 · 转模记录对照
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          用模具号找对应过的机台
        </h1>
        <p className="max-w-3xl text-muted-foreground">
          已纳入 {dataset.meta.sourceFiles.length} 份转模表
          {dataset.meta.period ? `，覆盖 ${dataset.meta.period}` : ""}
          。
          {dataset.meta.storage?.mode === "cloud"
            ? "数据在云端，关电脑也能查，导入不会丢。"
            : dataset.meta.storage?.mode === "server"
              ? "数据写在这台一直开着的服务器上，车间电脑关机也能查。"
              : "当前写在本机。要关电脑也能用，请按说明部署到云端或一台一直开机的服务器。"}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="转模记录" value={String(dataset.meta.recordCount)} />
        <Stat label="模具编号" value={String(dataset.meta.moldCount)} />
        <Stat label="出现过的机台" value={String(dataset.meta.machineCount)} />
        <Stat
          label="上过两台及以上"
          value={String(dataset.stats.moldsOnMultipleMachines)}
        />
      </div>

    <DatasetContext.Provider value={dataset}>
      <Tabs
        value={tab}
        onValueChange={(value) => setTab(String(value))}
        className="gap-4"
      >
        <TabsList variant="line" className="h-auto w-full flex-wrap justify-start">
          <TabsTrigger value="mold">查模具</TabsTrigger>
          <TabsTrigger value="machine">查机台</TabsTrigger>
          <TabsTrigger value="import">导入新表</TabsTrigger>
          <TabsTrigger value="rules">已确认规则</TabsTrigger>
        </TabsList>

        <TabsContent value="mold" className="space-y-4">
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={moldQuery}
                onChange={(e) => {
                  setMoldQuery(e.target.value);
                  setSelectedMold(null);
                }}
                placeholder="输入模具号，例如 S240122、S250137、ZDX3464"
                className="h-12 pl-10 text-lg sm:h-11"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="search"
              />
            </div>
            <DateRangeBar value={dateRange} onChange={setDateRange} />
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
            <Card className="h-fit">
              <CardHeader>
                <CardTitle>匹配结果</CardTitle>
                <CardDescription>
                  {moldQuery
                    ? `${moldResults.length} 个模具`
                    : "未输入时列出上过两台及以上的模具"}
                </CardDescription>
              </CardHeader>
              <CardContent className="max-h-[70vh] space-y-1 overflow-auto">
                {(moldQuery ? moldResults : multi).map((mold) => {
                  const latest = lastMount(
                    rangedRecords.filter((r) => r.mold.ids.includes(mold.canonical))
                  );
                  return (
                    <button
                      key={mold.canonical}
                      type="button"
                      onClick={() => pickMold(mold.canonical)}
                      className={cn(
                        "w-full rounded-lg px-2 py-2 text-left hover:bg-muted",
                        activeMold?.canonical === mold.canonical && "bg-muted"
                      )}
                    >
                      <div className="font-mono font-medium">{mold.canonical}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {latest
                          ? `${latest.machine} · ${latest.date.slice(5)}`
                          : mold.machines.map((m) => m.machine).join("、")}
                      </div>
                    </button>
                  );
                })}
                {(moldQuery ? moldResults : multi).length === 0 ? (
                  <MoldEmpty
                    hasQuery={Boolean(moldQuery)}
                    existsOutsideRange={existsOutsideRange}
                    similar={similar}
                    onPick={pickMold}
                    onShowAll={() => setDateRange("all")}
                  />
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-1">
                {activeMold ? (
                  <MoldDetail
                    mold={activeMold}
                    rows={activeMoldRows}
                    onPickMachine={pickMachine}
                    onPickMold={pickMold}
                  />
                ) : (
                  <EmptyHint />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="machine" className="space-y-4">
          <div className="space-y-3">
            <div className="relative">
              <Factory className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={machineQuery}
                onChange={(e) => {
                  setMachineQuery(e.target.value);
                  setSelectedMachine(null);
                }}
                placeholder="输入机台号，例如 D19、A10、C05"
                className="h-12 pl-10 text-lg sm:h-11"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="search"
              />
            </div>
            <DateRangeBar value={dateRange} onChange={setDateRange} />
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
            <Card className="h-fit">
              <CardHeader>
                <CardTitle>机台</CardTitle>
                <CardDescription>{machineResults.length} 台</CardDescription>
              </CardHeader>
              <CardContent className="max-h-[70vh] space-y-1 overflow-auto">
                {machineResults.map((machine) => (
                  <button
                    key={machine.id}
                    type="button"
                    onClick={() => pickMachine(machine.id)}
                    className={cn(
                      "w-full rounded-lg px-2 py-2 text-left hover:bg-muted",
                      activeMachine?.id === machine.id && "bg-muted"
                    )}
                  >
                    <div className="font-mono font-medium">{machine.id}</div>
                    <div className="text-xs text-muted-foreground">
                      {machine.molds.length} 套模具
                    </div>
                  </button>
                ))}
                {machineResults.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {machineQuery
                      ? dateRange === "all"
                        ? "纳入的表里没有这个机台号。"
                        : "当前时间范围内没有这台机。可改选「全部」。"
                      : "当前筛选下没有机台。"}
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-4 pt-1">
                {activeMachine ? (
                  <MachineDetail
                    machineId={activeMachine.id}
                    molds={activeMachine.molds}
                    rows={filterRecords(
                      recordsForMachine(dataset, activeMachine.id),
                      start
                    )}
                    onPickMold={pickMold}
                    onPickMachine={pickMachine}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    选择左侧机台，查看纳入的表里和它对上过的模具号。
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="import">
          <ImportPanel dataset={dataset} onDataset={setDataset} />
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>怎么读这张表</CardTitle>
              <CardDescription>
                必要信息只有机台编号和模具编号。其余列作备注。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <ol className="list-decimal space-y-2 pl-5">
                {dataset.parsingRules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ol>
              <Separator />
              <div className="flex items-start gap-2 text-muted-foreground">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                <p>
                  前模、后模合起来才是一套完整模具。记录里单独下后模再上，是半边维修或保养，不是另一套模。
                </p>
              </div>
            </CardContent>
          </Card>

          {dataset.questions.map((q) => (
            <Card key={q.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">已确认</Badge>
                  <span className="font-mono text-xs text-muted-foreground">
                    {q.id}
                  </span>
                </div>
                <CardTitle className="text-base">{q.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {q.answer}
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </DatasetContext.Provider>
    </div>
  );
}

function MachineDetail({
  machineId,
  molds,
  rows,
  onPickMold,
  onPickMachine,
}: {
  machineId: string;
  molds: string[];
  rows: RecordRow[];
  onPickMold: (id: string) => void;
  onPickMachine: (id: string) => void;
}) {
  const moldIds = [
    ...new Set(rows.flatMap((r) => r.mold.ids).filter(Boolean)),
  ];
  const shownMolds = moldIds.length ? moldIds : molds;
  const latest = lastMount(rows);
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-mono text-2xl font-semibold">{machineId}</h2>
          <p className="text-sm text-muted-foreground">
            当前范围内对上过 {shownMolds.length} 个模具号
          </p>
          {latest ? (
            <p className="mt-1 text-sm text-muted-foreground">
              最近记录 {latest.date} {latest.shift} ·{" "}
              {latest.mold.ids.join("/") || "缺号"}
            </p>
          ) : null}
        </div>
        <CopyButton text={shownMolds.join("、")} label="复制模具号" />
      </div>
      <div className="flex flex-wrap gap-2">
        {shownMolds.map((id) => (
          <Button
            key={id}
            variant="secondary"
            size="sm"
            className="font-mono"
            onClick={() => onPickMold(id)}
          >
            {id}
          </Button>
        ))}
      </div>
      <RecordTable
        rows={rows}
        onPickMachine={onPickMachine}
        onPickMold={onPickMold}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card px-3 py-3">
      <div className="text-2xl font-semibold tracking-tight">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function MoldEmpty({
  hasQuery,
  existsOutsideRange,
  similar,
  onPick,
  onShowAll,
}: {
  hasQuery: boolean;
  existsOutsideRange: boolean;
  similar: string[];
  onPick: (id: string) => void;
  onShowAll: () => void;
}) {
  if (!hasQuery) {
    return (
      <p className="text-sm text-muted-foreground">
        当前筛选下没有模具上过两台及以上。可改选「全部」，或直接输入模具号。
      </p>
    );
  }
  return (
    <div className="space-y-2 text-sm text-muted-foreground">
      <p>
        {existsOutsideRange
          ? "这个编号在表里有，但不在当前时间范围内。"
          : "纳入的表里没有这个编号。可能还没导入那个月，或写法不同。"}
      </p>
      {existsOutsideRange ? (
        <button type="button" className="underline" onClick={onShowAll}>
          改为查看全部日期
        </button>
      ) : null}
      {similar.length ? (
        <p>
          相近编号：
          {similar.map((id) => (
            <button
              key={id}
              type="button"
              className="mr-2 font-mono underline-offset-4 hover:underline"
              onClick={() => onPick(id)}
            >
              {id}
            </button>
          ))}
        </p>
      ) : null}
    </div>
  );
}

function EmptyHint() {
  return (
    <div className="space-y-3 py-6 text-sm text-muted-foreground">
      <p>从左边点一个模具号，或在搜索框输入编号。</p>
      <p>
        例：<span className="font-mono text-foreground">S240122</span> → D19；
        <span className="font-mono text-foreground"> S250188</span> → B09、D03；
        <span className="font-mono text-foreground"> S250137</span> → C09、C12。
      </p>
    </div>
  );
}
