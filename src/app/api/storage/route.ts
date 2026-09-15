import { NextResponse } from "next/server";
import { getStorageInfo } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(getStorageInfo());
}
