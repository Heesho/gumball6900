import { expect } from 'chai';
import { ethers, network } from 'hardhat';

describe('Supply integrity parity', function () {
  it('matches GBX metadata, schedule, and mint/burn accounting through Hardhat', async function () {
    const signers = await ethers.getSigners();
    const deployer = signers[0];
    const holder = signers[1];
    if (deployer === undefined || holder === undefined) throw new Error('Hardhat signers unavailable');

    const token = await ethers.deployContract('GBXToken', [deployer.address, ethers.ZeroAddress]);
    await token.waitForDeployment();

    const controller = await ethers.deployContract('EmissionController', [await token.getAddress(), deployer.address]);
    await controller.waitForDeployment();

    const controllerAddress = await controller.getAddress();
    await token.getFunction('initializeEmissionController')(controllerAddress);

    expect(await token.getFunction('name')()).to.equal('GUM BALL 6900');
    expect(await token.getFunction('symbol')()).to.equal('GBX');
    expect(await token.getFunction('MAX_CUMULATIVE_MINT')()).to.equal(ethers.parseEther('1000000000'));
    expect(await controller.getFunction('scheduledEmission')(1460n)).to.equal(213_590_548_322_927_697_881_931n);

    await network.provider.send('hardhat_setBalance', [controllerAddress, '0x56BC75E2D63100000']);
    const controllerSigner = await ethers.getImpersonatedSigner(controllerAddress);

    await token.connect(controllerSigner).getFunction('mint')(holder.address, 100n);
    await token.connect(holder).getFunction('burn')(40n);

    expect(await token.getFunction('totalSupply')()).to.equal(60n);
    expect(await token.getFunction('cumulativeMinted')()).to.equal(100n);
    expect(await token.getFunction('cumulativeBurned')()).to.equal(40n);

    await network.provider.send('hardhat_stopImpersonatingAccount', [controllerAddress]);
  });
});
