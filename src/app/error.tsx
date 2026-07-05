"use client";

import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <div className="max-w-lg rounded-lg border border-border bg-card p-6">
        <h1 className="text-lg font-semibold">NetScope could not render this view</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <Button className="mt-4" onClick={reset}>Try again</Button>
      </div>
    </main>
  );
}
