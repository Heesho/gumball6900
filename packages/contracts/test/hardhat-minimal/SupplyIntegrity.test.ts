import { expect } from 'chai';
import { ethers, network } from 'hardhat';

describe('Minimal GBX supply integrity', function () {
  it('counts genesis, advances mining, and never reopens capacity after a burn', async function () {
    const [deployer, holder] = await ethers.getSigners();
    if (deployer === undefined || holder === undefined) throw new Error('Hardhat signers unavailable');

    const timelock = await ethers.deployContract('ProtocolTimelock', [deployer.address]);
    await timelock.waitForDeployment();
    const token = await ethers.deployContract('GBXToken', [
      deployer.address,
      deployer.address,
      await timelock.getAddress(),
    ]);
    await token.waitForDeployment();
    const claims = await ethers.deployContract('MiningClaims', [await token.getAddress(), deployer.address]);
    await claims.waitForDeployment();
    const controller = await ethers.deployContract('EmissionController', [
      await token.getAddress(),
      await claims.getAddress(),
      0n,
      465_152_749_681_042_811_702_004n,
    ]);
    await controller.waitForDeployment();
    await token.getFunction('initializeEmissionController')(await controller.getAddress());

    const genesis = ethers.parseEther('20000000');
    const capacityBefore = await token.getFunction('remainingMintCapacity')();
    expect(await token.getFunction('cumulativeMinted')()).to.equal(genesis);
    expect(await token.getFunction('totalSupply')()).to.equal(genesis);

    const miningPoolAddress = await claims.getAddress();
    await network.provider.send('hardhat_setBalance', [miningPoolAddress, '0x56BC75E2D63100000']);
    const miningPoolSigner = await ethers.getImpersonatedSigner(miningPoolAddress);
    const scheduled = await controller.getFunction('currentScheduledEmission')();
    await controller.connect(miningPoolSigner).getFunction('settleMiningEpoch')(0n, holder.address, true);
    await network.provider.send('hardhat_stopImpersonatingAccount', [miningPoolAddress]);

    expect(await token.getFunction('balanceOf')(holder.address)).to.equal(scheduled);
    expect(await token.getFunction('remainingMintCapacity')()).to.equal(capacityBefore - scheduled);

    await token.connect(holder).getFunction('burn')(scheduled);
    expect(await token.getFunction('cumulativeBurned')()).to.equal(scheduled);
    expect(await token.getFunction('remainingMintCapacity')()).to.equal(capacityBefore - scheduled);
    expect(await token.getFunction('totalSupply')()).to.equal(genesis);
    expect(await token.getFunction('totalSupply')()).to.equal(
      (await token.getFunction('cumulativeMinted')()) - (await token.getFunction('cumulativeBurned')()),
    );
  });
});
