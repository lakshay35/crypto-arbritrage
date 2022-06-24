const { getEthPrice } = require('./ethPrice')
const { BigNumber } = require('ethers');
const { default: axios } = require('axios');
const calculateArbritrage = async () => {
  // const { data } = await getEthPrice();

  console.log(Date.now());

  const result = await Promise.all([
    getPriceOfWethOnQuickswap(),
    getPriceOfWethOnUniswap()
  ]);

  console.log(result);

  const quickPrice = result[0].wethPrice;
  const uniPrice = result[1].wethPrice;
  //TODO: Send off transaction to chain when profit available
  console.log(Math.abs(quickPrice - uniPrice) / Math.min(quickPrice, uniPrice));
  console.log();
  if((Math.abs(quickPrice - uniPrice) / Math.min(quickPrice, uniPrice) > 0.005)) {
    console.log("Can execute profitable trade > 1% profit overcoming Flash loan 0.09% interest");
    const profit = Math.abs(quickPrice - uniPrice);
    let multiplier = 0;
    if(quickPrice < uniPrice) {
      console.log("Buy on Quickswap and sell on Uniswap");
      multiplier = (profit / quickPrice);
      console.log(multiplier * 100, "% profit available");
    } else {
      console.log("Buy on Uniswap and sell on Quickswap");
      multiplier = (profit / uniPrice);
      console.log(multiplier * 100, "% profit available");
    }

    console.log("$100,000.00", "can be turned into", (1 + multiplier) * 100000);

  } else {
    console.log("No profitable trade available");
  }
}

const getPriceOfWethOnQuickswap = async () => {
  if(global.quickswap) {
    const reserves = await global.quickswap.getReserves();
    const wethAmount = BigNumber.from(reserves[0]);
    const usdcAmount = BigNumber.from(reserves[1]);

    return {
      name: 'QUICK WETH-USDC',
      wethPrice: wethAmount.mul('100000000000000').div(usdcAmount).toNumber() / 100
    }
  } else {
    return null;
  }
}

const getPriceOfWethOnUniswap = async () => {
  if(global.uniswap) {
   const res = await axios.get('https://api.uniswap.org/v1/quote?protocols=v2%2Cv3&tokenInAddress=0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619&tokenInChainId=137&tokenOutAddress=0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174&tokenOutChainId=137&amount=1000000000000000000&type=exactIn', {
     headers: {
       Origin: 'https://app.uniswap.org'
     }
   });

    return {
      name: 'UNI V3 WETH-USDC',
      wethPrice: Number(res.data.quoteDecimals)
    }
  } else {
    return null;
  }
}

module.exports = {
  calculateArbritrage
}