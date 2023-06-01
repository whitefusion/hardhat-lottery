import { VERIFICATION_BLOCK_CONFIRMATIONS, developmentChains, networkConfig } from '../helper-hardhat-config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import verify from '../utils/verify';

module.exports = async (hre: HardhatRuntimeEnvironment) => {
  const {getNamedAccounts, deployments, network, ethers} = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = network.config.chainId;
  const currNetworkConfig = networkConfig?.[chainId!] || {};
  const {
    vrfCoordinatorV2: testNetVrfCoordinatorV2,
    entranceFee,
    gasLane,
    subscriptionId: testNetSubscriptionId,
     callbackGasLimit,
    interval
  } = currNetworkConfig;
  let vrfCoordinatorV2Address, subscriptionId;
  const VRF_SUB_FUND_AMOUNT = ethers.utils.parseEther("2");
  const isDevChain = developmentChains?.includes(network?.name);
  if (isDevChain) {
    const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock");
    vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address;
    const transactionResponse = await vrfCoordinatorV2Mock.createSubscription();
    const transactionReceipt = await transactionResponse.wait(1);
    subscriptionId = transactionReceipt.events[0].args.subId;
    await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, VRF_SUB_FUND_AMOUNT);
  } else {
    vrfCoordinatorV2Address = testNetVrfCoordinatorV2;
    subscriptionId = testNetSubscriptionId;
  }

  const args = [vrfCoordinatorV2Address, entranceFee, gasLane, subscriptionId, callbackGasLimit, interval];
  const raffle = await deploy("Raffle", {
    from: deployer,
    args,
    log: true,
    waitConfirmations: isDevChain ? 1 : VERIFICATION_BLOCK_CONFIRMATIONS
  });

  if ( !developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY ) {
    log('verifying ...');
    await verify(raffle.address, args);
  }
  log('---------------------------------------------');
}

module.exports.tags = ['all', 'raffle'];
