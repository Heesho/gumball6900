import { Badge, Card, Notice, ProgressBar, TokenMark } from '@gumball-6900/ui';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
  component: Notice,
  title: 'Protocol/Financial states',
} satisfies Meta<typeof Notice>;

export default meta;
type Story = StoryObj<typeof meta>;

export const StockTokenStatus: Story = {
  args: { title: 'Stock-token status' },
  render: () => (
    <Card className="max-w-xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <TokenMark color="#ff6ca3" symbol="AAPL" />
          <div>
            <p className="text-sm font-semibold text-white">AAPL</p>
            <p className="mt-1 text-xs text-[#718080]">Raw vault balance · 18 decimals</p>
          </div>
        </div>
        <Badge tone="warning">Halted</Badge>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4 text-xs">
        <div>
          <p className="text-[#718080]">Raw balance</p>
          <p className="mt-1 font-semibold text-white tabular-nums">12,450.0000</p>
        </div>
        <div>
          <p className="text-[#718080]">UI multiplier</p>
          <p className="mt-1 font-semibold text-white tabular-nums">4.000000000000000000</p>
        </div>
      </div>
      <ProgressBar className="mt-6" color="#ff6ca3" label="Active allocation signal" valueBps={1_850n} />
      <Notice className="mt-6" title="Read-only market status" tone="warning">
        Halt and corporate-action metadata are display-only. They cannot alter vault balances, redemption math, or
        contract state.
      </Notice>
    </Card>
  ),
};

export const SafeFallback: Story = {
  args: { title: 'Safe demo fallback' },
  render: () => (
    <Notice className="max-w-2xl" title="Safe demo fallback" tone="warning">
      Live configuration is incomplete. Deterministic examples remain visible, while reads and writes against unverified
      addresses stay disabled.
    </Notice>
  ),
};
