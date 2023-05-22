import { BigNumber, utils } from 'ethers';
export const VERIFICATION_BLOCK_CONFIRMATIONS = 6;
export interface networkConfigItem {
  ethUsdPriceFeed?: string;
  blockConfirmations?: number;
  name?: string;
  vrfCoordinatorV2?: string;
  entranceFee?: BigNumber;
  gasLane?: string;
}
export interface networkConfigInfo {
  [key: string]: networkConfigItem,
}
export const networkConfig: networkConfigInfo = {
  11155111: {
    name: "sepolia",
    vrfCoordinatorV2: "0x8103B0A8A00be2DDC778e6e7eaa21791Cd364625",
    entranceFee: utils.parseEther('0.01'),
    gasLane: "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c"
  },
  31337: {
    name: "hardhat",
    entranceFee: utils.parseEther('0.01'),
    gasLane: "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c"
  }
}

export const developmentChains = ["hardhat", "localhost"];
