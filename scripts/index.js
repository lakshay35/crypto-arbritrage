const { calculateArbritrage } = require('../util/arbritrage');
const { ethers } = require('ethers');
const Web3 = require('web3');
const { createAlchemyWeb3 } = require("@alch/alchemy-web3");
const { config } = require('dotenv');
const ERC20 = require('../abi/erc-20.json');
config();


const main = () => {
  const rpc = new ethers.providers.JsonRpcProvider(process.env.POLYGON_RPC);
  const polyUniUsdcWethPair = new ethers.Contract('0x45dda9cb7c25131df268515131f647d726f50608',require('../abi/poly-uni-usdc-weth.json'), rpc);
  const polyQuickUsdcWethPair = new ethers.Contract('0x853ee4b2a13f8a742d64c8f088be7ba2131f670d', require('../abi/poly-quick-usdc-weth.json'), rpc);
  const wethToken = new ethers.Contract('0x7ceb23fd6bc0add59e62ac25578270cff1b9f619', ERC20, rpc);
  const usdcToken = new ethers.Contract('0x2791bca1f2de4661ed88a30c99a7a9449aa84174', ERC20, rpc);

  global.rpc = rpc;
  global.uniswap = polyUniUsdcWethPair;
  global.quickswap = polyQuickUsdcWethPair;
  global.wethToken = wethToken;
  global.usdcToken = usdcToken

  subscribeToBlocks();
}

const subscribeToBlocks = () => {
  const web3 = new createAlchemyWeb3(
    process.env.POLYGON_WS
  );

  web3.eth.subscribe("newHeads").on("data", (data) => {
    console.log("Detect new block", data.hash);

    calculateArbritrage(global.rpc);
  });
}

(async function () {
  console.log("Arbritrageur Commencing...");

  main();
})();
