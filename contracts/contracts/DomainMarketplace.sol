// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./ValuationOracle.sol";

contract DomainMarketplace is Ownable {
    ValuationOracle public immutable valuationOracle;
    IERC20 public immutable usdcToken;

    struct Order {
        address seller;
        address domainContract;
        uint256 tokenId;
        uint256 price;
        bool active;
    }

    struct Trade {
        address buyer;
        address seller;
        address domainContract;
        uint256 tokenId;
        uint256 price;
        uint256 timestamp;
    }

    mapping(uint256 => Order) public orders;
    mapping(address => uint256[]) public userOrders;
    mapping(address => uint256[]) public userTrades;

    uint256 public nextOrderId = 1;
    uint256 public nextTradeId = 1;

    Trade[] public trades;

    event OrderCreated(uint256 indexed orderId, address indexed seller, address domainContract, uint256 tokenId, uint256 price);
    event OrderCancelled(uint256 indexed orderId);
    event TradeExecuted(uint256 indexed tradeId, address indexed buyer, address indexed seller, uint256 price);

    constructor(address _valuationOracle, address _usdcToken, address _owner) Ownable(_owner) {
        valuationOracle = ValuationOracle(_valuationOracle);
        usdcToken = IERC20(_usdcToken);
    }

    function createOrder(address _domainContract, uint256 _tokenId, uint256 _price) external {
        require(_price > 0, "Price must be greater than 0");

        IERC721 domainToken = IERC721(_domainContract);
        require(domainToken.ownerOf(_tokenId) == msg.sender, "Not the owner of this domain");
        require(domainToken.getApproved(_tokenId) == address(this) ||
                domainToken.isApprovedForAll(msg.sender, address(this)), "Marketplace not approved");

        uint256 orderId = nextOrderId++;
        orders[orderId] = Order({
            seller: msg.sender,
            domainContract: _domainContract,
            tokenId: _tokenId,
            price: _price,
            active: true
        });

        userOrders[msg.sender].push(orderId);

        emit OrderCreated(orderId, msg.sender, _domainContract, _tokenId, _price);
    }

    function cancelOrder(uint256 _orderId) external {
        Order storage order = orders[_orderId];
        require(order.seller == msg.sender, "Not the seller of this order");
        require(order.active, "Order not active");

        order.active = false;
        emit OrderCancelled(_orderId);
    }

    function buyDomain(uint256 _orderId) external {
        Order storage order = orders[_orderId];
        require(order.active, "Order not active");
        require(order.seller != msg.sender, "Cannot buy your own domain");

        // Transfer USDC from buyer to seller
        require(usdcToken.transferFrom(msg.sender, order.seller, order.price), "USDC transfer failed");

        // Transfer domain from seller to buyer
        IERC721 domainToken = IERC721(order.domainContract);
        domainToken.safeTransferFrom(order.seller, msg.sender, order.tokenId);

        // Record trade
        uint256 tradeId = nextTradeId++;
        trades.push(Trade({
            buyer: msg.sender,
            seller: order.seller,
            domainContract: order.domainContract,
            tokenId: order.tokenId,
            price: order.price,
            timestamp: block.timestamp
        }));

        userTrades[msg.sender].push(tradeId);
        userTrades[order.seller].push(tradeId);

        // Deactivate order
        order.active = false;

        emit TradeExecuted(tradeId, msg.sender, order.seller, order.price);
    }

    function getActiveOrders() external view returns (uint256[] memory) {
        uint256[] memory activeOrders = new uint256[](nextOrderId - 1);
        uint256 count = 0;

        for (uint256 i = 1; i < nextOrderId; i++) {
            if (orders[i].active) {
                activeOrders[count] = i;
                count++;
            }
        }

        // Resize array to actual count
        assembly {
            mstore(activeOrders, count)
        }

        return activeOrders;
    }

    function getUserOrders(address _user) external view returns (uint256[] memory) {
        return userOrders[_user];
    }

    function getUserTrades(address _user) external view returns (uint256[] memory) {
        return userTrades[_user];
    }

    function getTrade(uint256 _tradeId) external view returns (Trade memory) {
        require(_tradeId > 0 && _tradeId < nextTradeId, "Invalid trade ID");
        return trades[_tradeId - 1];
    }

    function getTradesCount() external view returns (uint256) {
        return trades.length;
    }
}
