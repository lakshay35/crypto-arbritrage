const axios = require("axios");

const getEthPrice = async () => {
  try {
    return await axios.get(
      "https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=USD"
    );
  } catch (err) {
    throw err;
  }
};

module.exports = {
  getEthPrice
}