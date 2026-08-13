import { expect } from 'chai';
import { ethers } from 'hardhat';

describe('GBX mining authority integrity', function () {
  it('creates only the twenty-million genesis allocation', async function () {
    const [deployer] = await ethers.getSigners();
    if (deployer === undefined) throw new Error('Hardhat signer unavailable');

    const token = await ethers.deployContract('GBX', [deployer.address, deployer.address]);
    await token.waitForDeployment();

    const genesisAllocation = ethers.parseEther('20000000');
    expect(await token.getFunction('GENESIS_LIQUIDITY_ALLOCATION')()).to.equal(genesisAllocation);
    expect(await token.getFunction('totalSupply')()).to.equal(genesisAllocation);
    expect(await token.getFunction('lifetimeMinted')()).to.equal(genesisAllocation);
    expect(await token.getFunction('balanceOf')(deployer.address)).to.equal(genesisAllocation);
    expect(await token.getFunction('minter')()).to.equal(deployer.address);
    expect(await token.getFunction('minterLocked')()).to.equal(false);
  });

  it('requires the reciprocal Mine identity for the permanent minter handover', async function () {
    const [deployer, account] = await ethers.getSigners();
    if (deployer === undefined || account === undefined) throw new Error('Hardhat signers unavailable');

    const token = await ethers.deployContract('GBX', [deployer.address, deployer.address]);
    await token.waitForDeployment();

    await expect(token.getFunction('mint')(account.address, 1n)).to.be.revertedWithCustomError(
      token,
      'MinterNotLocked',
    );
    await expect(token.getFunction('setMinter')(account.address)).to.be.revertedWithCustomError(
      token,
      'AddressHasNoCode',
    );

    const tokenAddress = await token.getAddress();
    await expect(token.getFunction('setMinter')(tokenAddress)).to.be.revertedWithCustomError(token, 'InvalidMine');

    const router = await ethers.deployContract('ResonanceRouter', [tokenAddress, tokenAddress]);
    await router.waitForDeployment();
    const mine = await ethers.deployContract('Mine', [
      tokenAddress,
      tokenAddress,
      await router.getAddress(),
      deployer.address,
      {
        priceMultiplier: ethers.parseEther('1.1'),
        minimumInitialPrice: 1_000_000n,
        initialUps: 16n,
        halvingAmount: ethers.parseEther('1000'),
        tailUps: 16n,
      },
    ]);
    await mine.waitForDeployment();

    const mineAddress = await mine.getAddress();
    await token.getFunction('setMinter')(mineAddress);
    expect(await token.getFunction('minter')()).to.equal(mineAddress);
    expect(await token.getFunction('minterLocked')()).to.equal(true);
    await expect(token.getFunction('setMinter')(mineAddress)).to.be.revertedWithCustomError(token, 'NotMinter');
  });
});
