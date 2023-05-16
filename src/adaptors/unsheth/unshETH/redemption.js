const ethers = require('ethers');
const contract_addresses = require('../contract_addresses');
const unshETHABI = require('../ABI/unshETHABI');
const LSDVaultABI = require('../ABI/LSDVaultABI');
const { BLOCKS_PER_DAY} = require('../constants');

async function getRedemptionAPR() {
  try {
    let provider = new ethers.providers.JsonRpcProvider(process.env.ALCHEMY_CONNECTION_ETHEREUM);
    const currentBlock = await provider.getBlockNumber();
    const pastBlock = await provider.getBlock(currentBlock - BLOCKS_PER_DAY*7);

    const contract = new ethers.Contract(contract_addresses.unshETH, unshETHABI, provider);
    const events = await contract.queryFilter('TokenMinterBurned', pastBlock.number, currentBlock);

    let totalBurned = 0;
    for (const event of events) {
      const amount = event.args.amount;
      totalBurned += parseFloat(amount);
    }

    const LSDVault = new ethers.Contract(contract_addresses.LSDVault, LSDVaultABI, provider);
    let feeBips = parseFloat(await LSDVault.redeemFee());

    // console.log({totalBurned});
    const feeAmount = totalBurned * feeBips / 10000;
    // console.log({feeAmount});
    const totalSupply = parseFloat(await contract.totalSupply());
    // console.log({totalSupply});
    const apr = ((feeAmount * 52) / parseFloat(totalSupply)) * 100;

    return apr;
  } catch (e) {
    console.error(`Error getting burn info: ${e}`);
  }
}

module.exports = {
  getRedemptionAPR,
};

