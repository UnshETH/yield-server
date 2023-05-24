const ethers = require('ethers');
const { BLOCKS_PER_DAY } = require('../constants');
const contract_addresses = require('../contract_addresses');
const vdAMMABI = require('../ABI/vdAMM');
const ChainlinkABI = require('../ABI/ChainlinkABI');
const DarknetABI = require ('../ABI/DarknetABI');
const LSDVaultABI = require('../ABI/LSDVaultABI');
const { getTotalTVL} = require('./tvl');

let provider = new ethers.providers.JsonRpcProvider(process.env.ALCHEMY_CONNECTION_ETHEREUM);
const contractAddress = contract_addresses.vdAMM; // replace with the actual contract address

async function getSwapAPR() {
  try {
    //get the vdamm address from the LSDVault contract by calling swapperAddress
    const LSDVault = new ethers.Contract(contract_addresses.LSDVault, LSDVaultABI, provider);
    const vdAMMAddress = await LSDVault.swapperAddress();
    const vdAMM = new ethers.Contract(vdAMMAddress, vdAMMABI, provider);

    const darknetAddress = await LSDVault.darknetAddress();
    const darknetContract = new ethers.Contract(darknetAddress, DarknetABI, provider);

    const currentBlock = await provider.getBlockNumber();
    const startBlock = currentBlock - BLOCKS_PER_DAY * 7;
    const events = await vdAMM.queryFilter('SwapLsdToLsd', startBlock, currentBlock);

    let weeklyFee = 0;
    for (const event of events) {
      weeklyFee += await parseEvent({event, weeklyFee, darknetContract});
    }

    let tvl = await getTotalTVL();
    let apr = (weeklyFee * 52) / tvl * 100;

    return apr;
  }
  catch (e) {
    console.error(`Error updating user rankings: ${e}`);
  }
}

async function parseEvent({event, weeklyFee, darknetContract}){
  const lsdIn = event.args.lsdIn.toLowerCase();
  const receipt = await provider.getTransactionReceipt(event.transactionHash);

  //extract block number from receipt
  const blockNumber = receipt.blockNumber;

  //get the price of the token at the time of the transaction use a chainlink oracle
  const chainlinkContract = new ethers.Contract(contract_addresses.chainlinkETHUSD, ChainlinkABI, provider);
  const latestAnswer = await chainlinkContract.latestAnswer({blockTag: blockNumber});
  const price = parseFloat(latestAnswer)/1e8;

  //use the checkPrice function of the darknet contract to the price of the token in terms of eth and normalize it and then create a new variable that is the lsd price at this time
  const lsdPrice = await darknetContract.checkPrice(lsdIn, {blockTag: blockNumber});
  const lsdPriceInEth = parseFloat(lsdPrice)/1e18;
  const lsdPriceInUSD = lsdPriceInEth * price;

  // extract critical information from the event
  const baseFee = parseFloat(event.args.baseFee)/1e18*lsdPriceInUSD;
  const dynamicFee = parseFloat(event.args.dynamicFee)/1e18*lsdPriceInUSD;

  return baseFee + dynamicFee;
}

module.exports = {
  getSwapAPR,
};