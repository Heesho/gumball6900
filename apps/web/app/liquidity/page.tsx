import { Badge, Button, Card, Notice, ProgressBar, SectionHeading, StatCard, TableShell } from '@gumball-6900/ui';
import type { Metadata } from 'next';

import { PageIntro, ReadModelBanner } from '../../components/page-sections';
import { DemoReadModelOnly } from '../../components/protocol/demo-read-model-only';
import { LiveLiquidityDashboard } from '../../components/protocol/live-liquidity';
import { formatBps, formatToken, formatUSDG } from '../../lib/format';
import { liquidityPool } from '../../lib/read-model';

export const metadata: Metadata = { title: 'Liquidity' };

export default function LiquidityPage() {
  return (
    <>
      <PageIntro
        aside={<Badge tone="info">Configured liquidity design</Badge>}
        description="The launch configuration is designed to seed its manifest-bound GBX / USDG Uniswap v4 pool with 20,000,000 fully backed GBX across a one-sided range ladder. Mainnet release evidence must bind the canonical pool; a remote testnet candidate may bind only its verified bespoke pool. LiquidityManager retains every position NFT; no EOA can receive principal."
        eyebrow="Uniswap v4"
        title="Protocol-owned liquidity"
      />
      <ReadModelBanner />

      <DemoReadModelOnly
        description="Current pool tick, inventory, fees, position composition, and migration state require pinned Uniswap and timelock reads."
        liveContent={<LiveLiquidityDashboard />}
        title="Liquidity state unavailable"
      >
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              detail={`Pool ${liquidityPool.poolId}`}
              label="Preview price"
              value={formatUSDG(liquidityPool.displayPriceUSDG, false, 18)}
            />
            <StatCard
              detail={`Tick ${liquidityPool.currentTick.toString()} · spacing ${liquidityPool.tickSpacing.toString()}`}
              label="Pool fee"
              value={formatBps(liquidityPool.feeBps, 2)}
            />
            <StatCard
              detail="Configured USDG fee path routes to GumBallVault"
              label="Preview USDG fees"
              value={formatToken(liquidityPool.feesUSDG, 'USDG')}
            />
            <StatCard
              detail="Configured GBX fee path performs a real burn"
              label="Preview GBX fee burn"
              value={formatToken(liquidityPool.feesGBXBurned, 'GBX')}
            />
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
            <Card className="p-5 sm:p-7">
              <SectionHeading
                action={<Badge tone="info">Configured owner: {liquidityPool.owner}</Badge>}
                description="At the genesis boundary, positions required GBX only. As GBX is purchased, completed ranges convert into USDG that can be swept only into GumBallVault or an approved replacement position."
                eyebrow="Position ladder"
                title="Configured genesis ranges"
              />
              <TableShell className="mt-6">
                <table className="financial-table">
                  <caption className="sr-only">Configured liquidity position ranges</caption>
                  <thead>
                    <tr>
                      <th>Position</th>
                      <th>Genesis allocation</th>
                      <th>Price range</th>
                      <th>Preview composition</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liquidityPool.positions.map((position) => (
                      <tr key={position.id}>
                        <td className="font-semibold text-white">{position.id}</td>
                        <td className="tabular-nums">{formatBps(position.allocationBps)}</td>
                        <td className="font-semibold text-[#d8e1df]">{position.range}</td>
                        <td>{position.composition}</td>
                        <td>
                          <Badge tone="info">Preview {position.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableShell>
              <div className="mt-6 space-y-4">
                {liquidityPool.positions.map((position) => (
                  <ProgressBar
                    key={position.id}
                    label={`${position.id} · ${position.range}`}
                    valueBps={position.allocationBps}
                  />
                ))}
              </div>
            </Card>

            <div className="space-y-5">
              <Card className="p-5 sm:p-6" tone="highlight">
                <SectionHeading eyebrow="Inventory preview" title="Configured pool composition" />
                <div className="mt-6 space-y-4">
                  <div className="rounded-2xl border border-white/7 bg-[#0b1213]/70 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-xs text-[#718080]">GBX across ranges</span>
                      <span className="text-sm font-semibold text-white tabular-nums">
                        {formatToken(liquidityPool.gbxInventory, 'GBX')}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/7 bg-[#0b1213]/70 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-xs text-[#718080]">USDG in converted ranges</span>
                      <span className="text-sm font-semibold text-white tabular-nums">
                        {formatToken(liquidityPool.usdgInventory, 'USDG')}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/[0.055]">
                  <div className="h-full w-[58%] rounded-full bg-[linear-gradient(90deg,#ff6ca3,#67f5e4)]" />
                </div>
                <div className="mt-2 flex justify-between text-[0.67rem] text-[#657373]">
                  <span>GBX inventory</span>
                  <span>Converted USDG</span>
                </div>
              </Card>

              <Card className="p-5 sm:p-6">
                <SectionHeading eyebrow="Fee routing" title="Value returns to holders" />
                <div className="mt-6 space-y-5">
                  <div className="flex gap-3">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#67f5e4]/10 text-xs font-bold text-[#67f5e4]">
                      1
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-[#dbe4e2]">Collect v4 fees</p>
                      <p className="mt-1 text-xs leading-5 text-[#718080]">
                        Permissionless collection; no arbitrary recipient.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#67f5e4]/10 text-xs font-bold text-[#67f5e4]">
                      2
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-[#dbe4e2]">USDG → GumBallVault</p>
                      <p className="mt-1 text-xs leading-5 text-[#718080]">
                        Notified to AllocationVoter as non-emission revenue.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#ff6ca3]/10 text-xs font-bold text-[#ff85b0]">
                      3
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-[#dbe4e2]">GBX → real burn</p>
                      <p className="mt-1 text-xs leading-5 text-[#718080]">
                        Reduces totalSupply; never sent to a dead address.
                      </p>
                    </div>
                  </div>
                </div>
              </Card>

              <Notice title="Migration constraints" tone="positive">
                Preview data contains no queued migration. A contract-enabled client must read the timelock before
                making that claim. Any future destination PoolKey must be precommitted through the seven-day timelock;
                removed principal can only enter GumBallVault or the replacement manifest-bound position.
              </Notice>
              <Button className="w-full" disabled variant="secondary">
                Review pool on explorer
              </Button>
            </div>
          </div>
        </>
      </DemoReadModelOnly>
    </>
  );
}
