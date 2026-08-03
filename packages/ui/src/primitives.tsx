import type { ButtonHTMLAttributes, CSSProperties, HTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: 'default' | 'highlight' | 'subtle';
}

export function Card({ className, tone = 'default', ...props }: CardProps) {
  return (
    <div
      className={cn(
        'min-w-0 rounded-[1.35rem] border shadow-[0_24px_80px_-48px_rgba(0,0,0,0.9)] backdrop-blur-sm',
        tone === 'default' && 'border-white/8 bg-[#111719]/88',
        tone === 'highlight' &&
          'border-[#6cf7e8]/20 bg-[linear-gradient(145deg,rgba(20,41,41,.96),rgba(15,22,24,.92))]',
        tone === 'subtle' && 'border-white/6 bg-white/[0.025]',
        className,
      )}
      {...props}
    />
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export function buttonStyles({
  className,
  size = 'md',
  variant = 'primary',
}: Pick<ButtonProps, 'className' | 'size' | 'variant'> = {}): string {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-full border font-semibold tracking-[-0.01em] transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#67f5e4] focus-visible:ring-offset-2 focus-visible:ring-offset-[#080c0d] disabled:cursor-not-allowed disabled:opacity-40',
    size === 'sm' && 'min-h-11 px-3.5 text-xs',
    size === 'md' && 'min-h-11 px-5 text-sm',
    size === 'lg' && 'min-h-12 px-6 text-[0.95rem]',
    variant === 'primary' &&
      'border-[#75f7e7]/70 bg-[#75f7e7] text-[#07100f] shadow-[0_14px_40px_-18px_rgba(117,247,231,.85)] hover:bg-[#9bfff2]',
    variant === 'secondary' &&
      'border-white/12 bg-white/[0.055] text-white hover:border-white/25 hover:bg-white/[0.09]',
    variant === 'quiet' && 'border-transparent bg-transparent text-[#aab8b8] hover:bg-white/[0.05] hover:text-white',
    variant === 'danger' && 'border-[#ff729f]/30 bg-[#ff729f]/10 text-[#ff9fbd] hover:bg-[#ff729f]/16',
    className,
  );
}

export function Button({ className, size = 'md', variant = 'primary', type = 'button', ...props }: ButtonProps) {
  return <button className={buttonStyles({ className, size, variant })} type={type} {...props} />;
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: 'neutral' | 'positive' | 'warning' | 'info' | 'pink';
}

export function Badge({ className, tone = 'neutral', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex min-h-6 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.12em]',
        tone === 'neutral' && 'border-white/10 bg-white/[0.045] text-[#aab8b8]',
        tone === 'positive' && 'border-[#67f5e4]/20 bg-[#67f5e4]/9 text-[#8efff1]',
        tone === 'warning' && 'border-[#f4c56a]/20 bg-[#f4c56a]/9 text-[#f6d58f]',
        tone === 'info' && 'border-[#85aaff]/20 bg-[#85aaff]/9 text-[#a9c1ff]',
        tone === 'pink' && 'border-[#ff6ca3]/20 bg-[#ff6ca3]/9 text-[#ff9fc3]',
        className,
      )}
      {...props}
    />
  );
}

export interface StatCardProps {
  label: string;
  value: string;
  detail?: string;
  trend?: string;
  trendTone?: 'positive' | 'negative' | 'neutral';
  className?: string;
}

export function StatCard({ className, detail, label, trend, trendTone = 'neutral', value }: StatCardProps) {
  return (
    <Card className={cn('min-w-0 p-4 sm:p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.69rem] font-bold uppercase tracking-[0.14em] text-[#718080]">{label}</p>
        {trend ? (
          <span
            className={cn(
              'text-xs font-semibold tabular-nums',
              trendTone === 'positive' && 'text-[#71f7e7]',
              trendTone === 'negative' && 'text-[#ff87ad]',
              trendTone === 'neutral' && 'text-[#aab8b8]',
            )}
          >
            {trend}
          </span>
        ) : null}
      </div>
      <p
        data-slot="stat-card-value"
        className="mt-3 break-words text-[1.45rem] font-semibold leading-tight tracking-[-0.045em] text-[#f4f8f7] tabular-nums sm:text-[1.7rem]"
      >
        {value}
      </p>
      {detail ? <p className="mt-1.5 text-xs leading-5 text-[#798989]">{detail}</p> : null}
    </Card>
  );
}

function bpsToPercentage(valueBps: bigint): string {
  const clamped = valueBps < 0n ? 0n : valueBps > 10_000n ? 10_000n : valueBps;
  const whole = clamped / 100n;
  const fraction = (clamped % 100n).toString().padStart(2, '0').replace(/0+$/, '');
  return fraction.length > 0 ? `${whole.toString()}.${fraction}%` : `${whole.toString()}%`;
}

export interface ProgressBarProps {
  label?: string;
  valueBps: bigint;
  color?: string;
  className?: string;
}

export function ProgressBar({ className, color = '#67f5e4', label, valueBps }: ProgressBarProps) {
  return (
    <div className={className}>
      {label ? (
        <div className="mb-2 flex items-center justify-between gap-4 text-xs text-[#91a0a0]">
          <span>{label}</span>
          <span className="font-semibold text-[#dce5e3] tabular-nums">{bpsToPercentage(valueBps)}</span>
        </div>
      ) : null}
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.065]">
        <div
          aria-hidden="true"
          className="h-full rounded-full transition-[width] duration-500"
          style={{ backgroundColor: color, width: bpsToPercentage(valueBps) }}
        />
      </div>
    </div>
  );
}

export interface Segment {
  color: string;
  id?: string;
  label: string;
  valueBps: bigint;
}

export function SegmentedBar({ className, segments }: { className?: string; segments: readonly Segment[] }) {
  const accessibleSummary = segments
    .map((segment) => `${segment.label} ${bpsToPercentage(segment.valueBps)}`)
    .join(', ');
  return (
    <div
      aria-label={accessibleSummary}
      className={cn('flex h-2.5 w-full overflow-hidden rounded-full bg-white/[0.05]', className)}
      role="img"
    >
      {segments.map((segment) => (
        <span
          key={segment.id ?? segment.label}
          aria-hidden="true"
          className="h-full min-w-px first:rounded-l-full last:rounded-r-full"
          style={{ backgroundColor: segment.color, width: bpsToPercentage(segment.valueBps) }}
          title={`${segment.label} ${bpsToPercentage(segment.valueBps)}`}
        />
      ))}
    </div>
  );
}

export interface TokenMarkProps {
  symbol: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function TokenMark({ color = '#67f5e4', size = 'md', symbol }: TokenMarkProps) {
  const style = { '--token-color': color } as CSSProperties;
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full border border-white/10 bg-[color-mix(in_srgb,var(--token-color)_15%,#101718)] font-bold tracking-[-0.04em] text-[var(--token-color)] shadow-[inset_0_1px_0_rgba(255,255,255,.08)]',
        size === 'sm' && 'h-7 w-7 text-[0.58rem]',
        size === 'md' && 'h-9 w-9 text-[0.67rem]',
        size === 'lg' && 'h-12 w-12 text-xs',
      )}
      style={style}
    >
      {symbol.slice(0, 4)}
    </span>
  );
}

export interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function SectionHeading({ action, className, description, eyebrow, title }: SectionHeadingProps) {
  return (
    <div className={cn('flex flex-col justify-between gap-4 sm:flex-row sm:items-end', className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-2 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-[#6debdc]">{eyebrow}</p>
        ) : null}
        <h2 className="text-xl font-semibold tracking-[-0.04em] text-[#f3f7f6] sm:text-2xl">{title}</h2>
        {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-[#849393]">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export interface NoticeProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  tone?: 'info' | 'warning' | 'positive';
}

export function Notice({ children, className, title, tone = 'info', ...props }: NoticeProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border px-4 py-3.5',
        tone === 'info' && 'border-[#75a7ff]/16 bg-[#75a7ff]/6',
        tone === 'warning' && 'border-[#f2c56b]/18 bg-[#f2c56b]/6',
        tone === 'positive' && 'border-[#67f5e4]/16 bg-[#67f5e4]/6',
        className,
      )}
      {...props}
    >
      <p className="text-xs font-bold uppercase tracking-[0.13em] text-[#dce8e6]">{title}</p>
      <div className="mt-1.5 text-xs leading-5 text-[#91a0a0]">{children}</div>
    </div>
  );
}

export function SkeletonBlock({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('animate-pulse rounded-2xl bg-white/[0.055]', className)} />;
}

export function Field({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-12 w-full rounded-xl border border-white/10 bg-[#0b1112] px-4 text-base font-semibold text-white outline-none transition placeholder:text-[#536060] focus:border-[#67f5e4]/55 focus:ring-2 focus:ring-[#67f5e4]/10',
        className,
      )}
      {...props}
    />
  );
}

export function TableShell({
  children,
  className,
  label = 'Scrollable data table',
}: {
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <div
      aria-label={label}
      className={cn('overflow-x-auto rounded-2xl border border-white/7', className)}
      role="region"
      tabIndex={0}
    >
      {children}
    </div>
  );
}
