import { expect } from 'chai';
import { ethers } from 'hardhat';

describe('GBX lifetime supply integrity', function () {
  it('never reopens lifetime mint capacity after a burn', async function () {
    const [deployer, holder] = await ethers.getSigners();
    if (deployer === undefined || holder === undefined) throw new Error('Hardhat signers unavailable');

    const token = await ethers.deployContract('GBX', [deployer.address, deployer.address]);
    await token.waitForDeployment();

    const amount = ethers.parseEther('100');
    const lifetimeCap = BigInt(await token.getFunction('MAX_LIFETIME_MINT')());
    const genesisAllocation = BigInt(await token.getFunction('GENESIS_LIQUIDITY_ALLOCATION')());

    await expect(token.getFunction('mint')(holder.address, amount)).to.be.revertedWithCustomError(
      token,
      'MinterNotLocked',
    );
    await token.getFunction('setMinter')(holder.address);
    await token.connect(holder).getFunction('mint')(holder.address, amount);
    expect(await token.getFunction('lifetimeMinted')()).to.equal(genesisAllocation + amount);
    expect(await token.getFunction('remainingMintableSupply')()).to.equal(lifetimeCap - genesisAllocation - amount);

    await token.connect(holder).getFunction('burn')(amount);
    expect(await token.getFunction('lifetimeBurned')()).to.equal(amount);
    expect(await token.getFunction('totalSupply')()).to.equal(genesisAllocation);
    expect(await token.getFunction('remainingMintableSupply')()).to.equal(lifetimeCap - genesisAllocation - amount);
  });
});
