const { expect } = require('chai')
const { ethers } = require('hardhat')

const tokens = (n) => {
	return ethers.utils.parseUnits(n.toString(), 'ether')
}

describe('Exchange', () => {
	let token1, token2, exchange, deployer, feeAccount, user1, user2
	const feePercent = 10

	beforeEach(async () => {
		const Token = await ethers.getContractFactory('Token')
		const Exchange = await ethers.getContractFactory('Exchange')
		token1 = await Token.deploy('Token name', 'TN', '1000000')
		token2 = await Token.deploy('Fake Ether', 'FETH', '1000000');

		[deployer, feeAccount, user1, user2] = await ethers.getSigners()

		let transaction = await token1.connect(deployer).transfer(user1.address, tokens(100))
		let result = await transaction.wait()

		exchange = await Exchange.deploy(feeAccount.address, feePercent)
	})

	describe('Deployment', () => {

		it('checks for correct fee account', async () => {
		expect(await exchange.feeAccount()).to.equal(feeAccount.address)
		})

		it('check for the fee amount', async () => {
			expect(await exchange.feePercent()).to.equal(feePercent)
		})
	})

	describe('Depositing tokens', () => {
		describe('Success', () => {
			let transaction, result
			let amount = tokens(10)

			beforeEach(async () => {
				transaction = await token1.connect(user1).approve(exchange.address, amount)
				result = await transaction.wait()

				transaction = await exchange.connect(user1).depositTokens(token1.address, amount)
				result = await transaction.wait()
			})

			it('checks the balances after deposit', async () => {
				expect(await exchange.balanceOf(user1.address, token1.address)).to.equal(amount)
			})

			it('emits a Deposit event', async () => {
				const event = await result.events[1]
				expect(event.event).to.equal('Deposit')

				const args = event.args
				expect(args.token).to.equal(token1.address)
				expect(args.user).to.equal(user1.address)
				expect(args.amount).to.equal(amount)
				expect(args.balance).to.equal(amount)
			})

		})

		describe('Failure', () => {
			it('rejects unapproved tokens', async () => {
				await expect(exchange.connect(user1).depositTokens(token1.address, tokens(10))).to.be.rejected
				
			})
		})
	})
	describe('Withdrawing tokens', () => {

		describe('Success', () => {
			let transaction, result
			const amount = tokens(10)

			beforeEach(async () => {
				transaction = await token1.connect(user1).approve(exchange.address, amount)
				result = await transaction.wait()

				transaction = await exchange.connect(user1).depositTokens(token1.address, amount)
				result = await transaction.wait()

				transaction = await exchange.connect(user1).withdrawTokens(token1.address, amount)
				result = await transaction.wait()
			})

			it('tracks the balance', async () => {
				expect(await exchange.balanceOf(user1.address, token1.address)).to.equal(0)
				expect(await token1.balanceOf(exchange.address)).to.equal(0)
			})

			it('emits a Withdraw event', async () => {
				const event = await result.events[1]
				expect(event.event).to.equal('Withdraw')

				const args = event.args
				expect(args.token).to.equal(token1.address)
				expect(args.user).to.equal(user1.address)
				expect(args.amount).to.equal(amount)
				expect(args.balance).to.equal(0)
			})
		})

		describe('Failure', () => {
			it('rejects insufficent funds', async () => {
				let amount = tokens(5)
				let transaction = await token1.connect(user1).approve(exchange.address, amount)
				let result = await transaction.wait()

				transaction = await exchange.connect(user1).depositTokens(token1.address, amount)
				result = await transaction.wait()

				await expect(exchange.connect(user1).withdrawTokens(token1.address, tokens(10))).to.be.reverted
			})
		})
	})

	describe('Making orders', () => {

		describe('Success', () => {
			let transaction, result
			let amount = tokens(10)

			beforeEach(async () => {
				transaction = await token1.connect(user1).approve(exchange.address, amount)
				result = await transaction.wait()

				transaction = await exchange.connect(user1).depositTokens(token1.address, amount)
				result = transaction.wait()

				transaction = await exchange.connect(user1).makeOrder(token2.address, amount, token1.address, amount)
				result = await transaction.wait()
			})

			it('checks the order count', async () => {
				expect(await exchange.orderCount()).to.equal(1)
			})

			it('emits an Order event', async () => {
				const event = await result.events[0]
				expect(event.event).to.equal('Order')

				const args = event.args
				expect(args.id).to.equal(1)
				expect(args.user).to.equal(user1.address)
				expect(args.tokenGet).to.equal(token2.address)
				expect(args.amountGet).to.equal(amount)
				expect(args.tokenGive).to.equal(token1.address)
				expect(args.amountGive).to.equal(amount)
				expect(args.timestamp).at.least(1)
			})
		})

		describe('Failure', () => {
			it('fails if there are insufficent funds', async () => {
				let amount = tokens(5)
				let transaction = await token1.connect(user1).approve(exchange.address, amount)
				let result = await transaction.wait()

				transaction = await exchange.connect(user1).depositTokens(token1.address, amount)
				result = transaction.wait()

				await expect(exchange.connect(user1).makeOrder(token2.address, tokens(10), token1.address, tokens(10))).to.be.rejected
			})
		})
	})

	describe('Cancelling Orders', async () => {
		describe('Success', () => {
			let transaction, result
			const amount = tokens(10)
			beforeEach(async () => {
				transaction = await token1.connect(user1).approve(exchange.address, amount)
				result = await transaction.wait()

				transaction = await exchange.connect(user1).depositTokens(token1.address, amount)
				result = await transaction.wait()

				transaction = await exchange.connect(user1).makeOrder(token2.address, amount, token1.address, amount)
				result = await transaction.wait()

				transaction = await exchange.connect(user1).cancelOrder(1)
				result = await transaction.wait()
			})

			it('check for cancelled order', async () => {
				expect(await exchange.orderCancelled(1)).to.equal(true)
			})

			it('emits a Cancel event', async () => {
				const event = await result.events[0]
				expect(event.event).to.equal('Cancel')

				const args = event.args
				expect(args.id).to.equal(1)
				expect(args.user).to.equal(user1.address)
				expect(args.tokenGet).to.equal(token2.address)
				expect(args.amountGet).to.equal(amount)
				expect(args.tokenGive).to.equal(token1.address)
				expect(args.amountGive).to.equal(amount)
				expect(args.timestamp).at.least(1)

			})
		})

		describe('Failure', () => {
			it('rejects cancelations from wrong user', async () => {
				let transaction, result
				const amount = tokens(10)
				transaction = await token1.connect(user1).approve(exchange.address, amount)
				result = await transaction.wait()

				transaction = await exchange.connect(user1).depositTokens(token1.address, amount)
				result = await transaction.wait()

				transaction = await exchange.connect(user1).makeOrder(token2.address, amount, token1.address, amount)
				result = await transaction.wait()

				await expect(exchange.connect(user2).cancelOrder(1)).to.be.rejected
			})

			it('rejects invalid ids', async () => {
				await expect(exchange.connect(user1).cancelOrder(10)).to.be.reverted
			})
		})
	})

	describe('Filling Orders', () => {

		describe('Success', () => {
			beforeEach(async () => {

			})
		})

		describe('Failure', () => {
			
		})
	})
})
