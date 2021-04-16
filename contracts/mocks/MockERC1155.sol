
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC1155/presets/ERC1155PresetMinterPauser.sol";

contract MockERC1155 is ERC1155PresetMinterPauser {
  constructor() ERC1155PresetMinterPauser("") {
    uint256[] memory ids = new uint256[](5);
    uint256[] memory amounts = new uint256[](5);
    for (uint256 i = 1; i <= 5; i ++) {
      ids[i-1] = i;
      amounts[i-1] = i * 10;
    }
    mintBatch(msg.sender, ids, amounts, "");
  }
}