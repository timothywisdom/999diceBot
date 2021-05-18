let sessionCookie = '';
let currentBalance = 0;
let maxBalance = 0;
let currentProfit = 0;
let maxProfit = 0;
let betCount = 0;
let lossesInARow = 0;
let maxLossesInARow = 0;
let resetCount = 0;
let currentLosses = [];
let defaultWagerPercentOfBalance = 0.1;
let defaultChanceToWinPercent = 51;
let defaultChanceToWinAgainstLostPercent = 95;
let defaultKeepBetting = false;
let collectFaucetResolved = undefined;
let betTableObserver = undefined;
let faucetObserver = undefined;
var faucetInterval = undefined;
var placeBetPromiseResolve = undefined;
var logEnabled = true;

function log() {
	if (logEnabled) {
		if (arguments.length === 1) {
			console.log(arguments[0]);
		} else {
			console.log(arguments[0], arguments[1]);
		}
	}
}

const _createFaucetObserver = () => {
	return new MutationObserver( async (mutationsList, faucetObserver) => {
		log("A mutation has happened on the Faucet", {mutationsList, faucetObserver});
		const isHidden = document.getElementById('SimpleCaptchaBox2').style.display == 'none';
		if (collectFaucetResolved && !isHidden) {
			var answer = document.querySelectorAll('#SimpleCaptchaContainer2 span')[0].getAttribute('data-pass');
			document.querySelectorAll('#SimpleCaptchaContainer2 input')[0].value = answer;
			document.querySelectorAll('#SimpleCaptchaContainer2 .TextButton')[0].click();
			log("Collected Faucet");
			collectFaucetResolved();
			_stopFaucetObserver();
			collectFaucetResolved = undefined;
		}
	});
}

const _startFaucetObserver = () => {
	if (!faucetObserver) {
		faucetObserver = _createFaucetObserver();
	}
	
	const targetNode = document.getElementById('SimpleCaptchaBox2');
	const config = { attributes: true, childList: true, subtree: true };
	faucetObserver.observe(targetNode, config);
}

const _stopFaucetObserver = () => {
	faucetObserver.disconnect();
}

const collectFaucet = async () => {
	_startFaucetObserver();
	const aPromise = new Promise((res, rej) => { collectFaucetResolved = res; });

	document.querySelectorAll('.FaucetClaimButton')[0].click();

	return aPromise;
}

const startDripCollection = async () => {
	currentBalance = getBalanceFromUI();
	if (currentBalance < 0.09) {
		await collectFaucet();
	}
	
	stopDripCollection();
	
	const randNumBetweenFiveAndTen = Math.floor(Math.random() * 10000) + 5000;
	faucetInterval = window.setTimeout( async () => {
		startDripCollection()
	}, (2.5 * 60 * 1000) + randNumBetweenFiveAndTen);
}

const stopDripCollection = () => {
	if (faucetInterval) {
		clearTimeout(faucetInterval);
	}
	faucetInterval = undefined;
}

const getBalanceFromUI = () => parseFloat(document.querySelector('.UserBalance').innerText, 10);

const fixDecimal = (amount) => {
	const newAmount = parseFloat(view.util.formatDecimal(amount,8))
	if (newAmount < 0 && Math.min(-1e-8, newAmount) == -1e-8) {
		return 0;
	}
	return newAmount;
}

const hasLosses = () => currentLosses.length > 0;
const lastLoss = () => hasLosses() ? currentLosses[currentLosses.length - 1] : 0;
const updateLosses = (amount) => {
	if (amount < 0) {
		currentLosses = [...currentLosses, amount];
	} else if (!hasLosses()) {
		return;
	} else {
		currentLosses[currentLosses.length - 1] = fixDecimal(lastLoss() + amount);
		while(hasLosses() && lastLoss() >= 0) {
			const lastLossAmount = lastLoss();
			currentLosses.pop();
			if (hasLosses()) {
				currentLosses[currentLosses.length - 1] = fixDecimal(lastLoss() + lastLossAmount);
			} else {
				return;
			}
		}
	}
	log(`${currentLosses.length} Current Losses: [${currentLosses.join(', ')}]`);
}

const createSingleBetMutationObserver =  () => {
	return new MutationObserver( async (mutationsList, betTableObserver) => {
		if (placeBetPromiseResolve) {
			placeBetPromiseResolve();
		}
	});
}

const startBetTableObserver = () => {
	const targetNode = document.querySelector('.UserBalance');
	const config = { attributes: true, childList: true, subtree: true };
	betTableObserver.observe(targetNode, config);
}
const stopBetTableObserver = () => betTableObserver.disconnect();

const start = async () => {
	if (!betTableObserver) {
		betTableObserver = createSingleBetMutationObserver();
	}
	startBetTableObserver();
	
	defaultKeepBetting = true;
	
	placeSingleBet();
}
const stop = () => {defaultKeepBetting = false};

const getTargetProfit = (wager, chanceToWinPercent) => {
	const configuration = config.currencies[config.displayCurrencyId];
	const houseEdge = Math.floor(((configuration.housePayout / (chanceToWinPercent / 100) - 1) * 1e6) + 0.001)
	const targetProfit = Math.floor(wager * houseEdge * 100 + .0001) / 1e8;
	
	return targetProfit;
}

const getWagerPercentBalance = (targetProfit, chanceToWinPercent) => {
	currentBalance = getBalanceFromUI();
	const configuration = config.currencies[config.displayCurrencyId];
	const houseEdge = Math.floor(((configuration.housePayout / (chanceToWinPercent / 100) - 1) * 1e6) + 0.001)
	const wager = targetProfit * 1e8 / Math.floor(houseEdge * 100 + 0.001);
	const wagerPercentBalance = wager / currentBalance * 100;
	
	return wagerPercentBalance;
}

const calculateWager = async (wagerPercentOfBalance = defaultWagerPercentOfBalance, chanceToWinPercent = defaultChanceToWinPercent, chanceToWinAgainstLostPercent = defaultChanceToWinAgainstLostPercent) => {
	currentBalance = getBalanceFromUI();
	let wager = currentBalance * 9/10;
	
	if (currentBalance <= 0) {
		log(`currentBalance is ${currentBalance} so collecting from faucet`);
		resetCount = resetCount + 1;
		await collectFaucet();
		currentBalance = getBalanceFromUI();
	}
	
	if (hasLosses()) {
		let lossMagnitude = Math.abs(lastLoss());
		let wagerPercentOfBalanceForLoss = getWagerPercentBalance(lossMagnitude, chanceToWinAgainstLostPercent);
		wager = fixDecimal(currentBalance * (wagerPercentOfBalanceForLoss / 100));
		let targetProfit = getTargetProfit(wager, chanceToWinAgainstLostPercent);
		log(`Wager for Loss of ${lossMagnitude} = ${wagerPercentOfBalance}% of ${currentBalance} = ${wager} to win ${targetProfit}`);
		
		if (wager > currentBalance) {
			currentLosses = [];
			wager = fixDecimal(currentBalance * (wagerPercentOfBalance / 100));
			targetProfit = getTargetProfit(wager, chanceToWinPercent);
			log(`Wager for Giveup Loss of ${targetProfit} = ${wagerPercentOfBalance}% of ${currentBalance} = ${wager}. This site is a scam!`);
		}
	} else {
		wager = fixDecimal(currentBalance * (wagerPercentOfBalance / 100));
		targetProfit = getTargetProfit(wager, chanceToWinPercent);
		log(`Wager for Win of ${targetProfit} = ${wagerPercentOfBalance}% of ${currentBalance} = ${wager}`);
	}
	
	return wager;
}

const placeSingleBet = async (wagerPercentOfBalance = defaultWagerPercentOfBalance, chanceToWinPercent = defaultChanceToWinPercent, chanceToWinAgainstLostPercent = defaultChanceToWinAgainstLostPercent, keepBetting = defaultKeepBetting) => {
	const aPromise = new Promise(async (res, rej)=>{
		placeBetPromiseResolve = res;
		const wager = await calculateWager(wagerPercentOfBalance, chanceToWinPercent, chanceToWinAgainstLostPercent);
		chanceToWinPercent = hasLosses() ? chanceToWinAgainstLostPercent : chanceToWinPercent;
		const targetProfit = getTargetProfit(wager, chanceToWinPercent);
		if (wager > 0 && targetProfit > 0) {
			currentBalance = getBalanceFromUI();
			const wagerPercent = Math.floor(wager/currentBalance * 10000) / 100;
			
			log(`Wagering ${wager} of ${currentBalance} (${wagerPercent}%) with ${chanceToWinPercent}% chance to win ${targetProfit}.`);	

			document.getElementById('BetSizeInput').value = wager;
			document.getElementById('BetSizeInput').dispatchEvent(new Event('blur'));
			document.getElementById('BetChanceInput').value = chanceToWinPercent;
			document.getElementById('BetChanceInput').dispatchEvent(new Event('blur'));
			view.recalculateBetParams(); // update UI with targetProfit
			
			var displayCurrencyId = config.displayCurrencyId;
			var wagerSatoshis = view.parseCommaFloat(wager) * 1e8;
			var range = view.util.getBetRange();
			var seed = view.controls.getClientSeed();
			pipe.server.placeBet(wagerSatoshis, 0, range, seed, displayCurrencyId, true);
		} else {
			rej(`Wager: ${wager}. TargetProfit: ${targetProfit}`);
		}
	});
	
	aPromise.then(() => {
		placeBetPromiseResolve = undefined;
		const previousBalance = currentBalance;
		currentBalance = getBalanceFromUI();
		maxBalance = Math.max(maxBalance, currentBalance);
		const betProfit = fixDecimal(currentBalance - previousBalance);
		currentProfit = fixDecimal(currentProfit + betProfit);
		maxProfit = Math.max(maxProfit, currentProfit);
		const isLoss = betProfit < 0;
		if (isLoss) {
			lossesInARow = lossesInARow + 1;
			maxLossesInARow = Math.max(maxLossesInARow, lossesInARow);
		} else {
			lossesInARow = 0;
		}
		
		log(`${isLoss ? '---LOST---' : '---WON---'}
Current Balance: ${currentBalance}.      Bet Profit: ${betProfit}.          ResetCount: ${resetCount}
    Max Balance: ${maxBalance}.  Current Profit: ${currentProfit}.       Losses in Row: ${lossesInARow}
                                  Max Profit: ${maxProfit}.    Max Losses in Row: ${maxLossesInARow}`);

		updateLosses(betProfit);
		
		if (keepBetting) {
			setTimeout(() => placeSingleBet(), 0);
		}
	}).catch((err)=>{
		console.log("Failed to placeSingleBet", err);
	});
	
	return aPromise;
}


document.querySelector('#ContentTabsContainer div:nth-child(2)').click();
