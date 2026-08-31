import { expect } from 'chai';
import { ethers } from 'hardhat';

describe('Robinhood Mainnet Demo tokens', function () {
  it('creates only the exact closed mUSDG bootstrap seed', async function () {
    const [launchAuthority, account] = await ethers.getSigners();
    if (launchAuthority === undefined || account === undefined) throw new Error('Hardhat signers unavailable');

    const usdg = await ethers.deployContract('DemoUSDG', [launchAuthority.address]);
    await usdg.waitForDeployment();

    const bootstrapAmount = (await usdg.getFunction('BOOTSTRAP_AMOUNT')()) as bigint;
    expect(await usdg.getFunction('name')()).to.equal('Mock USDG (No Value)');
    expect(await usdg.getFunction('symbol')()).to.equal('mUSDG');
    expect(await usdg.getFunction('decimals')()).to.equal(6n);
    expect(bootstrapAmount).to.equal(1_000_000n);
    expect(await usdg.getFunction('totalSupply')()).to.equal(bootstrapAmount);
    expect(await usdg.getFunction('balanceOf')(launchAuthority.address)).to.equal(bootstrapAmount);
    expect(await usdg.getFunction('balanceOf')(account.address)).to.equal(0n);
    expect(await usdg.getFunction('faucetEnabled')()).to.equal(false);

    await expect(usdg.connect(account).getFunction('faucet')()).to.be.revertedWithCustomError(usdg, 'FaucetDisabled');
    expect(await usdg.getFunction('totalSupply')()).to.equal(bootstrapAmount);
    expect(await usdg.getFunction('balanceOf')(account.address)).to.equal(0n);
  });

  it('uses visible no-value metadata and mints only the fixed amount to each faucet caller', async function () {
    const [deployer, account] = await ethers.getSigners();
    if (deployer === undefined || account === undefined) throw new Error('Hardhat signers unavailable');

    const token = await ethers.deployContract('DemoFaucetToken', ['Intel', 'INTC']);
    await token.waitForDeployment();

    const faucetAmount = (await token.getFunction('FAUCET_AMOUNT')()) as bigint;
    expect(await token.getFunction('name')()).to.equal('Mock Intel (No Value)');
    expect(await token.getFunction('symbol')()).to.equal('mINTC');
    expect(await token.getFunction('decimals')()).to.equal(18n);
    expect(await token.getFunction('isDemoToken')()).to.equal(true);
    expect(faucetAmount).to.equal(ethers.parseEther('1000'));
    expect(await token.getFunction('totalSupply')()).to.equal(0n);

    await expect(token.connect(account).getFunction('faucet')())
      .to.emit(token, 'FaucetMinted')
      .withArgs(account.address, faucetAmount);
    expect(await token.getFunction('balanceOf')(account.address)).to.equal(faucetAmount);
    expect(await token.getFunction('balanceOf')(deployer.address)).to.equal(0n);
    expect(await token.getFunction('totalSupply')()).to.equal(faucetAmount);

    await token.connect(deployer).getFunction('faucet')();
    expect(await token.getFunction('balanceOf')(account.address)).to.equal(faucetAmount);
    expect(await token.getFunction('balanceOf')(deployer.address)).to.equal(faucetAmount);
    expect(await token.getFunction('totalSupply')()).to.equal(2n * faucetAmount);
  });
});
