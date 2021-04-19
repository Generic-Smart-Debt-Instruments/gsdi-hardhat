// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "../interfaces/IGSDIBorrowerReceiver.sol";

contract MockGSDIBorrowerReceiver is IGSDIBorrowerReceiver {
    address public sender;
    uint public value;
    bytes public data;

    function onBorrowerTransferred(address _sender, uint _value, bytes memory _data) public override {
        sender = _sender;
        value = _value;
        data = _data;
    }
}