/**
 * @title Raffle contract
 * @author Xin Bai
 * @notice 1. enter amount 2. pick a random winner with VRF 3. selected every x minutes or so -> automated
 * @notice if we need random things, we need chainlink oracle;
 * @notice if we need automation like a trigger picker, we need chainlink keeper;
 */

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/AutomationCompatible.sol";

error Raffle__NotEnoughETHEntered();
error Raffle__TransferFailed();
error Raffle__NotOpen();
error Raffle__UpkeepNotNeeded(
  uint256 currentBalance,
  uint256 numPlayers,
  uint256 raffleState
);

/**
 * @title A sample Raffle contract
 * @author Xin Bai
 * @notice This contract creates an untamperable de-smart contract
 * @dev This contracts implements Chainlink VRF v2 and Chainlink Automation
 */
contract Raffle is VRFConsumerBaseV2, AutomationCompatibleInterface {
  /* Type Declaration */
  enum RaffleState {
    OPEN,
    CALCULATING
  }  // uint256 in deed, 0 = OPEN, 1 = CALCULATING

  /* State variables */
  uint256 private immutable i_entranceFee;
  address payable[] private s_players;
  bytes32 private immutable i_gasLane;
  uint64 private immutable i_subscriptionId;
  uint16 private constant REQUEST_CONFIRMATIONS = 3;
  uint32 private immutable i_callbackGasLimit;
  uint32 private constant NUM_WORDS = 1; 
  VRFCoordinatorV2Interface private immutable i_vrfCoordinator;

  /* Lottery Variables */
  address private s_recentWinner;
  RaffleState private s_raffleState;
  uint256 private s_lastTimestamp;
  uint256 private immutable i_interval;

  /* events */
  event RaffleEnter(address indexed player);
  event RequestedRaffleWinner(uint256 indexed requestId);
  event WinnerPicked(address indexed winner);

  constructor(
    address vrfCoordinatorV2,
    uint256 entranceFee,
    bytes32 gasLane,
    uint64 subscriptionId,
    uint32 callbackGasLimit,
    uint256 interval
  ) VRFConsumerBaseV2(vrfCoordinatorV2) {
    i_entranceFee = entranceFee;
    i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
    i_gasLane = gasLane;
    i_subscriptionId = subscriptionId;
    i_callbackGasLimit = callbackGasLimit;
    s_raffleState = RaffleState.OPEN;
    s_lastTimestamp = block.timestamp;
    i_interval = interval;
  }

  function enterRaffle() public payable {
    // alternative:  require(msg.value > i_entranceFee, 'Not enough ETH');
    // but to save gas, we prefer(best practice): 
    if (msg.value < i_entranceFee) {
      revert Raffle__NotEnoughETHEntered();
    }

    if (s_raffleState != RaffleState.OPEN) {
      revert Raffle__NotOpen();
    }

    // cast to a payable address
    s_players.push(payable(msg.sender));

    // named convention with function name reversed
    emit RaffleEnter(msg.sender);
  }

  /**
   * calldata returned by checkUpKeep will be passed to performUpkeep
   */
  function performUpkeep(bytes memory /* performData */) external override {
    (bool upkeepNeeded, ) = checkUpkeep(bytes(""));
    if (!upkeepNeeded) {
      revert Raffle__UpkeepNotNeeded(address(this).balance, s_players.length, uint256(s_raffleState));
    }
    s_raffleState = RaffleState.CALCULATING;
    // Will revert if subscription is not set and funded.
    uint256 requestId = i_vrfCoordinator.requestRandomWords(
        i_gasLane, // gasLane 煤气管
        i_subscriptionId,
        REQUEST_CONFIRMATIONS,
        i_callbackGasLimit,
        NUM_WORDS
    );
    emit RequestedRaffleWinner(requestId);
  }

  /**
   * it is said that we can do many advanced things with 'bytes'
   * @dev this is the function that chainlink automation nodes call
   * they look for upkeep needed to return true
   * the following should be true in order to return true:
   * 1. our time interval should have passed
   * 2. the lottery should have at least 1 player and have some ETH
   * 3. our subscription should funded with some LINK 
   * 4. the lottery should be in an "active" status. the lottery should inactive while waiting for random number
   */
  function checkUpkeep(bytes memory /* checkdata */)
    public override
    returns(bool upkeepNeeded, bytes memory /* performData */)
  {
    bool isOpen = s_raffleState == RaffleState.OPEN;
    bool timePassed = (block.timestamp - s_lastTimestamp) > i_interval;
    bool hasPlayers = s_players.length > 0;
    bool hasBalance = address(this).balance > 0;
    upkeepNeeded = (isOpen && timePassed && hasPlayers && hasBalance);
    return (upkeepNeeded, "0x0");
  }

  /**
   * "randomWords" are computer terminology, it's actually random number
   */
  function fulfillRandomWords(
    uint256, /* requestId, 占位子的 没用但是需要 */
    uint256[] memory randomWords
  ) internal override {
    uint256 indexOfWinner = randomWords[0] % (s_players.length);
    address payable recentWinner = s_players[indexOfWinner];
    s_recentWinner = recentWinner;
    s_raffleState = RaffleState.OPEN;
    s_players = new address payable[](0);
    s_lastTimestamp = block.timestamp;
    // TODO: weired !!!
    (bool success, ) = recentWinner.call{value: address(this).balance}("");
    if (!success) {
      revert Raffle__TransferFailed();
    }
    emit WinnerPicked(recentWinner);
  }

  /* View / Pure Functions */

  function getEntranceFee() public view returns(uint256) {
    return i_entranceFee;
  }

  function getPlayer(uint256 index) public view returns(address) {
    return s_players[index];
  }

  function getRecentWinner() public view returns(address) {
    return s_recentWinner;
  }

  function getRaffleState() public view returns(RaffleState) {
    return s_raffleState;
  }

  /**
   * constant isn't reading from storage, equivalent to get 1
   */
  function getNumWords() public pure returns(uint256) {
    return NUM_WORDS;
  }
  
  function getNumberOfPlayers() public view returns(uint256) {
    return s_players.length;
  }

  function getLatestTimestamp() public view returns(uint256) {
    return s_lastTimestamp;
  }

  function getRequestConfirmations() public pure returns(uint256) {
    return REQUEST_CONFIRMATIONS;
  }
}
