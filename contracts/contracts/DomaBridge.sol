// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract DomaBridge is Ownable {
    mapping(uint256 => bool) public bridgedDomains; // tokenId => bridged
    mapping(uint256 => uint256) public sourceChain; // tokenId => source chain

    event DomainBridged(address indexed user, address tokenContract, uint256 tokenId, uint256 targetChain, uint256 sourceChain);
    event DomainReceived(address indexed user, address tokenContract, uint256 tokenId, uint256 fromChain);

    constructor(address _owner) Ownable(_owner) {}

    function bridgeDomain(address _tokenContract, uint256 _tokenId, uint256 _targetChain) external {
        IERC721 token = IERC721(_tokenContract);
        require(token.ownerOf(_tokenId) == msg.sender, "Not owner");
        require(!bridgedDomains[_tokenId], "Already bridged");

        // Lock the domain on source chain
        token.transferFrom(msg.sender, address(this), _tokenId);

        bridgedDomains[_tokenId] = true;
        sourceChain[_tokenId] = block.chainid;

        // Emit event for off-chain processing
        emit DomainBridged(msg.sender, _tokenContract, _tokenId, _targetChain, block.chainid);
    }

    function receiveDomain(address _user, address _tokenContract, uint256 _tokenId, uint256 _fromChain) external onlyOwner {
        // Mint or unlock on target chain
        bridgedDomains[_tokenId] = false;
        emit DomainReceived(_user, _tokenContract, _tokenId, _fromChain);
    }

    function isBridged(uint256 _tokenId) external view returns (bool) {
        return bridgedDomains[_tokenId];
    }
}
