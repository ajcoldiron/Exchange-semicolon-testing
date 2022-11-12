const { expect } = require('chai')
const { ethers } = require('hardhat')

const tokens = (n) => {
	return ethers.utils.parseUnits(n.toString(), 'ether')
}

describe('Token', () => {
	let token, deployer, receiver, exchange
	let totalSupply = tokens(1000000)
	beforeEach(async () => {
		const Token = await ethers.getContractFactory('Token')
		token = await Token.deploy('Token name', 'TN', '1000000');

		[deployer, receiver, exchange] = await ethers.getSigners()

	})

	describe('Deployment', () => {
		it('check for correct name', async () => {
			expect(await token.name()).to.equal('Token name')
		})

		it('checks for the correct symbol', async () => {
			expect(await token.symbol()).to.equal('TN')
		})

		it('checks for correct decimals', async () => {
			expect(await token.decimals()).to.equal(18)
		})

		it('checks for the correct balance', async () => {
			expect(await token.balanceOf(deployer.address)).to.equal(totalSupply)
		})
	})

	describe('Sending tokens', () => {

		describe('Success', () => {
			let transaction, result
			let amount = tokens(10)

			beforeEach(async () => {
				transaction = await token.connect(deployer).transfer(receiver.address, amount)
				result = await transaction.wait()
			})

			it('checks the balances', async () => {
				expect(await token.balanceOf(deployer.address)).to.equal(tokens(999990))
				expect(await token.balanceOf(receiver.address)).to.equal(tokens(10))
			})

			it('emits a Transfer event', async () => {
				const event = await result.events[0]
				expect(event.event).to.equal('Transfer')

				const args = event.args
				expect(args.from).to.equal(deployer.address)
				expect(args.to).to.equal(receiver.address)
				expect(args.amount).to.equal(amount)
			})
		})

		describe('Failure', () => {
			it('rejects invalid addresses', async () => {
				const invalidAddress = '0x0000000000000000000000000000000000000000'
				await expect(token.connect(deployer).transfer(invalidAddress, tokens(10))).to.be.rejected
			})

			it('rejects insufficent amounts', async () => {
				const insufficentAmount = tokens(1000000000)
				await expect(token.connect(deployer).transfer(receiver.address, insufficentAmount))
			})
		})
	})

	describe('Approval', () => {

		describe('Success', () => {
			let transaction, result
			let amount = tokens(10)
			beforeEach(async () => {
				transaction = await token.connect(deployer).approve(receiver.address, amount)
				result = await transaction.wait()
			})

			it('checks the allowance', async () => {
				expect(await token.allowance(deployer.address, receiver.address)).to.equal(amount)
			})

			it('emits an Approval event', async () => {
				const event = await result.events[0]
				expect(event.event).to.equal('Approval')

				const args = event.args
				expect(args.from).to.equal(deployer.address)
				expect(args.to).to.equal(receiver.address)
				expect(args.amount).to.equal(amount)
			})
		})

		describe('Failure', () => {
			it('rejects invalid addresses', async () => {
				const invalidAddress = '0x0000000000000000000000000000000000000000'
				await expect(token.connect(deployer).approve(invalidAddress, tokens(10))).to.be.rejected
			})
		})
	})

	describe('Delegating token spending', () => {

		describe('Success', () => {
			let transaction, result
			let amount = tokens(10)

			beforeEach(async () => {
				transaction = await token.connect(deployer).approve(exchange.address, amount)
				result = await transaction.wait()
				transaction = await token.connect(exchange).transferFrom(deployer.address, receiver.address, amount)
				result = await transaction.wait()
			})

			it('checks the balance of receiver and allowance', async () => {
				expect(await token.balanceOf(receiver.address)).to.equal(amount)
				expect(await token.allowance(deployer.address, receiver.address)).to.equal(0)
			})

			it('emits a Transfer event', async () => {
				const event = await result.events[0]
				expect(event.event).to.equal('Transfer')

				const args = event.args
				expect(args.from).to.equal(deployer.address)
				expect(args.to).to.equal(receiver.address)
				expect(args.amount).to.equal(amount)
			})
		})

		describe('Failure', () => {

			it('rejects insufficent funds', async () => {
				const insufficentAmount = tokens(1000000000)
				await expect(token.connect(deployer).transfer(receiver.address, insufficentAmount))
			})

			it('rejects not allowed funds', async () => {
				let transaction, result
				const insufficentAmount = tokens(1000000000)
				transaction = await token.connect(deployer).approve(exchange.address, tokens(10))
				result = await transaction.wait()
				await expect(token.connect(exchange).transferFrom(receiver.address, insufficentAmount)).to.be.rejected
			})
		})
	})
})