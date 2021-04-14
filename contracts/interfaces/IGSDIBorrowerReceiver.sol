// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

interface IGSDIBorrowerReceiver {
    function onBorrowerTransferred(address _sender, uint _value, bytes memory _data) external;
}