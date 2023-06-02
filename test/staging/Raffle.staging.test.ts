import { VRFCoordinatorV2Mock } from './../../typechain-types/@chainlink/contracts/src/v0.8/mocks/VRFCoordinatorV2Mock';
import { Raffle } from './../../typechain-types/contracts/Raffle';
import { expect, assert } from 'chai';
import { deployments, ethers, getNamedAccounts, network } from 'hardhat';
import { developmentChains, networkConfig } from '../../helper-hardhat-config';

developmentChains?.includes(network?.name) 
? describe.skip
: describe("Raffle", async function() { 
  let raffle: Raffle, raffleEntranceFee: any, deployer: string;
  const { chainId } = network?.config;
  const { interval } = (networkConfig as any)?.[chainId!];
  beforeEach(async function() {
   const accounts = await getNamedAccounts();
   deployer = accounts?.deployer;
   raffle = await ethers.getContract("Raffle", deployer);
    raffleEntranceFee = await raffle.getEntranceFee(); 
  });
  describe("fulfillRandomWords", () => {
    it("works with live chainlink automation and chainlink vrf, we get a random winner", async () => {
      console.log("set up test");
      const startingTimestamp = await raffle.getLatestTimestamp();
      const accounts =  await ethers.getSigners();
      console.log("set up listener");

      await new Promise(async (resolve, reject) => {

        raffle.once('WinnerPicked', async () => {
          console.log('winnerPicked event fired');
          try {
            // only one in the raffle
            const recentWinner = await raffle.getRecentWinner();
            const winnerEndingBalance = await accounts[0].getBalance();
            const raffleState = await raffle.getRaffleState();
            const endingTimestamp = await raffle.getLatestTimestamp();
            const numPlayers = await raffle.getNumberOfPlayers();
            
            // 此时已经没有player
            await expect(raffle.getPlayer(0)).to.be.reverted;
            assert.equal(numPlayers.toString(), '0');
            assert.equal(raffleState.toString(), '0');
            assert.equal(recentWinner.toString(), accounts[0].address);
            assert.equal(
              winnerEndingBalance.toString(),
              winnerStartingBalance.add(raffleEntranceFee).toString()
            );
            assert(endingTimestamp > startingTimestamp);
            resolve(0);
          } catch(e) {
            reject(e);
          }
        }); 
        console.log('enter raffle');
        const tx = await raffle.enterRaffle({ value: raffleEntranceFee });
        await tx.wait(1);
        const winnerStartingBalance = await accounts[0].getBalance();
      });
    });
  })
});