// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;
import "hardhat/console.sol";
import "./Token.sol";

contract Exchange {
	address public feeAccount;
	uint256 public feePercent;
	mapping(address => mapping(address => uint256)) public tokens;
	mapping(uint256 => _Order) public orders;
	uint256 public orderCount;
	mapping(uint256 => bool) public orderCancelled;
	mapping(uint256 => bool) public orderFilled;

	event Deposit(
		address token,
		address user,
		uint256 amount,
		uint256 balance
	);

	event Withdraw(
		address token,
		address user,
		uint256 amount,
		uint256 balance
	);

	event Order(
		uint256 id,
		address user,
		address tokenGet,
		uint256 amountGet,
		address tokenGive,
		uint256 amountGive,
		uint256 timestamp
	);

	event Cancel(
		uint256 id,
		address user,
		address tokenGet,
		uint256 amountGet,
		address tokenGive,
		uint256 amountGive,
		uint256 timestamp
	);

	event Trade(
		uint256 id,
		address user,
		address tokenGet,
		uint256 amountGet,
		address tokenGive,
		uint256 amountGive,
		address creator,
		uint256 timestamp
	);

	struct _Order{
		uint256 id;
		address user;
		address tokenGet;
		uint256 amountGet;
		address tokenGive;
		uint256 amountGive;
		uint256 timestamp;
	}

	constructor(address _feeAccount, uint256 _feePercent){
		feeAccount = _feeAccount;
		feePercent = _feePercent;
	}

	function depositTokens(address _token, uint256 _value) public {
		require(Token(_token).transferFrom(msg.sender, address(this), _value));

		tokens[_token][msg.sender] = tokens[_token][msg.sender] + _value;

		emit Deposit(_token, msg.sender, _value, tokens[_token][msg.sender]);
	}

	function balanceOf(
		address _user, 
		address _token) 
	public view returns(uint256) {
		return tokens[_token][_user];
	}

	function withdrawTokens(address _token, uint256 _value) public {
		require(tokens[_token][msg.sender] >= _value);

		Token(_token).transfer(msg.sender, _value);

		tokens[_token][msg.sender] = tokens[_token][msg.sender] - _value;

		emit Withdraw(_token, msg.sender, _value, tokens[_token][msg.sender]);
	}

	function makeOrder(
		address _tokenGet, 
		uint256 _amountGet, 
		address _tokenGive, 
		uint256 _amountGive) 
	public {
		require(balanceOf(msg.sender, _tokenGive) >= _amountGive, "not enough Eth");

		orderCount++;

		orders[orderCount] = _Order(
			orderCount, 
			msg.sender, 
			_tokenGet, 
			_amountGet,
			_tokenGive,
			_amountGive,
			block.timestamp);

		emit Order(
			orderCount, 
			msg.sender, 
			_tokenGet, 
			_amountGet,
			_tokenGive,
			_amountGive,
			block.timestamp);
	}

	function cancelOrder(uint256 _id) public {
		_Order storage _order = orders[_id];

		require(msg.sender == _order.user);
		require(_order.id == _id);
		require(orderCount <= _id);

		orderCancelled[_id] = true;

		emit Cancel(
			_order.id, 
			msg.sender, 
			_order.tokenGet,
			_order.amountGet,
			_order.tokenGive,
			_order.amountGive,
			block.timestamp
		);
	}

	function fillOrder(uint256 _id) public {
		_Order storage _order = order[_id];
		
		require(_id <= orderCount && _id > 0);
		require(!orderfilled[_id]);
		require(!orderCancelled[_id]);

		_trade(_id);

		orderFilled[_order.id] = true;
	}

	function _trade(uint256 _id) internal {
		_Order storage _order = order[_id];

		uint256 feeAmount = (feePercent * _order.tokenGet) / 100;

		token[_order.tokenGet][msg.sender] = token[_order.tokenGet][msg.sender] - (_order.amountGet + feeAmount);
		token[_order.tokenGet][_order.user] = token[_order.tokenGet][_order.user] + _order.amountGet;

		token[_order.tokenGet][feeAccount] = token[_order.tokenGet][feeAccount] + feeAmount;

		token[_order.tokenGive][msg.sender] = token[_order.tokenGive][msg.sender] + _order.amountGive;
		token[_order.tokenGive][_order.user] = token[_order.tokenGive][_order.user] - _order.amountGive;

		emit Trade(
			_order.id,
			msg.sender,
			_order.tokenGet,
			_order.amountGet,
			_order.tokenGive,
			_order.amountGive,
			_order.user,
			block.timestamp);
	}
}