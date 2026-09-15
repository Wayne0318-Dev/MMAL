"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  Factory,
  Search,
  Wrench,
} from "lucide-react";
import { dataset } from "@/lib/dataset";
import {
  flaggedMachines,
  machineMatches,
  moldMatches,
  recordsForMachine,
  recordsForMold,
  reliableMachines,
} from "@/lib/search";
import type { Confidence, MachineEdge, MoldIndex, RecordRow } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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

const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: "本行写了机台",
  inherited: "机台由上一行继承",
  action_missing: "未勾选上/下",
  mold_missing: "缺模具编号",
  conflict: "同号冲突，不可靠",
};

function ConfidenceBadge({ value }: { value: Confidence }) {
  if (value === "high") {
    return <Badge variant="secondary">{CONFIDENCE_LABEL[value]}</Badge>;
  }
  if (value === "inherited") {
    return <Badge variant="outline">{CONFIDENCE_LABEL[value]}</Badge>;
  }
  return <Badge variant="destructive">{CONFIDENCE_LABEL[value]}</Badge>;
}

function ActionBadge({ action }: { action: RecordRow["action"] }) {
  if (action === "上") {
    return <Badge className="bg-emerald-700 text-white hover:bg-emerald-700">上机</Badge>;
  }
  if (action === "下") {
    return <Badge className="bg-amber-700 text-white hover:bg-amber-700">下机</Badge>;
  }
  return <Badge variant="destructive">未勾选</Badge>;
}

function MachineButton({
  id,
  onPick,
  className,
}: {
  id: string;
  onPick: (id: string) => void;
  className?: string;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      className={cn("font-mono", className)}
      onClick={() => onPick(id)}
    >
      {id}
    </Button>
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
    return (
      <p className="text-sm text-muted-foreground">这一段没有转模记录。</p>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>日期班次</TableHead>
          <TableHead>机台</TableHead>
          <TableHead>动作</TableHead>
          <TableHead>模具</TableHead>
          <TableHead>品名</TableHead>
          <TableHead>完成时间</TableHead>
          <TableHead>备注</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <div className="whitespace-nowrap">{row.date.slice(5)}</div>
              <div className="text-muted-foreground">{row.shift}</div>
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
              {row.mold.canonical ? (
                <button
                  type="button"
                  className="text-left font-mono underline-offset-4 hover:underline"
                  onClick={() => onPickMold(row.mold.canonical!)}
                >
                  {row.mold.display}
                </button>
              ) : (
                <span className="text-destructive">缺号</span>
              )}
              {row.mold.raw && row.mold.raw !== row.mold.display ? (
                <div className="max-w-[180px] truncate text-xs text-muted-foreground">
                  原写 {row.mold.raw}
                </div>
              ) : null}
            </TableCell>
            <TableCell className="max-w-[200px] truncate whitespace-normal">
              {row.product}
            </TableCell>
            <TableCell className="font-mono text-xs">
              {row.changeTime || "—"}
            </TableCell>
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
  if (edges.length === 0) {
    return <p className="text-sm text-muted-foreground">没有这一类机台。</p>;
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
              <ConfidenceBadge value={edge.confidence} />
            </div>
            <p className="text-sm text-muted-foreground">
              上机 {edge.upCount} 次 · 下机 {edge.downCount} 次
              {edge.unknownCount ? ` · 未勾选 ${edge.unknownCount} 次` : ""}
              {edge.variants.filter((v) => v !== "未标注").length
                ? ` · ${edge.variants.filter((v) => v !== "未标注").join("、")}`
                : ""}
            </p>
            <p className="text-sm">{edge.products.join(" / ")}</p>
          </div>
          <div className="text-xs text-muted-foreground sm:text-right">
            {edge.dates.map((d) => d.slice(5)).join("、")}
          </div>
        </div>
      ))}
    </div>
  );
}

function MoldDetail({
  mold,
  onPickMachine,
  onPickMold,
}: {
  mold: MoldIndex;
  onPickMachine: (id: string) => void;
  onPickMold: (id: string) => void;
}) {
  const rows = recordsForMold(dataset, mold.canonical);
  const reliable = reliableMachines(mold);
  const flagged = flaggedMachines(mold);

  return (
    <div className="space-y-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-mono text-2xl font-semibold tracking-tight">
            {mold.canonical === "MISSING" ? "缺模具编号" : mold.canonical}
          </h2>
          {mold.isTrialOnly ? <Badge variant="outline">仅出现在试模</Badge> : null}
          {mold.hasTrialAndNamed ? (
            <Badge variant="secondary">试模后已有正式品名</Badge>
          ) : null}
          {mold.suspectedTypo ? (
            <Badge variant="destructive">疑似写错</Badge>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          表里的写法：{mold.rawForms.join("、") || "（空）"}
        </p>
        <p className="mt-1 text-sm">{mold.products.join(" / ")}</p>
      </div>

      {mold.suspectedTypo ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>没有自动改号</AlertTitle>
          <AlertDescription>
            {mold.suspectedTypo.reason}
            {mold.suspectedTypo.guess ? ` 猜测：${mold.suspectedTypo.guess}` : ""}
          </AlertDescription>
        </Alert>
      ) : null}

      {mold.canonical === "S250188" ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>同一晚两个产品、两台机器</AlertTitle>
          <AlertDescription>
            D03 的 LOG Lanky左右上盖 有后续记录支撑；B09 的 PB120转接板防火罩
            只有这一刀，且模具号撞车。B09 不计入可靠适配。
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <h3 className="text-sm font-medium">历史装过的机台</h3>
        <MachineEdgeList edges={reliable} onPick={onPickMachine} />
      </div>

      {flagged.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">先不要当适配依据</h3>
          <MachineEdgeList edges={flagged} onPick={onPickMachine} />
        </div>
      ) : null}

      <div className="space-y-2">
        <h3 className="text-sm font-medium">原始转模记录</h3>
        <RecordTable
          rows={rows}
          onPickMachine={onPickMachine}
          onPickMold={onPickMold}
        />
      </div>
    </div>
  );
}

export function LookupApp() {
  const [tab, setTab] = useState("mold");
  const [moldQuery, setMoldQuery] = useState("");
  const [machineQuery, setMachineQuery] = useState("");
  const [selectedMold, setSelectedMold] = useState<string | null>(null);
  const [selectedMachine, setSelectedMachine] = useState<string | null>(null);

  const moldResults = useMemo(() => {
    return dataset.molds
      .filter((m) => moldMatches(m, moldQuery))
      .sort((a, b) => {
        if (a.canonical === "MISSING") return 1;
        if (b.canonical === "MISSING") return -1;
        return b.machines.length - a.machines.length || a.canonical.localeCompare(b.canonical);
      });
  }, [moldQuery]);

  const machineResults = useMemo(() => {
    return dataset.machines.filter((m) => machineMatches(m, machineQuery));
  }, [machineQuery]);

  const activeMold =
    dataset.molds.find((m) => m.canonical === selectedMold) ??
    (moldQuery ? moldResults[0] : undefined);

  const activeMachine =
    dataset.machines.find((m) => m.id === selectedMachine) ??
    (machineQuery ? machineResults[0] : undefined);

  function pickMold(id: string) {
    setSelectedMold(id);
    setMoldQuery(id === "MISSING" ? "" : id);
    setTab("mold");
  }

  function pickMachine(id: string) {
    setSelectedMachine(id);
    setMachineQuery(id);
    setTab("machine");
  }

  const multi = dataset.molds.filter(
    (m) => m.canonical !== "MISSING" && m.machines.length > 1
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <header className="space-y-3">
        <p className="text-sm font-medium tracking-wide text-amber-800">
          注塑车间 · 转模记录对照
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          用模具号找装过的机台
        </h1>
        <p className="max-w-3xl text-muted-foreground">
          数据来自《转模记录9月份.xlsx》2026 年 9 月 1 日至 14
          日，共 {dataset.meta.recordCount} 条装卸记录、
          {dataset.meta.moldCount} 个模具主编号、{dataset.meta.machineCount}{" "}
          台机台。这是历史装机事实，还不是规格书上的完整适配清单。
        </p>
      </header>

      <Alert>
        <CircleHelp />
        <AlertTitle>有 14 处需要你拍板，我没有擅自合并</AlertTitle>
        <AlertDescription>
          编号疑点、空白机台继承、前模/后模含义都单独列在「待确认」。你纠正任何一条，我再改关系表。
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="转模记录" value={String(dataset.meta.recordCount)} />
        <Stat label="模具主编号" value={String(dataset.meta.moldCount)} />
        <Stat label="出现过的机台" value={String(dataset.meta.machineCount)} />
        <Stat
          label="上过两台及以上"
          value={String(dataset.stats.moldsOnMultipleMachines)}
        />
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(String(value))} className="gap-4">
        <TabsList variant="line" className="h-auto w-full flex-wrap justify-start">
          <TabsTrigger value="mold">查模具</TabsTrigger>
          <TabsTrigger value="machine">查机台</TabsTrigger>
          <TabsTrigger value="questions">
            待确认
            <Badge variant="destructive" className="ml-1">
              {dataset.questions.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="rules">怎么读这张表</TabsTrigger>
        </TabsList>

        <TabsContent value="mold" className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
            <Input
              value={moldQuery}
              onChange={(e) => {
                setMoldQuery(e.target.value);
                setSelectedMold(null);
              }}
              placeholder="输入模具号或品名，例如 S240122、Charge6、WY01"
              className="h-10 pl-8 text-base"
            />
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
                {(moldQuery ? moldResults : multi).map((mold) => (
                  <button
                    key={mold.canonical}
                    type="button"
                    onClick={() => pickMold(mold.canonical)}
                    className={cn(
                      "w-full rounded-lg px-2 py-2 text-left hover:bg-muted",
                      activeMold?.canonical === mold.canonical && "bg-muted"
                    )}
                  >
                    <div className="font-mono font-medium">
                      {mold.canonical === "MISSING" ? "缺号" : mold.canonical}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {mold.machines.map((m) => m.machine).join("、")} ·{" "}
                      {mold.products[0]}
                    </div>
                  </button>
                ))}
                {(moldQuery ? moldResults : multi).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    没有匹配的模具。编号不会自动纠错，可以试试不带前/后、或不带 S。
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-1">
                {activeMold ? (
                  <MoldDetail
                    mold={activeMold}
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
          <div className="relative">
            <Factory className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
            <Input
              value={machineQuery}
              onChange={(e) => {
                setMachineQuery(e.target.value);
                setSelectedMachine(null);
              }}
              placeholder="输入机台号或字母段，例如 D19、C、A10"
              className="h-10 pl-8 text-base"
            />
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
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-4 pt-1">
                {activeMachine ? (
                  <MachineDetail
                    machineId={activeMachine.id}
                    molds={activeMachine.molds}
                    onPickMold={pickMold}
                    onPickMachine={pickMachine}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    选择左侧机台，查看这 14 天里在它上面装卸过的模具。
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="questions" className="space-y-3">
          {dataset.questions.map((q) => (
            <Card key={q.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={
                      q.severity === "rule"
                        ? "default"
                        : q.severity === "scope"
                          ? "secondary"
                          : "destructive"
                    }
                  >
                    {q.severity === "rule"
                      ? "读表规则"
                      : q.severity === "scope"
                        ? "适配范围"
                        : "原始数据"}
                  </Badge>
                  <span className="font-mono text-xs text-muted-foreground">
                    {q.id}
                  </span>
                </div>
                <CardTitle className="text-base">{q.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>
                  <span className="font-medium">我现在的理解：</span>
                  {q.assumption}
                </p>
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">请你确认：</span>
                  {q.need}
                </p>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="rules">
          <Card>
            <CardHeader>
              <CardTitle>这张表在记什么</CardTitle>
              <CardDescription>
                不是模具台账，是每天各班把哪副模从哪台机器拆下、装上。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <ol className="list-decimal space-y-2 pl-5">
                {dataset.parsingRules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ol>
              <Separator />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <div className="mb-1 flex items-center gap-2 font-medium">
                    <CheckCircle2 className="size-4" />
                    标准转模
                  </div>
                  <p className="text-muted-foreground">
                    同一机台连续两行：先下旧模，再上新模，时间首尾相接。210
                    次作业里有 129 次是这种两行一组。
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="mb-1 flex items-center gap-2 font-medium">
                    <Wrench className="size-4" />
                    只上或只下
                  </div>
                  <p className="text-muted-foreground">
                    76 次作业只有一行。可能机台原本空着，或对班没有把另一半写上。模具仍算在这台机器上出现过。
                  </p>
                </div>
              </div>
              <p className="text-muted-foreground">
                9 月 1–5 日先记 B 班再记 A 班，6 日起反过来。A/B
                是班组名，白天夜间会轮换，不影响模具和机台的对应。
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MachineDetail({
  machineId,
  molds,
  onPickMold,
  onPickMachine,
}: {
  machineId: string;
  molds: string[];
  onPickMold: (id: string) => void;
  onPickMachine: (id: string) => void;
}) {
  const rows = recordsForMachine(dataset, machineId);
  const machine = dataset.machines.find((m) => m.id === machineId);
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-mono text-2xl font-semibold">{machineId}</h2>
        <p className="text-sm text-muted-foreground">
          {machine?.series} 组 · 这 14 天装卸过 {molds.length} 套模具
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {molds.map((id) => (
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

function EmptyHint() {
  return (
    <div className="space-y-3 py-6 text-sm text-muted-foreground">
      <p>从左边点一套模具，或在搜索框输入编号。</p>
      <p>
        例：输入 <span className="font-mono text-foreground">S240122</span>{" "}
        会看到 Charge6箱体 在这 14 天里只上过 D19；
        <span className="font-mono text-foreground"> S260058</span> 上过 A03 和
        B07。
      </p>
    </div>
  );
}
