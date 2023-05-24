const axios = require('axios');
const ethers = require('ethers');
const contract_addresses = require('../contract_addresses');
const farmABI = require('../ABI/FarmABI');
const utils = require('../../utils');
const { seconds_per_year, denomination, BINANCE_RPC_URL } = require('../constants');
const { getBaseAPR,  } = require('./helper');
const { getTotalTVL} = require('./tvl');

const getPoolInfo = async () => {
  try {
    let apyBase = await getBaseAPR();
    let apyReward = await getRewardAPY();
    let tvlUsd = await getTVL(); 

    return {
        pool: `${contract_addresses['BNBunshETH']}-${utils.formatChain('binance')}`,
        chain: utils.formatChain('binance'),
        project: 'unsheth',
        symbol: 'unshETH',
        tvlUsd,
        apyBase,
        apyReward,
        rewardTokens: [contract_addresses.BNBUSH],
        underlyingTokens: [contract_addresses.BNBETH]
    }
  }
  catch (e) {
    console.log(e);
    throw new Error(e);
  }
};


const getTVL = async() => {
  // Get the total supply of BNBunshETH and subtract it from the totalSupply of unshETH 
  let provider = new ethers.providers.JsonRpcProvider(process.env.ALCHEMY_CONNECTION_ETHEREUM);
  const erc20Abi = [
    "function balanceOf(address account) view returns (uint256)",
    "function totalSupply() view returns (uint256)"
  ];

  let unshETHContract = new ethers.Contract(contract_addresses.unshETH, erc20Abi, provider);

  let unshETHTotalSupply = (await unshETHContract.totalSupply()) / denomination;

  let bnb_provider = new ethers.providers.JsonRpcProvider(BINANCE_RPC_URL);

  let BNBunshETHContract = new ethers.Contract(contract_addresses.BNBunshETH, erc20Abi, bnb_provider);

  let BNBunshETHTotalSupply = (await BNBunshETHContract.totalSupply()) / denomination;

  let totalTVL = await getTotalTVL();

  return totalTVL*BNBunshETHTotalSupply/unshETHTotalSupply;
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

  let provider = new ethers.providers.JsonRpcProvider(BINANCE_RPC_URL);
  let farmContract = new ethers.Contract(contract_addresses["BNBunshETH-farm"], farmABI, provider);
  let baseRewardsPerSecond = (await farmContract.getAllRewardRates())[0];

  let rewardsPerSecond = (parseFloat(baseRewardsPerSecond)/denomination)

  let rewardsPerYear = rewardsPerSecond * seconds_per_year;

  let priceKey = `coingecko:unsheth`;
  let USHPrice = (await axios.get(`https://coins.llama.fi/prices/current/${priceKey}`)).data.coins[priceKey]?.price;
  

  let USDRewardPerYear = USHPrice * parseFloat(rewardsPerYear);

  return USDRewardPerYear;
}


async function getPercentageOfUnshethInFarm(){

  let provider = new ethers.providers.JsonRpcProvider(BINANCE_RPC_URL);
  let eth_provider = new ethers.providers.JsonRpcProvider(process.env.ALCHEMY_CONNECTION_ETHEREUM);

  const erc20Abi = [
    "function balanceOf(address account) view returns (uint256)",
    "function totalSupply() view returns (uint256)"
  ];

  let BNBunshETHContract = new ethers.Contract(contract_addresses.BNBunshETH, erc20Abi, provider);
  let BNBunshETHFarmBalance = await BNBunshETHContract.balanceOf(contract_addresses['BNBunshETH-farm']);
  
  let unshETHContract = new ethers.Contract(contract_addresses.unshETH, erc20Abi, eth_provider);
  let unshETHTotalSupply = await unshETHContract.totalSupply();

  let percentageOfUnshETHInFarm = parseFloat(BNBunshETHFarmBalance)/parseFloat(unshETHTotalSupply);

  return percentageOfUnshETHInFarm;
}

module.exports = {
  getPoolInfo
};

