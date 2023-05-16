const axios = require('axios');
const ethers = require('ethers');
const contract_addresses = require('../contract_addresses');
const cbETHAdaptor = require('../../coinbase-wrapped-staked-eth');
const darknetABI = require('../ABI/DarknetABI');
const { denomination, tokensToCheck, BLOCKS_PER_DAY} = require('../constants');
const {getRedemptionAPR} = require('./redemption');
const { getDepositAPR } = require('./deposit');
const {getSwapAPR} = require('./swap');

const getBaseAPR = async () => {
  let weight_apr = await getWeightedApr();
  let redemption_apr = await getRedemptionAPR();
  let deposit_apr = await getDepositAPR();
  let swap_apr = await getSwapAPR();

  return weight_apr + redemption_apr + deposit_apr + swap_apr;
};

async function getWeightedApr(){

  let underlyingAPR = {
    sfrxETH: (await axios.get('https://api.frax.finance/v2/frxeth/summary/latest')).data.sfrxethApr,
    cbETH: (await cbETHAdaptor.apy())[0].apyBase,
    rETH: parseFloat((await axios.get('https://api.rocketpool.net/api/apr')).data.yearlyAPR),
    wstETH: parseFloat((await axios.get('https://stake.lido.fi/api/sma-steth-apr')).data)
  }

  let darknetRates = await getDarknetRates();

  let lsdVaultTokenBalances = await getLSDVaultTokenBalances();

  let lsdVaultEthBalances = {
    sfrxETH: parseFloat(lsdVaultTokenBalances.sfrxETH)/denomination * parseFloat(darknetRates.sfrxETH)/denomination,
    cbETH: parseFloat(lsdVaultTokenBalances.cbETH)/denomination * parseFloat(darknetRates.cbETH)/denomination,
    rETH: parseFloat(lsdVaultTokenBalances.rETH)/denomination * parseFloat(darknetRates.rETH)/denomination,
    wstETH: parseFloat(lsdVaultTokenBalances.wstETH)/denomination * parseFloat(darknetRates.wstETH)/denomination
  }

  let totalEthBalance = 0;
  for (let lsd in lsdVaultEthBalances) {
    totalEthBalance += lsdVaultEthBalances[lsd];
  }
  let lsdVaultWeights = {
    sfrxETH: lsdVaultEthBalances.sfrxETH/totalEthBalance,
    cbETH: lsdVaultEthBalances.cbETH/totalEthBalance,
    rETH: lsdVaultEthBalances.rETH/totalEthBalance,
    wstETH: lsdVaultEthBalances.wstETH/totalEthBalance
  }

  let weightedApr = 0;
  for (let lsd in lsdVaultWeights) {
    weightedApr += underlyingAPR[lsd] * lsdVaultWeights[lsd];
  }

  return weightedApr;
}

async function getDarknetRates() {
  const provider = new ethers.providers.JsonRpcProvider(process.env.ALCHEMY_CONNECTION_ETHEREUM);
  let darknet = new ethers.Contract(contract_addresses.darknet, darknetABI, provider);
  let darknetRates = {
    sfrxETH: await darknet.checkPrice(...[contract_addresses.sfrxETH]),
    cbETH: await darknet.checkPrice(...[contract_addresses.cbETH]),
    rETH: await darknet.checkPrice(...[contract_addresses.rETH]),
    wstETH: await darknet.checkPrice(...[contract_addresses.wstETH])
  }

  return darknetRates;
}

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
  };

  let prices = {
    sfrxETH: (await axios.get(`https://coins.llama.fi/prices/current/coingecko:${coingeckoIds.sfrxETH}`)).data.coins[`coingecko:${coingeckoIds.sfrxETH}`]?.price,
    rETH: (await axios.get(`https://coins.llama.fi/prices/current/coingecko:${coingeckoIds.rETH}`)).data.coins[`coingecko:${coingeckoIds.rETH}`]?.price,
    wstETH: (await axios.get(`https://coins.llama.fi/prices/current/coingecko:${coingeckoIds.wstETH}`)).data.coins[`coingecko:${coingeckoIds.wstETH}`]?.price,
    cbETH: (await axios.get(`https://coins.llama.fi/prices/current/coingecko:${coingeckoIds.cbETH}`)).data.coins[`coingecko:${coingeckoIds.cbETH}`]?.price,
  }

  return prices
}

module.exports = {
  getBaseAPR,
  getLSDVaultTokenBalances,
  getLSDPrices,
};

