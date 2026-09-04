import { APP_NAME } from "@/lib/constants";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8">
      <div className="flex flex-col items-center gap-6 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-[var(--color-foreground)]">
          {APP_NAME}
        </h1>
        <p className="text-lg text-[var(--color-muted-foreground)]">
          POS/ERP pour cafes et restaurants
        </p>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Phase 01 — Initialisation terminee
        </p>
      </div>
    </div>
  );
}
