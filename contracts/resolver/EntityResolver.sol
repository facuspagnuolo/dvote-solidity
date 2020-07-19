// // SPDX-License-Identifier: AGPL-3.0-or-later
// pragma solidity ^0.6.0;
// pragma experimental ABIEncoderV2;

// import "./PublicResolver.sol";

// // tmp contract until TextListResolver is standarized
// abstract contract EntityResolver is PublicResolver {
//     function isAuthorised(bytes32 node) internal override view returns (bool) {
//         // The hash of the entity address must be the node
//         if (super.isAuthorised(node)) {
//             return true;
//         }
//         return keccak256(abi.encodePacked(msg.sender)) == node;
//     }
// }
