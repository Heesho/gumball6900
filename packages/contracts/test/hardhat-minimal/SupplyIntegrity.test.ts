import { expect } from 'chai';
import { ethers } from 'hardhat';

describe('GBX mining authority integrity', function () {
  it('starts with zero supply and cannot mint before the Mine handover', async function () {
    const [deployer] = await ethers.getSigners();
    if (deployer === undefined) throw new Error('Hardhat signer unavailable');

    const token = await ethers.deployContract('GBX', [deployer.address]);
    await token.waitForDeployment();

    expect(await token.getFunction('totalSupply')()).to.equal(0n);
    expect(await token.getFunction('lifetimeMinted')()).to.equal(0n);
    expect(await token.getFunction('balanceOf')(deployer.address)).to.equal(0n);
    expect(await token.getFunction('minter')()).to.equal(deployer.address);
    expect(await token.getFunction('minterLocked')()).to.equal(false);
    await expect(token.getFunction('mint')(deployer.address, 1n)).to.be.revertedWithCustomError(
      token,
      'MinterNotLocked',
    );
  });

  it('requires the reciprocal Mine identity for the permanent minter handover', async function () {
    const [deployer, account] = await ethers.getSigners();
    if (deployer === undefined || account === undefined) throw new Error('Hardhat signers unavailable');

    const token = await ethers.deployContract('GBX', [deployer.address]);
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
    const fund = await ethers.deployContract('Fund', [tokenAddress]);
    await fund.waitForDeployment();
    const mine = await ethers.deployContract('Mine', [
      tokenAddress,
      tokenAddress,
      await fund.getAddress(),
      await router.getAddress(),
      ethers.ZeroAddress,
      deployer.address,
    ]);
    await mine.waitForDeployment();

    const mineAddress = await mine.getAddress();
    await token.getFunction('setMinter')(mineAddress);
    expect(await token.getFunction('minter')()).to.equal(mineAddress);
    expect(await token.getFunction('minterLocked')()).to.equal(true);
    await expect(token.getFunction('setMinter')(mineAddress)).to.be.revertedWithCustomError(token, 'NotMinter');
  });

  it('matches the deployment-time halving boundaries and permanent tail', async function () {
    const [deployer] = await ethers.getSigners();
    if (deployer === undefined) throw new Error('Hardhat signer unavailable');

    const token = await ethers.deployContract('GBX', [deployer.address]);
    await token.waitForDeployment();
    const tokenAddress = await token.getAddress();
    const router = await ethers.deployContract('ResonanceRouter', [tokenAddress, tokenAddress]);
    await router.waitForDeployment();
    const fund = await ethers.deployContract('Fund', [tokenAddress]);
    await fund.waitForDeployment();
    const mine = await ethers.deployContract('Mine', [
      tokenAddress,
      tokenAddress,
      await fund.getAddress(),
      await router.getAddress(),
      ethers.ZeroAddress,
      deployer.address,
    ]);
    await mine.waitForDeployment();

    const startTime = (await mine.getFunction('startTime')()) as bigint;
    const period = (await mine.getFunction('HALVING_PERIOD')()) as bigint;
    const initialTps = (await mine.getFunction('INITIAL_TPS')()) as bigint;
    const tailTps = (await mine.getFunction('TAIL_TPS')()) as bigint;

    expect(period).to.equal(69n * 86_400n);
    expect(initialTps).to.equal(ethers.parseEther('64'));
    expect(tailTps).to.equal(ethers.parseEther('1'));

    await ethers.provider.send('evm_setNextBlockTimestamp', [Number(startTime + period - 1n)]);
    await ethers.provider.send('evm_mine', []);
    expect(await mine.getFunction('nextGlobalTps')()).to.equal(initialTps);

    await ethers.provider.send('evm_setNextBlockTimestamp', [Number(startTime + period)]);
    await ethers.provider.send('evm_mine', []);
    expect(await mine.getFunction('nextGlobalTps')()).to.equal(initialTps / 2n);
    expect(await mine.getFunction('pendingEmission')()).to.equal(0n);

    await ethers.provider.send('evm_setNextBlockTimestamp', [Number(startTime + 6n * period - 1n)]);
    await ethers.provider.send('evm_mine', []);
    expect(await mine.getFunction('nextGlobalTps')()).to.equal(initialTps >> 5n);

    await ethers.provider.send('evm_setNextBlockTimestamp', [Number(startTime + 6n * period)]);
    await ethers.provider.send('evm_mine', []);
    expect(await mine.getFunction('nextGlobalTps')()).to.equal(tailTps);
  });
});
