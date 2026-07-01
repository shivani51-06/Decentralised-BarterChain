// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract BarterEscrow {
    address public owner;
    uint256 public tradeCount;

    struct Trade {
        address userA;
        address userB;
        uint256 stakeAmount; // per-user stake, set by first depositor
        bool userAStaked;
        bool userBStaked;
        bool userAConfirmed;
        bool userBConfirmed;
        bool isActive;
        bool isDisputed;
        uint256 createdAt;
    }

    mapping(uint256 => Trade) public trades;

    event TradeCreated(uint256 indexed tradeId, address indexed userA, address indexed userB);
    event StakeDeposited(uint256 indexed tradeId, address indexed depositor, uint256 amount);
    event TradeConfirmed(uint256 indexed tradeId, address indexed confirmedBy);
    event TradeCompleted(uint256 indexed tradeId);
    event DisputeRaised(uint256 indexed tradeId, address indexed raisedBy);
    event DisputeResolved(uint256 indexed tradeId, address indexed winner);
    event TradeCancelled(uint256 indexed tradeId);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier tradeActive(uint256 tradeId) {
        require(trades[tradeId].isActive, "Trade not active");
        _;
    }

    modifier onlyParticipant(uint256 tradeId) {
        require(
            msg.sender == trades[tradeId].userA || msg.sender == trades[tradeId].userB,
            "Not a participant"
        );
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // 1. UserA initiates a trade with userB
    function createTrade(address _userB) external returns (uint256 tradeId) {
        require(_userB != address(0), "Invalid userB address");
        require(_userB != msg.sender, "Cannot trade with yourself");

        tradeId = tradeCount;
        tradeCount++;

        trades[tradeId] = Trade({
            userA: msg.sender,
            userB: _userB,
            stakeAmount: 0,
            userAStaked: false,
            userBStaked: false,
            userAConfirmed: false,
            userBConfirmed: false,
            isActive: true,
            isDisputed: false,
            createdAt: block.timestamp
        });

        emit TradeCreated(tradeId, msg.sender, _userB);
    }

    // 2. Both users deposit equal stake. First depositor sets the amount.
    function depositStake(uint256 tradeId)
        external
        payable
        tradeActive(tradeId)
        onlyParticipant(tradeId)
    {
        Trade storage t = trades[tradeId];
        require(!t.isDisputed, "Trade is disputed");
        require(msg.value > 0, "Must send MATIC");

        if (t.stakeAmount == 0) {
            t.stakeAmount = msg.value;
        } else {
            require(msg.value == t.stakeAmount, "Must match the first deposit amount");
        }

        if (msg.sender == t.userA) {
            require(!t.userAStaked, "UserA already staked");
            t.userAStaked = true;
        } else {
            require(!t.userBStaked, "UserB already staked");
            t.userBStaked = true;
        }

        emit StakeDeposited(tradeId, msg.sender, msg.value);
    }

    // 3. Confirm receipt. If both confirm, stakes are released back.
    function confirmTrade(uint256 tradeId)
        external
        tradeActive(tradeId)
        onlyParticipant(tradeId)
    {
        Trade storage t = trades[tradeId];
        require(!t.isDisputed, "Trade is disputed");
        require(t.userAStaked && t.userBStaked, "Both parties must stake first");

        if (msg.sender == t.userA) {
            require(!t.userAConfirmed, "UserA already confirmed");
            t.userAConfirmed = true;
        } else {
            require(!t.userBConfirmed, "UserB already confirmed");
            t.userBConfirmed = true;
        }

        emit TradeConfirmed(tradeId, msg.sender);

        if (t.userAConfirmed && t.userBConfirmed) {
            _releaseFunds(tradeId);
        }
    }

    // Internal: refund both stakes in full on mutual confirmation
    function _releaseFunds(uint256 tradeId) internal {
        Trade storage t = trades[tradeId];
        t.isActive = false;
        uint256 amount = t.stakeAmount;
        payable(t.userA).transfer(amount);
        payable(t.userB).transfer(amount);
        emit TradeCompleted(tradeId);
    }

    // 4. Raise a dispute - freezes funds pending admin resolution
    function raiseDispute(uint256 tradeId)
        external
        tradeActive(tradeId)
        onlyParticipant(tradeId)
    {
        Trade storage t = trades[tradeId];
        require(t.userAStaked && t.userBStaked, "Both parties must stake first");
        require(!t.isDisputed, "Already disputed");

        t.isDisputed = true;
        emit DisputeRaised(tradeId, msg.sender);
    }

    // 5. Admin resolves dispute with partial penalty.
    //    Penalty math (S = stakeAmount per user):
    //      winner  gets S         (their 70% refund + loser's 30% penalty)
    //      loser   gets 0.7 * S
    //      owner   gets 0.3 * S   (admin fee)
    //      total out = S + 0.7S + 0.3S = 2S (matches total held)
    function resolveDispute(uint256 tradeId, address winner)
        external
        onlyOwner
        tradeActive(tradeId)
    {
        Trade storage t = trades[tradeId];
        require(t.isDisputed, "Trade is not disputed");
        require(winner == t.userA || winner == t.userB, "Winner must be a participant");

        address loser = (winner == t.userA) ? t.userB : t.userA;
        uint256 stake = t.stakeAmount;
        uint256 penalty = stake * 30 / 100;
        uint256 loserRefund = stake - penalty;        // 70%
        uint256 winnerPayout = loserRefund + penalty; // 100% (= stake)

        t.isActive = false;

        payable(winner).transfer(winnerPayout);
        payable(loser).transfer(loserRefund);
        payable(owner).transfer(penalty);

        emit DisputeResolved(tradeId, winner);
    }

    // 6. Cancel trade - refunds any partial deposit if not both parties staked yet
    function cancelTrade(uint256 tradeId)
        external
        tradeActive(tradeId)
        onlyParticipant(tradeId)
    {
        Trade storage t = trades[tradeId];
        require(
            !(t.userAStaked && t.userBStaked),
            "Both already staked - raise a dispute instead"
        );

        t.isActive = false;

        if (t.userAStaked) payable(t.userA).transfer(t.stakeAmount);
        if (t.userBStaked) payable(t.userB).transfer(t.stakeAmount);

        emit TradeCancelled(tradeId);
    }

    receive() external payable {}
}
