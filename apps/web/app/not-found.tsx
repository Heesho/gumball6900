import Link from 'next/link';

export default function NotFound() {
  return (
    <section className="mx-auto max-w-2xl rounded-2xl border border-white/8 bg-[#111719] p-7 text-center">
      <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-[#67f5e4]">404</p>
      <h1 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">That protocol view does not exist</h1>
      <p className="mt-3 text-sm text-[#849393]">No contract action was attempted.</p>
      <Link className="mt-6 inline-flex rounded-lg bg-[#67f5e4] px-4 py-2 text-sm font-bold text-[#07100f]" href="/">
        Return home
      </Link>
    </section>
  );
}
