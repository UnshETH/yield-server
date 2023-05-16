const ethers = require('ethers');
const contract_addresses = require('../contract_addresses');
const unshETHABI = require('../ABI/unshETHABI');
const DarknetABI = require('../ABI/DarknetABI');
const vdAMMABI = require('../ABI/vdAMM');
const ChainlinkABI = require('../ABI/ChainlinkABI');
const LSDVaultABI = require('../ABI/LSDVaultABI');

const { BLOCKS_PER_DAY } = require('../constants');


const contractNames = {};
for (const [contract, address] of Object.entries(contract_addresses)) {
  contractNames[address.toLowerCase()] = contract;
}


let transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

const lsds = [
  'sfrxETH',
  'wstETH',
  'rETH',
  'WETH',
  'cbETH'
]

async function getDepositAPR() {
  try {
    let provider = new ethers.providers.JsonRpcProvider(process.env.ALCHEMY_CONNECTION_ETHEREUM);
    const currentBlock = await provider.getBlockNumber();
    const pastBlock = await provider.getBlock(currentBlock - BLOCKS_PER_DAY*7);

    const unshETHContract = new ethers.Contract(contract_addresses.unshETH, unshETHABI, provider);
    const events = await unshETHContract.queryFilter('TokenMinterMinted', pastBlock.number, currentBlock);

    let totalFeeUSD = 0;
    for (const event of events) {

      const receipt = await provider.getTransactionReceipt(event.transactionHash);
      const blockNumber = receipt.blockNumber;
      let vdamm = new ethers.Contract(contract_addresses.vdAMM, vdAMMABI, provider);

      for (const log of receipt.logs) {
        try {
        if(contractNames[log.address.toLocaleLowerCase()]) {
          if(lsds.includes(contractNames[log.address.toLocaleLowerCase()])){
            if(log.topics.includes(transferTopic)){

              let [depositFee, protocolFee] = await vdamm.getDepositFee(log.data, log.address, {blockTag: blockNumber});
              
              if(parseFloat(depositFee) === 0) break;

              //get the price of the token at the time of the transaction use a chainlink oracle
              const chainlinkContract = new ethers.Contract(contract_addresses.chainlinkETHUSD, ChainlinkABI, provider);
              const latestAnswer = await chainlinkContract.latestAnswer({blockTag: blockNumber});
              const eth_price = parseFloat(latestAnswer)/1e8;

              //use the checkPrice function of the darknet contract to the price of the token in terms of eth
              const darknetContract = new ethers.Contract(contract_addresses.darknet, DarknetABI, provider);
              const lsdPrice = await darknetContract.checkPrice(log.address, {blockTag: blockNumber});
              const lsdPriceInEth = parseFloat(lsdPrice)/1e18;
              const lsdPriceInUSD = lsdPriceInEth * eth_price;

              totalFeeUSD+= parseFloat(depositFee)/1e18 * lsdPriceInUSD;
              break;
            }
          }
        }
      } catch (e) {
        console.error(`Error getting burn info: ${e}`);
      }
      }
    }

    // console.log({feeAmount});
    const totalSupply = parseFloat(await unshETHContract.totalSupply());

    //get price of unshETH in USD
    const LSDVault = new ethers.Contract(contract_addresses.LSDVault, LSDVaultABI, provider);
    const unshETHtoETH =  await LSDVault.stakedETHperunshETH();

    const chainlinkContract = new ethers.Contract(contract_addresses.chainlinkETHUSD, ChainlinkABI, provider);
    const latestAnswer = await chainlinkContract.latestAnswer();
    const TVL = (parseFloat(latestAnswer)/1e8) * (parseFloat(unshETHtoETH)/1e18) * (totalSupply/1e18);

    // console.log({totalSupply});
    const apr = ((totalFeeUSD * 52) / TVL) * 100;

    return apr;
  } catch (e) {
    console.error(`Error getting burn info: ${e}`);
  }
}

module.exports = {
  getDepositAPR,
};

