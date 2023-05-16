const ethers = require('ethers');
const contract_addresses = require('../contract_addresses');
const utils = require('../../utils');
const { denomination } = require('../constants');
const { getBaseAPR,  } = require('./helper');
const { getTotalTVL} = require('./tvl');

const getPoolInfo = async () => {
  try {
    let apyBase = await getBaseAPR();
    let apyReward = await getRewardAPY();
    let tvlUsd = await getTVL(); 

    return {
        pool: `${contract_addresses['ARBunshETH']}-${utils.formatChain('arbitrum')}`,
        chain: utils.formatChain('arbitrum'),
        project: 'unsheth',
        symbol: 'unshETH',
        tvlUsd,
        apyBase,
        apyReward,
        rewardTokens: [],
        underlyingTokens: [contract_addresses.WETH]
    }
  }
  catch (e) {
    console.log(e);
    throw new Error(e);
  }
};


const getTVL = async() => {
  // Get the total supply of ARBunshETH and subtract it from the totalSupply of unshETH 
  let provider = new ethers.providers.JsonRpcProvider(process.env.ALCHEMY_CONNECTION_ETHEREUM);
  const erc20Abi = [
    "function balanceOf(address account) view returns (uint256)",
    "function totalSupply() view returns (uint256)"
  ];

  let unshETHContract = new ethers.Contract(contract_addresses.unshETH, erc20Abi, provider);

  let unshETHTotalSupply = (await unshETHContract.totalSupply()) / denomination;

  let arb_provider = new ethers.providers.JsonRpcProvider(process.env.ALCHEMY_CONNECTION_ARBITRUM);

  let ARBunshETHContract = new ethers.Contract(contract_addresses.ARBunshETH, erc20Abi, arb_provider);

  let ARBunshETHTotalSupply = (await ARBunshETHContract.totalSupply()) / denomination;

  let totalTVL = await getTotalTVL();

  console.log({
    unshETHTotalSupply,
    ARBunshETHTotalSupply,
  });

  return totalTVL*ARBunshETHTotalSupply/unshETHTotalSupply;
}

const getRewardAPY = async () => {
  return 0;
}

module.exports = {
  getPoolInfo
};


