import {
  Badge,
  Button,
  Card,
  Field,
  Notice,
  ProgressBar,
  SectionHeading,
  SegmentedBar,
  SkeletonBlock,
  StatCard,
  TokenMark,
} from '@gumball-6900/ui';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
  component: Card,
  parameters: { layout: 'fullscreen' },
  title: 'Design system/Protocol primitives',
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ReferenceSheet: Story = {
  render: () => (
    <div className="space-y-8">
      <SectionHeading
        description="The shared states used across mining, signaling, rewards, redemption, and liquidity operations."
        eyebrow="GUM BALL 6900"
        title="Protocol UI primitives"
      />

      <Card className="space-y-6 p-6">
        <div className="flex flex-wrap gap-3">
          <Button>Primary action</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="quiet">Quiet</Button>
          <Button variant="danger">Guardian action</Button>
          <Button disabled>Disabled</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge>Neutral</Badge>
          <Badge tone="positive">Active</Badge>
          <Badge tone="warning">Halted</Badge>
          <Badge tone="info">Pending</Badge>
          <Badge tone="pink">Burn</Badge>
        </div>
        <Field aria-label="USDG amount" inputMode="decimal" placeholder="0.00 USDG" />
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard detail="Cumulative protocol issuance" label="GBX supply" trend="cap enforced" value="125.4M" />
        <StatCard
          detail="Activates after the 24-hour delay"
          label="Pending signal"
          trend="+8.2%"
          trendTone="positive"
          value="NVDA 22%"
        />
        <StatCard detail="Raw assets leave pro rata" label="Redeem preview" value="12 assets" />
      </div>

      <Card className="space-y-5 p-6" tone="highlight">
        <div className="flex items-center gap-3">
          <TokenMark color="#67f5e4" symbol="GBX" />
          <TokenMark color="#ff6ca3" symbol="AAPL" />
          <TokenMark color="#8ba8ff" symbol="NVDA" />
        </div>
        <ProgressBar color="#67f5e4" label="Epoch progress" valueBps={6_900n} />
        <SegmentedBar
          segments={[
            { color: '#67f5e4', label: 'WETH', valueBps: 4_200n },
            { color: '#ff6ca3', label: 'AAPL', valueBps: 3_300n },
            { color: '#8ba8ff', label: 'NVDA', valueBps: 2_500n },
          ]}
        />
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Notice title="Display estimate">REST prices never enter protocol accounting or transaction calldata.</Notice>
        <Notice title="Trading halted" tone="warning">
          The official metadata service reports an active halt. Raw vault accounting remains unchanged.
        </Notice>
        <Notice title="Receipt confirmed" tone="positive">
          The simulated transaction was mined successfully.
        </Notice>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SkeletonBlock className="h-24" />
        <SkeletonBlock className="h-24" />
        <SkeletonBlock className="h-24" />
      </div>
    </div>
  ),
};
