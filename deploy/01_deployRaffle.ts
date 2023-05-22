import { VERIFICATION_BLOCK_CONFIRMATIONS, developmentChains, networkConfig } from '../helper-hardhat-config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

module.exports = async (hre: HardhatRuntimeEnvironment) => {
  const {getNamedAccounts, deployments, network, ethers} = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = network.config.chainId;
  const currNetworkConfig = networkConfig?.[chainId!] || {};
  const { vrfCoordinatorV2, entranceFee, gasLane } = currNetworkConfig;
  let vrfCoordinatorV2Address, subscriptionId;

  if (developmentChains.includes(network.name)) {
    const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock");
    vrfCoordinatorV2Address = vrfCoordinatorV2Mock;
  } else {
    vrfCoordinatorV2Address = vrfCoordinatorV2;
  }

  const args = [vrfCoordinatorV2Address, entranceFee, gasLane];
  const raffle = await deploy("Raffle", {
    from: deployer,
    args: [],
    log: true,
    waitConfirmations: VERIFICATION_BLOCK_CONFIRMATIONS
  });
}