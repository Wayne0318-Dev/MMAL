import { LookupApp } from "@/components/lookup-app";
import { readDataset } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Home() {
  const dataset = await readDataset();
  return (
    <main className="min-h-full">
      <LookupApp initialDataset={dataset} />
    </main>
  );
}
