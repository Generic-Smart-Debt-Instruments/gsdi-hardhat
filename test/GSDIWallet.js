const { expect } = require("chai");
const {
  deployContract,
  MockProvider,
  deployMockContract,
} = require("ethereum-waffle");
const { ethers } = require("hardhat");

const MockERC20Artifact = require("../artifacts/contracts/mocks/MockERC20.sol/MockERC20.json");
const MockERC721Artifact = require("../artifacts/contracts/mocks/MockERC721.sol/MockERC721.json");
const MockERC1155Artifact = require("../artifacts/contracts/mocks/MockERC1155.sol/MockERC1155.json");
const GSDIWalletArtifact = require("../artifacts/contracts/GSDIWallet.sol/GSDIWallet.json");

const { toNum, toBN } = require("./utils");

describe("GSDI Wallet Unit Tests", function () {
  const [wallet] = new MockProvider().getWallets();

  before(async function () {
    this.accounts = {};
    this.signers = {};

    const signers = await ethers.getSigners();
    this.signers.admin = signers[0];
    this.signers.gsdiNft = signers[1];
    this.signers.other = signers[2];
    this.accounts.admin = signers[0].address;
    this.accounts.gsdiNft = signers[1].address;
    this.accounts.other = signers[2].address;
    this.wallet = wallet;

    console.log("accounts:", this.accounts);

    this.mockERC20 = await deployContract(
      this.signers.admin,
      MockERC20Artifact
    );
    this.mockERC721 = await deployContract(
      this.signers.admin,
      MockERC721Artifact
    );
    this.mockERC1155 = await deployContract(
      this.signers.admin,
      MockERC1155Artifact
    );
  });

  describe("GSDI Wallet", function () {
    before(async function () {
      this.gsdiWallet = await deployContract(
        this.signers.admin,
        GSDIWalletArtifact,
        []
      );

      console.log("GSDIWallet deployed:", this.gsdiWallet.address);
      console.log();

      await this.gsdiWallet.initialize(
        this.accounts.gsdiNft,
        this.accounts.other
      );

      await this.mockERC20.transfer(this.gsdiWallet.address, toBN(10000));

      for (let i = 1; i <= 5; i++) {
        await this.mockERC721.transferFrom(
          this.accounts.admin,
          this.gsdiWallet.address,
          toBN(i)
        );
      }

      await this.mockERC1155.safeBatchTransferFrom(
        this.accounts.admin,
        this.gsdiWallet.address,
        [toBN(1), toBN(2)],
        [toBN(10), toBN(20)],
        ethers.utils.toUtf8Bytes("")
      );
    });

    it("Should have `gsdiNft` and `executor`", async function () {
      const gsdiNft = await this.gsdiWallet.gsdiNft();
      const executor = await this.gsdiWallet.executor();

      expect(gsdiNft).to.equal(this.accounts.gsdiNft);
      expect(executor).to.equal(this.accounts.other);
    });

    it("Can change `executor`", async function () {
      const before = await this.gsdiWallet.executor();

      await expect(
        this.gsdiWallet.setExecutor(this.accounts.admin)
      ).to.be.revertedWith("GSDIWallet: Only executor or GSDINft allowed");

      await this.gsdiWallet
        .connect(this.signers.other)
        .setExecutor(this.accounts.admin);
      const after = await this.gsdiWallet.executor();

      expect(before).to.equal(this.accounts.other);
      expect(after).to.equal(this.accounts.admin);
    });

    it("Can execute an arbitrary transaction", async function () {
      const interface = new ethers.utils.Interface(MockERC20Artifact.abi);
      const payload = interface.encodeFunctionData("approve(address,uint256)", [
        this.accounts.gsdiNft,
        toBN(100),
      ]);
      await this.gsdiWallet.execute(this.mockERC20.address, toBN(0), payload);
      const after = await this.mockERC20.allowance(
        this.gsdiWallet.address,
        this.accounts.gsdiNft
      );

      expect(toNum(after)).to.equal(100);
    });

    it("Can execute an arbitrary transaction using `safeExecute()`", async function () {
      const interface = new ethers.utils.Interface(MockERC20Artifact.abi);
      const fakePayload = "0xffff";
      const payload = interface.encodeFunctionData("approve(address,uint256)", [
        this.accounts.gsdiNft,
        toBN(200),
      ]);

      await expect(
        this.gsdiWallet.safeExecute(
          this.mockERC20.address,
          toBN(0),
          fakePayload
        )
      ).to.be.reverted;

      await this.gsdiWallet.safeExecute(
        this.mockERC20.address,
        toBN(0),
        payload
      );
      const after = await this.mockERC20.allowance(
        this.gsdiWallet.address,
        this.accounts.gsdiNft
      );

      expect(toNum(after)).to.equal(200);
    });

    it("Can tranfer arbitrary ERC20 tokens", async function () {
      const before = await this.mockERC20.balanceOf(this.gsdiWallet.address);
      await this.gsdiWallet.safeTransferIERC20(
        this.mockERC20.address,
        this.accounts.other,
        toBN(100)
      );
      const account = await this.mockERC20.balanceOf(this.accounts.other);
      const after = await this.mockERC20.balanceOf(this.gsdiWallet.address);
      const amount = toNum(before) - toNum(after);

      expect(toNum(account)).to.equal(100);
      expect(amount).to.equal(100);
    });

    it("Can tranfer arbitrary ERC721 tokens", async function () {
      await expect(this.mockERC721.tokenOfOwnerByIndex(this.accounts.other, 0))
        .to.be.reverted;

      await this.gsdiWallet.safeTransferIERC721(
        this.mockERC721.address,
        this.accounts.other,
        [toBN(1), toBN(2), toBN(3)]
      );
      const after = await this.mockERC721.tokenOfOwnerByIndex(
        this.gsdiWallet.address,
        1
      );

      expect(toNum(after)).to.equal(4);
      await expect(
        this.mockERC721.tokenOfOwnerByIndex(this.gsdiWallet.address, 2)
      ).to.be.reverted;
      for (let i = 0; i < 3; i++) {
        const other = await this.mockERC721.tokenOfOwnerByIndex(
          this.accounts.other,
          i
        );
        expect(toNum(other)).to.equal(i + 1);
      }
      await expect(this.mockERC721.tokenOfOwnerByIndex(this.accounts.other, 4))
        .to.be.reverted;
    });

    it("Can tranfer arbitrary ERC1155 tokens", async function () {
      const beforeOther = await this.mockERC1155.balanceOfBatch(
        [this.accounts.other, this.accounts.other],
        [toBN(1), toBN(2)]
      );
      const beforeWallet = await this.mockERC1155.balanceOfBatch(
        [this.gsdiWallet.address, this.gsdiWallet.address],
        [toBN(1), toBN(2)]
      );

      await this.gsdiWallet.safeTransferIERC1155(
        this.mockERC1155.address,
        this.accounts.other,
        [toBN(1), toBN(2)],
        [toBN(10), toBN(10)]
      );

      const afterOther = await this.mockERC1155.balanceOfBatch(
        [this.accounts.other, this.accounts.other],
        [toBN(1), toBN(2)]
      );
      const afterWallet = await this.mockERC1155.balanceOfBatch(
        [this.gsdiWallet.address, this.gsdiWallet.address],
        [toBN(1), toBN(2)]
      );

      expect(toNum(afterOther[0]) - toNum(beforeOther[0])).to.equal(10);
      expect(toNum(afterOther[1]) - toNum(beforeOther[1])).to.equal(10);
      expect(toNum(beforeWallet[0]) - toNum(afterWallet[0])).to.equal(10);
      expect(toNum(beforeWallet[1]) - toNum(afterWallet[1])).to.equal(10);
    });
  });
});
