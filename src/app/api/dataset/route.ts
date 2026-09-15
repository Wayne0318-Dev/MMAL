import { NextResponse } from "next/server";
import { readDataset } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const dataset = await readDataset();
  return NextResponse.json(dataset);
}
