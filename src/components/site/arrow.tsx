export function Arrow({ back = false }: { back?: boolean }) {
  return (
    <svg className="s-arr" viewBox="0 0 16 10" aria-hidden="true">
      <path
        d={back ? "M16 5H2M6 1L2 5l4 4" : "M0 5h14M10 1l4 4-4 4"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Button/link inner fill used by the "light floods in" hover (see motion.tsx). */
export function Fill() {
  return <span className="s-btn__fill" aria-hidden="true" />;
}

export function Wordmark() {
  return <>Ronart</>;
}
