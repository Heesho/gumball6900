import Image from 'next/image';
import Link from 'next/link';

export function Brand() {
  return (
    <Link
      aria-label="GUM BALL 6900 home"
      className="group inline-flex items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#67f5e4] sm:gap-3"
      href="/"
    >
      <span className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full border border-[#24bdf3]/45 bg-[#0b0d0e] shadow-[0_0_24px_-8px_rgba(255,28,142,.8)]">
        <Image
          alt=""
          aria-hidden="true"
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]"
          height={48}
          sizes="44px"
          src="/brand/gum-ball-6900-logo.png"
          width={48}
        />
      </span>
      <span>
        <span className="block text-[0.91rem] font-extrabold leading-none tracking-[-0.045em] text-white">
          GUM BALL
        </span>
        <span className="mt-1 block text-[0.65rem] font-bold leading-none tracking-[0.24em] text-[#6ff4e4]">6900</span>
        <span className="mt-1 hidden text-[0.48rem] font-semibold uppercase tracking-[0.12em] text-[#657373] min-[360px]:block">
          Oracleless basket
        </span>
      </span>
    </Link>
  );
}
