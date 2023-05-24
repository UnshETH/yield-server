const axios = require('axios');
const ethers = require('ethers');
const contract_addresses = require('../contract_addresses');
const farmABI = require('../ABI/FarmABI');
const { seconds_per_year, denomination} = require('../constants');
const utils = require('../../utils');
const { getBaseAPR } = require('./helper');
const { getTotalTVL} = require('./tvl');

const getPoolInfo = async () => {
  let apyBase = await getBaseAPR();
  let apyReward = await getRewardAPY();
  let tvlUsd = await getTVL(); 

  return {
      pool: `${contract_addresses['unshETH']}-${utils.formatChain('ethereum')}`,
      chain: utils.formatChain('ethereum'),
      project: 'unsheth',
      symbol: 'unshETH',
      tvlUsd,
      apyBase,
      apyReward,
      rewardTokens: [contract_addresses.USH],
      underlyingTokens: [contract_addresses.WETH]
  }
};

const getTVL = async() => {
  // Get the total supply of unshETH and subtract the balance of unshETH in the unshETHProxy
  let provider = new ethers.providers.JsonRpcProvider(process.env.ALCHEMY_CONNECTION_ETHEREUM);
  const erc20Abi = [
    "function balanceOf(address account) view returns (uint256)",
    "function totalSupply() view returns (uint256)"
  ];

  let unshETHContract = new ethers.Contract(contract_addresses.unshETH, erc20Abi, provider);

  let unshETHTotalSupply = (await unshETHContract.totalSupply()) / denomination;
  let unshETHProxyBalance = (await unshETHContract.balanceOf(contract_addresses.unshETHProxy)) / denomination;

  let unshETHonETH = unshETHTotalSupply - unshETHProxyBalance;

  let totalTVL = await getTotalTVL();

  return totalTVL*unshETHonETH/unshETHTotalSupply;
}

const getRewardAPY = async () => {
  let percentageOfUnshETHInFarm = await getPercentageOfUnshethInFarm();
  let tvlUsd = await getTotalTVL();
  let farmTVL = tvlUsd*percentageOfUnshETHInFarm
  let usdRewardPerYear = await getUSDRewardPerYear();
  let apyReward = parseFloat(parseFloat(usdRewardPerYear / farmTVL * 100).toFixed(2));
  return apyReward;
}

async function getUSDRewardPerYear(){
  let provider = new ethers.providers.JsonRpcProvider(process.env.ALCHEMY_CONNECTION_ETHEREUM);
  let farmContract = new ethers.Contract(contract_addresses["unshETH-farm"], farmABI, provider);

  let baseRewardsPerSecond = (await farmContract.getAllRewardRates())[0];

  let rewardsPerSecond = (parseFloat(baseRewardsPerSecond)/denomination)

  let rewardsPerYear = rewardsPerSecond * seconds_per_year;

  let priceKey = `coingecko:unsheth`;
  let USHPrice = (await axios.get(`https://coins.llama.fi/prices/current/${priceKey}`)).data.coins[priceKey]?.price;
  
  let USDRewardPerYear = USHPrice * parseFloat(rewardsPerYear);

  return USDRewardPerYear;
}

async function getPercentageOfUnshethInFarm(){
  let provider = new ethers.providers.JsonRpcProvider(process.env.ALCHEMY_CONNECTION_ETHEREUM);
  const erc20Abi = [
    "function balanceOf(address account) view returns (uint256)",
    "function totalSupply() view returns (uint256)"
  ];

  let unshETHContract = new ethers.Contract(contract_addresses.unshETH, erc20Abi, provider);
  
  let unshETHFarmBalance = await unshETHContract.balanceOf(contract_addresses['unshETH-farm']);
  let unshETHTotalSupply = await unshETHContract.totalSupply();

  let percentageOfUnshETHInFarm = parseFloat(unshETHFarmBalance)/parseFloat(unshETHTotalSupply);

  return percentageOfUnshETHInFarm;
}

module.exports = {
  getPoolInfo
};

