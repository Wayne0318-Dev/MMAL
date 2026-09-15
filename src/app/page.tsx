import { LookupApp } from "@/components/lookup-app";
import { readDataset } from "@/lib/store";

export default async function Home() {
  const dataset = await readDataset();
  return (
    <main className="min-h-full">
      <LookupApp initialDataset={dataset} />
    </main>
  );
}
