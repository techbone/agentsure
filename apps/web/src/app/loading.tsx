export default function Loading() {
  return (
    <main className="grid min-h-screen place-items-center bg-ink text-paper">
      <div className="text-center">
        <div className="mx-auto size-8 animate-pulse border border-lime p-2">
          <div className="size-full bg-lime" />
        </div>
        <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.2em] text-paper/45">
          Loading protection surface
        </p>
      </div>
    </main>
  );
}
