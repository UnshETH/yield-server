const axios = require('axios');
const ethers = require('ethers');
const contract_addresses = require('../contract_addresses');
const { denomination, tokensToCheck} = require('../constants');

async function getLSDVaultTokenBalances() {
  const provider = new ethers.providers.JsonRpcProvider(process.env.ALCHEMY_CONNECTION_ETHEREUM);
  const balances = {};
  const erc20Abi = [
    "function balanceOf(address account) view returns (uint256)"
  ];

  for (const tokenKey of tokensToCheck) {
    const tokenAddress = contract_addresses[tokenKey];
    const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, provider);
    balances[tokenKey]  = await tokenContract.balanceOf(contract_addresses.LSDVault);
  }

  return balances;
}

async function getLSDPrices() {
  const coingeckoIds = {
    sfrxETH: 'staked-frax-ether',
    rETH: 'rocket-pool-eth',
    wstETH: 'staked-ether',
    cbETH: 'coinbase-wrapped-staked-eth',
    WETH: 'weth'
  };

  let prices = {
    sfrxETH: (await axios.get(`https://coins.llama.fi/prices/current/coingecko:${coingeckoIds.sfrxETH}`)).data.coins[`coingecko:${coingeckoIds.sfrxETH}`]?.price,
    rETH: (await axios.get(`https://coins.llama.fi/prices/current/coingecko:${coingeckoIds.rETH}`)).data.coins[`coingecko:${coingeckoIds.rETH}`]?.price,
    wstETH: (await axios.get(`https://coins.llama.fi/prices/current/coingecko:${coingeckoIds.wstETH}`)).data.coins[`coingecko:${coingeckoIds.wstETH}`]?.price,
    cbETH: (await axios.get(`https://coins.llama.fi/prices/current/coingecko:${coingeckoIds.cbETH}`)).data.coins[`coingecko:${coingeckoIds.cbETH}`]?.price,
    WETH: (await axios.get(`https://api.unsheth.xyz/price/WETH`)).data.price
  }

  return prices
}

async function getTotalTVL(){
  let lsdVaultTokenBalances = await getLSDVaultTokenBalances();
  let lsdPrices = await getLSDPrices();

  let lsdVaultUSDBalances = {
    sfrxETH: parseFloat(lsdVaultTokenBalances.sfrxETH)/denomination * lsdPrices.sfrxETH,
    cbETH: parseFloat(lsdVaultTokenBalances.cbETH)/denomination * lsdPrices.cbETH,
    rETH: parseFloat(lsdVaultTokenBalances.rETH)/denomination * lsdPrices.rETH,
    wstETH: parseFloat(lsdVaultTokenBalances.wstETH)/denomination * lsdPrices.wstETH,
    WETH: parseFloat(lsdVaultTokenBalances.WETH)/denomination * lsdPrices.WETH
  }

  let totalUsdBalance = 0;
  for (const [key, value] of Object.entries(lsdVaultUSDBalances)) {
    totalUsdBalance += value;
  }

  return totalUsdBalance;
}

module.exports = {
  getTotalTVL,
};

