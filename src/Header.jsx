export default function Header() {
  return (
    <header className="mx-auto max-w-3xl py-6 text-center sm:py-10">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.35em] text-amber-900/70">
        Daily good news
      </p>
      <h1
        className="text-balance text-4xl font-bold leading-tight text-slate-950 sm:text-5xl lg:text-6xl"
        style={{ fontFamily: "var(--font-display)" }}
      >
        How about a little good news today?
      </h1>
      <p className="mx-auto mt-4 max-w-2xl text-pretty text-sm leading-7 text-slate-700 sm:text-base">
        A curated feed of upbeat stories with a calm reading flow.
      </p>
    </header>
  );
}
