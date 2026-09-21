export function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      <span className="relative grid size-8 place-items-center border border-lime">
        <span className="size-2 bg-lime" />
        <span className="absolute -right-1 -bottom-1 size-2 border-r border-b border-lime" />
      </span>
      <span className="font-display text-lg font-semibold tracking-[-0.04em]">AgentSure</span>
    </div>
  );
}
