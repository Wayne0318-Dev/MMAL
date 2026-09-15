import { NextResponse } from "next/server";
import { removeSource } from "@/lib/store";

export const runtime = "nodejs";

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const filename = url.searchParams.get("filename");
    if (!filename) {
      return NextResponse.json({ error: "缺少文件名" }, { status: 400 });
    }
    const result = await removeSource(filename);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
