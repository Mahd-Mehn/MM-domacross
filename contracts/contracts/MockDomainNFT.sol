// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract MockDomainNFT is ERC721, ERC721URIStorage, Ownable {
    using Counters for Counters.Counter;

    Counters.Counter private _tokenIdCounter;

    // Domain name to token ID mapping
    mapping(string => uint256) public domainToTokenId;
    mapping(uint256 => string) public tokenIdToDomain;

    event DomainMinted(uint256 indexed tokenId, string domain, address indexed owner);

    constructor(address _owner) ERC721("MockDomain", "MDOMAIN") Ownable(_owner) {}

    function mintDomain(address to, string memory domainName, string memory tokenURI) external onlyOwner returns (uint256) {
        require(domainToTokenId[domainName] == 0, "Domain already exists");

        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();

        _safeMint(to, tokenId);
        _setTokenURI(tokenId, tokenURI);

        domainToTokenId[domainName] = tokenId;
        tokenIdToDomain[tokenId] = domainName;

        emit DomainMinted(tokenId, domainName, to);
        return tokenId;
    }

    function getDomainName(uint256 tokenId) external view returns (string memory) {
        return tokenIdToDomain[tokenId];
    }

    function domainExists(string memory domainName) external view returns (bool) {
        return domainToTokenId[domainName] != 0;
    }

    // Override required functions
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        string memory domainName = tokenIdToDomain[tokenId];
        delete domainToTokenId[domainName];
        delete tokenIdToDomain[tokenId];
        super._burn(tokenId);
    }
}
