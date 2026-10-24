export default function Loading() {
  return (
    <div className="max-w-6xl animate-pulse" aria-busy="true" aria-label="Duke u ngarkuar">
      <div className="h-8 w-48 rounded-lg bg-line" />
      <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-[var(--radius-panel)] bg-white border border-line" />)}
      </div>
      <div className="mt-6 grid lg:grid-cols-2 gap-5">
        {[0, 1].map((i) => <div key={i} className="h-56 rounded-[var(--radius-panel)] bg-white border border-line" />)}
      </div>
    </div>
  );
}
