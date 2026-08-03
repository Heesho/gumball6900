import { UIMultiplierUpdated } from '../generated/templates/StockToken/StockToken';
import { CorporateAction } from '../generated/schema';
import { getVaultAsset } from './entities';
import { eventId } from './ids';

export function handleUIMultiplierUpdated(event: UIMultiplierUpdated): void {
  const asset = getVaultAsset(event.address, event);
  if (event.params.effectiveAtTimestamp.gt(event.block.timestamp)) {
    asset.currentUIMultiplierRaw = event.params.oldMultiplier;
    asset.pendingUIMultiplierRaw = event.params.newMultiplier;
    asset.multiplierEffectiveAt = event.params.effectiveAtTimestamp;
  } else {
    asset.currentUIMultiplierRaw = event.params.newMultiplier;
    asset.unset('pendingUIMultiplierRaw');
    asset.unset('multiplierEffectiveAt');
  }
  asset.save();

  const action = new CorporateAction(eventId(event));
  action.asset = asset.id;
  action.actionType = 'UI_MULTIPLIER_UPDATE';
  action.oldMultiplierRaw = event.params.oldMultiplier;
  action.newMultiplierRaw = event.params.newMultiplier;
  action.effectiveAt = event.params.effectiveAtTimestamp;
  action.blockNumber = event.block.number;
  action.timestamp = event.block.timestamp;
  action.transactionHash = event.transaction.hash;
  action.logIndex = event.logIndex;
  action.save();
}
