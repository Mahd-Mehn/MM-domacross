// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract DomainBasket is ERC721, ERC721URIStorage, Ownable {
    using Counters for Counters.Counter;

    struct BasketComposition {
        address[] domainContracts;
        uint256[] tokenIds;
        uint256[] weights; // Percentage weights (basis points, 10000 = 100%)
        uint256 totalValue;
        uint256 createdAt;
    }

    Counters.Counter private _tokenIdCounter;
    mapping(uint256 => BasketComposition) public baskets;
    mapping(uint256 => address) public basketCreators;

    event BasketCreated(uint256 indexed basketId, address indexed creator, uint256 value);
    event BasketTraded(uint256 indexed basketId, address indexed from, address indexed to, uint256 price);

    constructor(address _owner) ERC721("DomainBasket", "DBASKET") Ownable(_owner) {}

    function createBasket(
        address[] memory _domainContracts,
        uint256[] memory _tokenIds,
        uint256[] memory _weights,
        string memory _tokenURI
    ) external returns (uint256) {
        require(_domainContracts.length == _tokenIds.length, "Arrays length mismatch");
        require(_domainContracts.length == _weights.length, "Weights array length mismatch");

        uint256 totalWeight = 0;
        for (uint256 i = 0; i < _weights.length; i++) {
            totalWeight += _weights[i];
        }
        require(totalWeight == 10000, "Total weight must be 10000 basis points");

        // Transfer domains to this contract
        for (uint256 i = 0; i < _domainContracts.length; i++) {
            ERC721 domainContract = ERC721(_domainContracts[i]);
            require(domainContract.ownerOf(_tokenIds[i]) == msg.sender, "Not owner of domain");
            domainContract.safeTransferFrom(msg.sender, address(this), _tokenIds[i]);
        }

        uint256 basketId = _tokenIdCounter.current();
        _tokenIdCounter.increment();

        baskets[basketId] = BasketComposition({
            domainContracts: _domainContracts,
            tokenIds: _tokenIds,
            weights: _weights,
            totalValue: 0, // Will be calculated by oracle
            createdAt: block.timestamp
        });

        basketCreators[basketId] = msg.sender;
        _safeMint(msg.sender, basketId);
        _setTokenURI(basketId, _tokenURI);

        emit BasketCreated(basketId, msg.sender, 0);
        return basketId;
    }

    function redeemBasket(uint256 _basketId) external {
        require(ownerOf(_basketId) == msg.sender, "Not owner of basket");

        BasketComposition memory basket = baskets[_basketId];

        // Transfer domains back to owner
        for (uint256 i = 0; i < basket.domainContracts.length; i++) {
            ERC721(basket.domainContracts[i]).safeTransferFrom(
                address(this),
                msg.sender,
                basket.tokenIds[i]
            );
        }

        // Burn the basket NFT
        _burn(_basketId);
        delete baskets[_basketId];
        delete basketCreators[_basketId];
    }

    function getBasketComposition(uint256 _basketId) external view returns (
        address[] memory domainContracts,
        uint256[] memory tokenIds,
        uint256[] memory weights,
        uint256 totalValue,
        uint256 createdAt
    ) {
        BasketComposition memory basket = baskets[_basketId];
        return (
            basket.domainContracts,
            basket.tokenIds,
            basket.weights,
            basket.totalValue,
            basket.createdAt
        );
    }

    function updateBasketValue(uint256 _basketId, uint256 _newValue) external onlyOwner {
        baskets[_basketId].totalValue = _newValue;
    }

    // Override required functions
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }
}
