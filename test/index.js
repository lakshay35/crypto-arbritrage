const { expect } = require("chai");
const { BigNumber } = require('ethers');
const { ethers } = require("hardhat");
const ERC20ABI = require('../abi/erc-20.json');
const UNIV2ROUTERABI = require("../abi/uni-v2-router.json");

const WETH_ADDRESS = "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619";
const USDC_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";

const WETH_HOLDER = "0x54FA5a1B8bf0692358625a8a2daFA506fEC2D41f";
const USDC_HOLDER = "0xCdF46720BdF30D6bd0912162677c865d4344B0CA"

const AAVE_LENDING_POOL_ADDRESS_PROVIDER = "0xd05e3E715d945B59290df0ae8eF85c1BdB684744";

describe("Arbritrageur", () => {

  it("Should deploy contract", async () => {
    const Arbritrageur = await ethers.getContractFactory("Arbritrageur");
    const arbritrageur = await Arbritrageur.deploy(AAVE_LENDING_POOL_ADDRESS_PROVIDER);
    await arbritrageur.deployed();
  });

  it('Should have owner', async () => {
    const Arbritrageur = await ethers.getContractFactory("Arbritrageur");
    const arbritrageur = await Arbritrageur.deploy(AAVE_LENDING_POOL_ADDRESS_PROVIDER);
    await arbritrageur.deployed();
    expect(await arbritrageur.owner()).to.equal(arbritrageur.deployTransaction.from);
  });

  it('Should allow erc20 token withdrawals', async () => {
    const Arbritrageur = await ethers.getContractFactory("Arbritrageur");
    const arbritrageur = await Arbritrageur.deploy(AAVE_LENDING_POOL_ADDRESS_PROVIDER);
    await arbritrageur.deployed();

    await transferToken(arbritrageur.address, WETH_HOLDER, WETH_ADDRESS, ethers.utils.parseEther("1"));

    const wethContract = await ethers.getContractAt(ERC20ABI, WETH_ADDRESS);

    expect(await wethContract.balanceOf(arbritrageur.address)).to.equal("1000000000000000000");

    const deployerAddress = arbritrageur.deployTransaction.from;

    expect(await wethContract.balanceOf(deployerAddress)).to.equal(0);

    await arbritrageur.withdraw(WETH_ADDRESS);

    expect(await wethContract.balanceOf(deployerAddress)).to.equal("1000000000000000000");
  });

  it("Should arbritrage ETH from Uniswap to Quickswap", async () => {
    const Arbritrageur = await ethers.getContractFactory("Arbritrageur");
    const arbritrageur = await Arbritrageur.deploy(AAVE_LENDING_POOL_ADDRESS_PROVIDER);
    await arbritrageur.deployed();

    // Transfer a 100 USDC ($100 USD) into contract
    await transferToken(arbritrageur.address, USDC_HOLDER, USDC_ADDRESS, "100000000")

    const usdcContract = await ethers.getContractAt(ERC20ABI, USDC_ADDRESS);

    const usdcPreArbritrageBalance = await usdcContract.balanceOf(arbritrageur.address);
    console.log("USDC BALANCE PRE ARBRITRAGE", usdcPreArbritrageBalance.div("1000000").toString());

    await arbritrageur.arbritrage(
      USDC_ADDRESS,
      "100000000",
      true,
      WETH_ADDRESS,
      "3000",
      [WETH_ADDRESS, USDC_ADDRESS],
      "0"
    );

    const usdcBalance = await usdcContract.balanceOf(arbritrageur.address);
    console.log("USDC balance of arbritrageur contract", usdcBalance.toString());
  });

  it("Should arbritrage ETH from Quickswap to Uniswap", async () => {
    const Arbritrageur = await ethers.getContractFactory("Arbritrageur");
    const arbritrageur = await Arbritrageur.deploy(AAVE_LENDING_POOL_ADDRESS_PROVIDER);
    await arbritrageur.deployed();

    // Transfer a 100 USDC ($100 USD) into contract
    await transferToken(arbritrageur.address, USDC_HOLDER, USDC_ADDRESS, "100000000")

    const router = await ethers.getContractAt(UNIV2ROUTERABI, "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff");
    const amountsOut = await router.getAmountsOut(100000000, [USDC_ADDRESS, WETH_ADDRESS]);

    const usdcContract = await ethers.getContractAt(ERC20ABI, USDC_ADDRESS);

    const usdcPreArbritrageBalance = await usdcContract.balanceOf(arbritrageur.address);
    console.log("USDC BALANCE PRE ARBRITRAGE", usdcPreArbritrageBalance.div("1000000").toString());

    await arbritrageur.arbritrage(
      USDC_ADDRESS,
      "100000000",
      false,
      WETH_ADDRESS,
      "3000",
      [WETH_ADDRESS, USDC_ADDRESS],
      amountsOut[1].toString()
    );

    const usdcBalance = await usdcContract.balanceOf(arbritrageur.address);
    console.log("USDC balance of arbritrageur contract", usdcBalance.toString());
  });
});

/**
 *
 * @param {String} arbritrageurAddress
 * @param {String} transferFromAddress
 * @param {String} tokenAddress
 * @param {String} amount
 */
const transferToken = async (arbritrageurAddress, transferFromAddress, tokenAddress, amount) => {

   // Send some ERC20 to my contract
   // by trying to impersonate a whale and sending stuff from their accounts
   await hre.network.provider.request({
       method: "hardhat_impersonateAccount",
       params: [transferFromAddress],
   });
   const signer = await ethers.provider.getSigner(transferFromAddress);
   signer.address = signer._address;
   tokenContract = await hre.ethers.getContractAt(ERC20ABI, tokenAddress, signer);
   tokenContract = tokenContract.connect(signer);
   await tokenContract.transfer(arbritrageurAddress, amount);

   expect(await tokenContract.balanceOf(arbritrageurAddress)).to.equal(
       amount,
       `Contract to test should hold ${amount} TOKENS!`);
}