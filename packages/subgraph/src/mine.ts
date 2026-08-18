import { Claimed, EmissionSettled, Mined, MinerPaymentAccrued, RevenueRouted } from '../generated/Mine/Mine';
import { BigInt } from '@graphprotocol/graph-ts';
import { getAccount, getMiningSlot, getProtocol, recordEvent } from './entities';

export function handleMined(event: Mined): void {
  const protocol = getProtocol(event);
  protocol.miningPaymentsRaw = protocol.miningPaymentsRaw.plus(event.params.price);
  protocol.save();

  const slot = getMiningSlot(event.address, event.params.index, event);
  slot.epoch = event.params.epochId.plus(BigInt.fromI32(1));
  slot.currentMiner = event.params.miner;
  slot.initialPriceRaw = event.params.initialPrice;
  slot.auctionStartedAt = event.block.timestamp;
  slot.tpsRaw = event.params.tps;
  slot.totalReplacementPaidRaw = slot.totalReplacementPaidRaw.plus(event.params.price);
  slot.lastPriceRaw = event.params.price;
  slot.save();

  const record = recordEvent(event, 'MINE_SLOT_REPLACED');
  record.addresses = [event.params.payer, event.params.miner, event.params.previousMiner];
  record.values = [
    event.params.index,
    event.params.epochId,
    event.params.price,
    event.params.initialPrice,
    event.params.tps,
  ];
  record.save();
}

export function handleEmissionSettled(event: EmissionSettled): void {
  const protocol = getProtocol(event);
  protocol.minedGBXRaw = protocol.minedGBXRaw.plus(event.params.amount);
  protocol.save();

  const account = getAccount(event.params.miner, event);
  account.gbxMinedRaw = account.gbxMinedRaw.plus(event.params.amount);
  account.save();

  const slot = getMiningSlot(event.address, event.params.index, event);
  slot.totalMinedRaw = slot.totalMinedRaw.plus(event.params.amount);
  slot.save();

  const record = recordEvent(event, 'MINE_EMISSION_SETTLED');
  record.addresses = [event.params.miner];
  record.values = [event.params.index, event.params.epochId, event.params.amount];
  record.save();
}

export function handleMinerPaymentAccrued(event: MinerPaymentAccrued): void {
  const protocol = getProtocol(event);
  protocol.previousMinerPaymentsRaw = protocol.previousMinerPaymentsRaw.plus(event.params.amount);
  protocol.save();

  const account = getAccount(event.params.miner, event);
  account.miningPaymentAccruedRaw = account.miningPaymentAccruedRaw.plus(event.params.amount);
  account.save();

  const record = recordEvent(event, 'MINE_PAYMENT_ACCRUED');
  record.addresses = [event.params.miner];
  record.values = [event.params.index, event.params.epochId, event.params.amount];
  record.save();
}

export function handleClaimed(event: Claimed): void {
  const account = getAccount(event.params.account, event);
  account.miningUSDGClaimedRaw = account.miningUSDGClaimedRaw.plus(event.params.amount);
  account.save();

  const record = recordEvent(event, 'MINE_PAYMENT_CLAIMED');
  record.addresses = [event.params.account];
  record.values = [event.params.amount];
  record.save();
}

export function handleMiningRevenueRouted(event: RevenueRouted): void {
  const protocol = getProtocol(event);
  protocol.miningRevenueRoutedRaw = protocol.miningRevenueRoutedRaw.plus(event.params.amount);
  protocol.save();

  const record = recordEvent(event, 'MINE_REVENUE_ROUTED');
  record.values = [event.params.index, event.params.epochId, event.params.amount];
  record.save();
}
