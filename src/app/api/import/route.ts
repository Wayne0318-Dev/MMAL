import { NextResponse } from "next/server";
import { saveUpload } from "@/lib/store";
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
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await saveUpload(file.name, buffer);
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
