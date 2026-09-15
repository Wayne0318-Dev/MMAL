import { NextResponse } from "next/server";
import { buildImportPreview } from "@/lib/import-preview";
import { parseWorkbookBuffer } from "@/lib/parse-workbook";
import { readDataset, saveUpload } from "@/lib/store";
import { safeXlsxName } from "@/lib/storage-types";
import { assertWriteAccess } from "@/lib/write-guard";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    assertWriteAccess(request, form);
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "请选择一份 .xlsx 转模记录表。" }, { status: 400 });
    }
    const filename = safeXlsxName(file.name);
    const buffer = Buffer.from(await file.arrayBuffer());
    const previewOnly =
      form.get("preview") === "1" || form.get("preview") === "true";

    if (previewOnly) {
      const parsed = await parseWorkbookBuffer(buffer, filename);
      if (!parsed.records.length) {
        return NextResponse.json(
          {
            error: "没有读到转模行。请确认表头仍是「机台 / 机种品名 / 模具编号」。",
            warnings: parsed.warnings,
          },
          { status: 400 }
        );
      }
      const current = await readDataset();
      return NextResponse.json({
        preview: buildImportPreview(parsed, current),
      });
    }

    const result = await saveUpload(filename, buffer);
    if (result.dataset.meta.recordCount === 0) {
      return NextResponse.json(
        {
          error: "文件已保存，但没有读到转模行。请确认表头仍是「机台 / 机种品名 / 模具编号」。",
          warnings: result.warnings,
        },
        { status: 400 }
      );
    }
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "导入失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
