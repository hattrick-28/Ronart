import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen grid place-items-center bg-milk px-6">
      <div className="max-w-sm text-center">
        <p className="font-display text-6xl font-semibold text-wall-deep">404</p>
        <h1 className="mt-3 font-display text-2xl font-semibold">Faqja nuk u gjet</h1>
        <p className="mt-2 text-ink-2">Lidhja mund të jetë e vjetër ose e gabuar. / This page doesn&apos;t exist.</p>
        <Link href="/" className="btn btn-primary mt-6">Kthehu në faqen kryesore</Link>
      </div>
    </main>
  );
}
