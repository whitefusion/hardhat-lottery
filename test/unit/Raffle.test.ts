import { VRFCoordinatorV2Mock } from './../../typechain-types/@chainlink/contracts/src/v0.8/mocks/VRFCoordinatorV2Mock';
import { Raffle } from './../../typechain-types/contracts/Raffle';
import { expect, assert } from 'chai';
import { deployments, ethers, getNamedAccounts, network } from 'hardhat';
import { developmentChains, networkConfig } from '../../helper-hardhat-config';

const isDevChain = developmentChains.includes(network.name);

!isDevChain
? describe.skip
: describe("Raffle", async function() {
   let raffle: Raffle, vrfCoordinatorV2Mock: VRFCoordinatorV2Mock, raffleEntranceFee: any, deployer: string;
   const { chainId } = network?.config;
   const { interval } = (networkConfig as any)?.[chainId!];
   beforeEach(async function() {
    const accounts = await getNamedAccounts();
    deployer = accounts?.deployer;
    await deployments.fixture(["all"]);
    raffle = await ethers.getContract("Raffle", deployer);
    vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer);
    raffleEntranceFee = await raffle.getEntranceFee(); 
   })
   describe("constructor", async function() {
    it("initializes the raffle correctly", async () => {
      const raffleState =  await raffle.getRaffleState();
      const interval = await raffle.getInterval();
      assert.equal(raffleState.toString(), '0');
      assert.equal(interval.toString(), interval.toString());
    });
   });
   describe("enterRaffle", async function(){
    it("reverts when u don't pay enough", async () => {
      expect(raffle.enterRaffle()).to.be.revertedWith("Raffle__NotEnoughETHEntered");
    });
    it("records players when they enter", async () => {
      await raffle.enterRaffle({ value: raffleEntranceFee });
      const playerFromContract = await raffle.getPlayer(0);
      assert.equal(playerFromContract, deployer);
    });
    it("emits events on enter", async () => {
      await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.emit(raffle, 'RaffleEnter');
    });
    it("doesn't allow entrace when raffle is calculating", async () => {
      await raffle.enterRaffle({ value: raffleEntranceFee });
      const tempTime = parseInt(interval) + 1;
      await network.provider.send("evm_increaseTime", [tempTime]);
      await network.provider.send("evm_mine", []);
      // pretend to be a chainlink keeper
      await raffle.performUpkeep([]);
      await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.be.revertedWithCustomError(raffle, "Raffle__NotOpen")
    });
   });
   describe("checkup keep", async () => {
    it("returns false if people haven't sent any ETH", async () => {
      const tempTime = parseInt(interval) + 1;
      await network.provider.send("evm_increaseTime", [tempTime]);
      await network.provider.send("evm_mine", []);
      // pretend to be a chainlink keeper
      const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]);
      assert(!upkeepNeeded);
    });
    it("returns false if raffle is not open", async () => {
      await raffle.enterRaffle({ value: raffleEntranceFee });
      const tempTime = parseInt(interval) + 1;
      await network.provider.send("evm_increaseTime", [tempTime]);
      await network.provider.send("evm_mine", []);
      // pretend to be a chainlink keeper
      await raffle.performUpkeep([]);
      const raffleState = await raffle.getRaffleState();
      const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]);
      assert.equal(raffleState.toString(), '1');
      assert(!upkeepNeeded);
    });
    it("returns false if time isn't up", async () => {
      await raffle.enterRaffle({ value: raffleEntranceFee });
      const tempTime = parseInt(interval) - 1;
      await network.provider.send("evm_increaseTime", [tempTime]);
      await network.provider.send("evm_mine", []);
      // pretend to be a chainlink keeper
      const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x");
      assert(!upkeepNeeded);
   });
   it("returns true if time passed, raffle open && ETH sent", async () => {
    await raffle.enterRaffle({ value: raffleEntranceFee });
    const tempTime = parseInt(interval) + 1;
    await network.provider.send("evm_increaseTime", [tempTime]);
    await network.provider.send("evm_mine", []);
    // pretend to be a chainlink keeper
    const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x");
    assert(upkeepNeeded);
   })
  });
  describe("performUpkeep", () => {
    it("can only run if checkupkeep returns true", async () => {
      await raffle.enterRaffle({ value: raffleEntranceFee });
      const tempTime = parseInt(interval) + 1;
      await network.provider.send("evm_increaseTime", [tempTime]);
      await network.provider.send("evm_mine", []);
      const tx = await raffle.performUpkeep([]);
      assert(tx);
    });
    it("reverts when checkupkeep is false", async () => {
      await expect(raffle.performUpkeep([]))
      .to.be.revertedWithCustomError(raffle, 'Raffle__UpkeepNotNeeded')
      .withArgs(0, 0, 0);
    });
    it("updates raffle state, emits events and calls vrfCoordinator", async () => {
      await raffle.enterRaffle({ value: raffleEntranceFee });
      const tempTime = parseInt(interval) + 1;
      await network.provider.send("evm_increaseTime", [tempTime]);
      await network.provider.send("evm_mine", []);
      const tx = await raffle.performUpkeep([]);
      const txReceipt = await tx.wait(1);
      const requestId = txReceipt?.events?.[1]?.args?.requestId;
      const raffleState = await raffle.getRaffleState();
      assert(parseInt(requestId) > 0);
      assert(raffleState.toString() === '1');
    });
  });
  describe("fulfillRandomWords", () => {
    beforeEach(async () => {
      await raffle.enterRaffle({ value: raffleEntranceFee });
      const tempTime = parseInt(interval) + 1;
      await network.provider.send("evm_increaseTime", [tempTime]);
      await network.provider.send("evm_mine", []);
    });
    it("can only be called after performupkeep", async () => {
      await expect(
        vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address)
      ).to.be.revertedWith("nonexistent request");
      await expect(
        vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.address)
      ).to.be.revertedWith("nonexistent request");
    });
    it("picks a winner, reset the lottery, and sends money", async () => {
      const additionalEntrants = 3;
      const startingAccountIndex = 1;
      const accounts = await ethers.getSigners();
      for( let i = startingAccountIndex; i < startingAccountIndex + additionalEntrants; i++) {
        const accountConnectedRaffle = raffle.connect(accounts[i]);
        await accountConnectedRaffle.enterRaffle({ value: raffleEntranceFee });
      }
      const startingTimestamp = await raffle.getLatestTimestamp();
      await new Promise(async (resolve, reject) => {
        raffle.once('WinnerPicked', async () => {
          try {
            /*  the winner will always be accounts[0] in test
                const recentWinner = await raffle.getRecentWinner();
                console.log('recentWinner', recentWinner);
                console.log('0', accounts[0].address);
                console.log('1', accounts[1].address);
                console.log('2', accounts[2].address);
                console.log('3', accounts[3].address);
            */
            const winnerEndingBalance = await accounts[1].getBalance();
            const raffleState = await raffle.getRaffleState();
            const endingTimestamp = await raffle.getLatestTimestamp();
            const numPlayers = await raffle.getNumberOfPlayers();
            
            assert.equal(numPlayers.toString(), '0');
            assert.equal(raffleState.toString(), '0');
            assert(endingTimestamp > startingTimestamp);
            assert.equal(
              winnerEndingBalance.toString(),
              winnerStartingBalance.add(raffleEntranceFee.mul(additionalEntrants+1)).toString()
            );
          } catch(e) {
            reject(e);
          }
          resolve(0);
        });

        const tx = await raffle.performUpkeep([]);
        const txReceipt = await tx.wait(1);
        const winnerStartingBalance = await accounts[1].getBalance();
        await vrfCoordinatorV2Mock.fulfillRandomWords(txReceipt?.events?.[1]?.args?.requestId, raffle.address);
      });

    })
  })
});
