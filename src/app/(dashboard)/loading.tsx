export default function Loading() {
  return (
    <div role="status" aria-busy="true" className="space-y-8">
      <span className="sr-only">Loading your workspace…</span>
      <div aria-hidden="true" className="space-y-3 motion-safe:animate-pulse">
        <div className="h-3 w-32 rounded bg-border" />
        <div className="h-9 w-64 max-w-full rounded-lg bg-border" />
        <div className="h-4 w-96 max-w-full rounded bg-border" />
      </div>
      <div aria-hidden="true" className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className="h-36 rounded-2xl border border-border bg-surface motion-safe:animate-pulse"
          />
        ))}
      </div>
      <div
        aria-hidden="true"
        className="h-80 rounded-2xl border border-border bg-surface motion-safe:animate-pulse"
      />
    </div>
  );
}
