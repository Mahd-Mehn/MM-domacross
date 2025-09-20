// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title DomainDealManager
 * @dev Manages time-boxed offers with on-chain IDs linked to XMTP chat threads
 */
contract DomainDealManager is Ownable, ReentrancyGuard {
    using Counters for Counters.Counter;
    
    Counters.Counter private _offerIds;
    
    struct TimedOffer {
        uint256 id;
        address offerer;
        string domainName;
        uint256 amount;
        uint256 expiresAt;
        string xmtpThreadId;
        bool accepted;
        bool cancelled;
        string message;
    }
    
    // Mapping from offer ID to offer details
    mapping(uint256 => TimedOffer) public offers;
    
    // Mapping from domain name to offer IDs
    mapping(string => uint256[]) public domainOffers;
    
    // Mapping from offerer to their offer IDs
    mapping(address => uint256[]) public userOffers;
    
    // Events
    event OfferCreated(
        uint256 indexed offerId,
        address indexed offerer,
        string domainName,
        uint256 amount,
        uint256 expiresAt,
        string xmtpThreadId
    );
    
    event OfferAccepted(
        uint256 indexed offerId,
        address indexed seller,
        uint256 amount
    );
    
    event OfferCancelled(uint256 indexed offerId);
    
    event ChatThreadLinked(
        uint256 indexed offerId,
        string xmtpThreadId
    );
    
    /**
     * @dev Create a time-boxed offer for a domain
     * @param _domainName The domain name
     * @param _duration Duration in seconds for the offer validity
     * @param _message Optional message for the offer
     * @return offerId The ID of the created offer
     */
    function createOffer(
        string calldata _domainName,
        uint256 _duration,
        string calldata _message
    ) external payable nonReentrant returns (uint256) {
        require(msg.value > 0, "Offer amount must be greater than 0");
        require(_duration > 0 && _duration <= 7 days, "Invalid duration");
        require(bytes(_domainName).length > 0, "Domain name required");
        
        _offerIds.increment();
        uint256 offerId = _offerIds.current();
        uint256 expiresAt = block.timestamp + _duration;
        
        // Generate deterministic XMTP thread ID
        string memory xmtpThreadId = string(
            abi.encodePacked(
                "domain-deal-",
                _domainName,
                "-",
                toString(offerId)
            )
        );
        
        offers[offerId] = TimedOffer({
            id: offerId,
            offerer: msg.sender,
            domainName: _domainName,
            amount: msg.value,
            expiresAt: expiresAt,
            xmtpThreadId: xmtpThreadId,
            accepted: false,
            cancelled: false,
            message: _message
        });
        
        domainOffers[_domainName].push(offerId);
        userOffers[msg.sender].push(offerId);
        
        emit OfferCreated(
            offerId,
            msg.sender,
            _domainName,
            msg.value,
            expiresAt,
            xmtpThreadId
        );
        
        emit ChatThreadLinked(offerId, xmtpThreadId);
        
        return offerId;
    }
    
    /**
     * @dev Accept an offer (only domain owner can accept)
     * @param _offerId The ID of the offer to accept
     */
    function acceptOffer(uint256 _offerId) external nonReentrant {
        TimedOffer storage offer = offers[_offerId];
        
        require(offer.id != 0, "Offer does not exist");
        require(!offer.accepted, "Offer already accepted");
        require(!offer.cancelled, "Offer cancelled");
        require(block.timestamp <= offer.expiresAt, "Offer expired");
        
        offer.accepted = true;
        
        // Transfer funds to seller
        payable(msg.sender).transfer(offer.amount);
        
        emit OfferAccepted(_offerId, msg.sender, offer.amount);
    }
    
    /**
     * @dev Cancel an offer (only offerer can cancel)
     * @param _offerId The ID of the offer to cancel
     */
    function cancelOffer(uint256 _offerId) external nonReentrant {
        TimedOffer storage offer = offers[_offerId];
        
        require(offer.id != 0, "Offer does not exist");
        require(offer.offerer == msg.sender, "Only offerer can cancel");
        require(!offer.accepted, "Offer already accepted");
        require(!offer.cancelled, "Offer already cancelled");
        
        offer.cancelled = true;
        
        // Refund the offer amount
        payable(msg.sender).transfer(offer.amount);
        
        emit OfferCancelled(_offerId);
    }
    
    /**
     * @dev Withdraw expired offer funds
     * @param _offerId The ID of the expired offer
     */
    function withdrawExpiredOffer(uint256 _offerId) external nonReentrant {
        TimedOffer storage offer = offers[_offerId];
        
        require(offer.id != 0, "Offer does not exist");
        require(offer.offerer == msg.sender, "Only offerer can withdraw");
        require(!offer.accepted, "Offer already accepted");
        require(!offer.cancelled, "Offer already cancelled");
        require(block.timestamp > offer.expiresAt, "Offer not expired");
        
        offer.cancelled = true;
        
        // Refund the expired offer amount
        payable(msg.sender).transfer(offer.amount);
        
        emit OfferCancelled(_offerId);
    }
    
    /**
     * @dev Get offer details
     * @param _offerId The ID of the offer
     */
    function getOffer(uint256 _offerId) external view returns (TimedOffer memory) {
        return offers[_offerId];
    }
    
    /**
     * @dev Get all offers for a domain
     * @param _domainName The domain name
     */
    function getDomainOffers(string calldata _domainName) external view returns (uint256[] memory) {
        return domainOffers[_domainName];
    }
    
    /**
     * @dev Get all offers by a user
     * @param _user The user address
     */
    function getUserOffers(address _user) external view returns (uint256[] memory) {
        return userOffers[_user];
    }
    
    /**
     * @dev Check if an offer is active
     * @param _offerId The ID of the offer
     */
    function isOfferActive(uint256 _offerId) external view returns (bool) {
        TimedOffer memory offer = offers[_offerId];
        return offer.id != 0 && 
               !offer.accepted && 
               !offer.cancelled && 
               block.timestamp <= offer.expiresAt;
    }
    
    /**
     * @dev Get XMTP thread ID for an offer
     * @param _offerId The ID of the offer
     */
    function getXMTPThreadId(uint256 _offerId) external view returns (string memory) {
        require(offers[_offerId].id != 0, "Offer does not exist");
        return offers[_offerId].xmtpThreadId;
    }
    
    /**
     * @dev Helper function to convert uint to string
     */
    function toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
