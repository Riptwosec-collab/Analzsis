import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <div className="max-w-lg rounded-lg border border-border bg-card p-6 text-center">
        <h1 className="text-lg font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">Open the dashboard or CLI Import to continue.</p>
        <Button asChild className="mt-4"><Link href="/">Go to Overview</Link></Button>
      </div>
    </main>
  );
}
