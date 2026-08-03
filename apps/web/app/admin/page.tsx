import { Badge, Button, Card, Notice, SectionHeading, TableShell } from '@gumball-6900/ui';
import type { Metadata } from 'next';

import { PageIntro, ReadModelBanner } from '../../components/page-sections';
import { RuntimeAdminCard } from '../../components/protocol/runtime-admin-card';
import { AdminActions } from '../../components/protocol/admin-actions';
import { DemoReadModelOnly } from '../../components/protocol/demo-read-model-only';
import { LiveAdminOperationalStatus, LiveTimelockQueue } from '../../components/protocol/live-admin-status';
import { adminOperations } from '../../lib/read-model';

export const metadata: Metadata = { title: 'Admin' };

export default function AdminPage() {
  return (
    <>
      <PageIntro
        aside={<Badge tone="warning">Role-gated view</Badge>}
        description="A constrained operations console for the EmergencyGuardian and ProtocolTimelock. It exposes only explicit maintenance functions—never arbitrary calldata, a generic contract call, or vault execution."
        eyebrow="Protocol operations"
        title="Admin control surface"
      />
      <ReadModelBanner />

      <Notice title="Wallet role required" tone="warning">
        Connect the intended guardian operator or timelock proposer. The client verifies the configured and current
        onchain role before queue or cancellation; matured timelock execution is permissionless. It never infers or
        grants authority from wallet connection alone.
      </Notice>

      <AdminActions />

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
        <DemoReadModelOnly
          description="Current admin state requires a complete one-block contract snapshot."
          liveContent={<LiveAdminOperationalStatus />}
          title="Operational status unavailable"
        >
          <Card className="p-5 sm:p-7">
            <SectionHeading
              action={<Badge tone="info">Demo · redemption non-pausable</Badge>}
              description="Deterministic operational previews only. Immediate guardian actions reduce new risk without trapping settled claims, rewards, staked GBX, refunds, or basket redemption."
              eyebrow="Bounded controls"
              title="Demo operational status"
            />
            <TableShell className="mt-6">
              <table className="financial-table">
                <caption className="sr-only">Demo permitted protocol operations</caption>
                <thead>
                  <tr>
                    <th>Control</th>
                    <th>Status</th>
                    <th>Authority / delay</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {adminOperations.map((operation) => (
                    <tr key={operation.label}>
                      <td className="font-semibold text-white">{operation.label}</td>
                      <td>
                        <Badge
                          tone={
                            operation.status === 'Preview enabled'
                              ? 'positive'
                              : operation.status === 'Preview watch'
                                ? 'warning'
                                : 'neutral'
                          }
                        >
                          {operation.status}
                        </Badge>
                      </td>
                      <td>{operation.delay}</td>
                      <td>
                        <Button
                          disabled
                          size="sm"
                          variant={
                            operation.action === 'Pause' || operation.action === 'Disable' ? 'danger' : 'secondary'
                          }
                        >
                          {operation.action}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableShell>
          </Card>
        </DemoReadModelOnly>

        <div className="space-y-5">
          <RuntimeAdminCard />

          <Card className="p-5 sm:p-6">
            <SectionHeading eyebrow="Trust boundary" title="Guardian cannot" />
            <ul className="mt-6 space-y-3 text-xs leading-5 text-[#839292]">
              <li className="flex gap-2">
                <span className="text-[#ff83ad]">×</span> Pause GumBallVault redemption
              </li>
              <li className="flex gap-2">
                <span className="text-[#ff83ad]">×</span> Sweep or execute from the vault
              </li>
              <li className="flex gap-2">
                <span className="text-[#ff83ad]">×</span> Block unstaking or signal reductions
              </li>
              <li className="flex gap-2">
                <span className="text-[#ff83ad]">×</span> Seize balances or redirect rewards
              </li>
              <li className="flex gap-2">
                <span className="text-[#ff83ad]">×</span> Mint GBX or change its cumulative cap
              </li>
            </ul>
          </Card>
        </div>
      </div>

      <DemoReadModelOnly
        className="mt-5"
        description="A validated, bounded timelock event scan is required before current queued operations can be shown."
        liveContent={<LiveTimelockQueue />}
        title="Queued actions unavailable"
      >
        <Card className="p-5 sm:p-7">
          <SectionHeading
            description="Deterministic preview only. The live workbench uses exact typed parameter re-entry because ProtocolTimelock operations are not enumerable. Asset deployment, registration, and liquidity migration use the longer seven-day delay."
            eyebrow="ProtocolTimelock"
            title="Queued actions"
          />
          <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-white/[0.015] px-5 py-10 text-center">
            <p className="text-sm font-semibold text-[#b7c2c0]">No actions in the deterministic preview</p>
            <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-[#657373]">
              A connected authorized proposer may queue a named recovery, bounded rate reset, guardian rotation,
              canonical strategy-pair deployment, validated asset admission, or precommitted liquidity migration.
            </p>
            <Button className="mt-5" disabled>
              Connect authorized multisig
            </Button>
          </div>
        </Card>
      </DemoReadModelOnly>
    </>
  );
}
