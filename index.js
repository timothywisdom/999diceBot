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
let serverSeedHash;
let clientSeed;
let defaultWagerPercentOfBalance = 0.01;
let defaultChanceToWinPercent = 51;
let defaultChanceToWinAgainstLostPercent = 95;
let defaultKeepBetting = false;
let collectFaucetResolved = undefined;
let betTableObserver = undefined;
let faucetObserver = undefined;
var faucetInterval = undefined;
var placeBetPromiseResolve = undefined;
var validationHtmlInterval = undefined;
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

const stringToBytes = (str, length) => {
	var bytes = [];
	var i = length;
	do {
		bytes[--i] = str & (255);
		str = str>>8;
	} while ( i )
	return bytes;
}

const hexStringToByte = (str) => {
	if (!str) {
	  return new Uint8Array();
	}
	
	var a = [];
	for (var i = 0, len = str.length; i < len; i+=2) {
	  a.push(parseInt(str.substr(i,2),16));
	}
	
	return new Uint8Array(a);
}

const byteToHexString = (uint8arr) => {
	if (!uint8arr) {
	  return '';
	}
	
	var hexStr = '';
	for (var i = 0; i < uint8arr.length; i++) {
	  var hex = (uint8arr[i] & 0xff).toString(16);
	  hex = (hex.length === 1) ? '0' + hex : hex;
	  hexStr += hex;
	}
	
	return hexStr;
}

const sha256 = async (byteArray) => {
	// return crypto.subtle.digest("SHA-256", new TextEncoder("utf-8").encode(str)).then(buf => {
	// 	return Array.prototype.map.call(new Uint8Array(buf), x=>(('00'+x.toString(16)).slice(-2))).join('');
	// });
	return crypto.subtle.digest("SHA-256", byteArray).then(buf => {
		return new Uint8Array(buf);
	});
}

const sha512 = async (byteArray) => {
	// return crypto.subtle.digest("SHA-512", new TextEncoder("utf-8").encode(str)).then(buf => {
	// 	return Array.prototype.map.call(new Uint8Array(buf), x=>(('00'+x.toString(16)).slice(-2))).join('');
	// });
	return crypto.subtle.digest("SHA-512", byteArray).then(buf => {
		return new Uint8Array(buf);
	});
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
		const _previousBalance = currentBalance;
		const _currentBalance = getBalanceFromUI();
		const _betProfit = fixDecimal(_currentBalance - _previousBalance);

		if (_betProfit !== 0  && placeBetPromiseResolve) {
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

const start = () => {
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
			log(`!! Wager (${wager}) is > than currentBalance (${currentBalance}). Cancelling wager.`);
			wager = 0;
		}
		
		/*
		if (wager > currentBalance) {
			currentLosses = [];
			wager = fixDecimal(currentBalance * (wagerPercentOfBalance / 100));
			targetProfit = getTargetProfit(wager, chanceToWinPercent);
			log(`Wager for Giveup Loss of ${targetProfit} = ${wagerPercentOfBalance}% of ${currentBalance} = ${wager}`);
		}
		*/
	} else {
		wager = fixDecimal(currentBalance * (wagerPercentOfBalance / 100));
		targetProfit = getTargetProfit(wager, chanceToWinPercent);
		log(`Wager for Win of ${targetProfit} = ${wagerPercentOfBalance}% of ${currentBalance} = ${wager}`);
	}
	
	return wager;
}

const _getServerSecretSeed = async (url, rolledNumber) => {
	const pageResponse = await fetch(url, {
		// credentials: 'include',
		headers: {
			'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
			'user-agent': navigator.userAgent,
			'cache-control': 'max-age=0',
			'upgrade-insecure-requests': 1,
			'sec-fetch-dest': 'document',
			'sec-fetch-mode': 'navigate',
			'sec-fetch-site': 'none'
		},
		referrer: ''
	});
	validationHtml = await pageResponse.text();
	const regex = /serverSeed='([A-z0-9]*)'/g
	log(`Attempting to read serverSeed from ${url} (for number ${rolledNumber})`);
	const matches = regex.exec(validationHtml);
	if (matches && matches[1]) {
		const serverSeed = matches[1];
		log("serverSecretSeed", serverSeed);
		return serverSeed;
	} else {
		return false;
	}
}

const getServerSecretSeed = async (url, rolledNumber) => {
	const aPromise = new Promise(async (res, rej) => {
		let attemptCount = 1;
		validationHtmlInterval = setInterval(async ()=>{
			let serverSeed = await _getServerSecretSeed(url, rolledNumber);
			attemptCount++;
			if (attemptCount >= 10) {
				clearInterval(validationHtmlInterval);
				validationHtmlInterval = undefined;
				rej(`Failed to get serverSeed from ${url} after ${attemptCount} attempts`)
			}
			if (serverSeed !== false) {
				clearInterval(validationHtmlInterval);
				validationHtmlInterval = undefined;
				res(serverSeed);
			}
		}, 3500);
	})
	return aPromise;
}

const validateBetResult = async (serverSecretSeed, clientSeed, betNumber, betResult, serverSeedHash) => {
	log(`validateBetResult("${serverSecretSeed}", ${clientSeed}, ${betNumber}, ${betResult}, "${serverSeedHash}");`)
	const serverSecretSeedBytes = hexStringToByte(serverSecretSeed);
	// log(`serverSecretSeedBytes: ${serverSecretSeed}`, serverSecretSeedBytes);
	const clientBytes = stringToBytes(clientSeed, 4);
	const betNumberBytes = stringToBytes(betNumber, 4);
	const serverSeedHashBytes = hexStringToByte(serverSeedHash);
	// log(`serverSeedHashBytes: ${serverSeedHash}`, serverSeedHashBytes);

	const serverSecretSeedBytesHashed = await sha256(serverSecretSeedBytes);
	// log(`serverSecretSeedBytesHashed:`, serverSecretSeedBytesHashed);
	if (serverSeedHashBytes.join(',') !== serverSecretSeedBytesHashed.join(',')) {
		log(`${serverSeedHashBytes.join(',')} !== ${serverSecretSeedBytesHashed.join(',')}`);
		return false;
	}

	const data = new Uint8Array([...serverSecretSeedBytes, ...(new Uint8Array(clientBytes)), ...(new Uint8Array(betNumberBytes))]);
	const hashPre = await sha512(data)
	const hash = await sha512(hashPre);

	// log(`data: ${byteToHexString(data)}`, data);
	// log(`hash: ${byteToHexString(hash)}`, hash);

	while(true)
	{
		for (var x = 0; x <= 61; x+= 3) {
			// log(`${hash[x]} << 16 | (${hash[x+1]} << 8) | ${hash[x + 2]} = ${(hash[x] << 16)} | ${(hash[x+1] << 8)} | ${hash[x + 2]} = ${(hash[x] << 16) | (hash[x+1] << 8) | hash[x + 2]}`);
			let result = (hash[x] << 16) | (hash[x+1] << 8) | hash[x + 2];
			// log(`${x}: ${result}`);
			if (result < 16000000) {
				// log(`result is less than 16000000. Mod = ${result % 1000000}. betResult = ${betResult}`)
				return result % 1000000 === betResult;
			}
		}
		hash = await sha512(hash);
	}
}

const placeSingleBet = async (wagerPercentOfBalance = defaultWagerPercentOfBalance, chanceToWinPercent = defaultChanceToWinPercent, chanceToWinAgainstLostPercent = defaultChanceToWinAgainstLostPercent, keepBetting = defaultKeepBetting) => {
	const aPromise = new Promise(async (res, rej)=>{
		placeBetPromiseResolve = res;
		const wager = await calculateWager(wagerPercentOfBalance, chanceToWinPercent, chanceToWinAgainstLostPercent);
		chanceToWinPercent = hasLosses() ? chanceToWinAgainstLostPercent : chanceToWinPercent;
		const targetProfit = getTargetProfit(wager, chanceToWinPercent);

		serverSeedHash = document.querySelector('.FairTabServerSeedHash').innerText;
		clientSeed = Math.floor(Math.random() * 1000000000) + 1; // Generate a seed between 1 and 1000000000
		document.querySelector('.ManualSeedControls .StandardTextBox').value = clientSeed;
		// var clientSeed = view.controls.getClientSeed();


		if (wager > 0 && targetProfit > 0) {
			currentBalance = getBalanceFromUI();
			const wagerPercent = Math.floor(wager/currentBalance * 10000) / 100;
			
			log(`Wagering ${wager} of ${currentBalance} (${wagerPercent}%) with ${chanceToWinPercent}% chance to win ${targetProfit}. Server Seed Hash: ${serverSeedHash}. Client Seed: ${clientSeed}.`);	

			document.getElementById('BetSizeInput').value = wager;
			document.getElementById('BetSizeInput').dispatchEvent(new Event('blur'));
			document.getElementById('BetChanceInput').value = chanceToWinPercent;
			document.getElementById('BetChanceInput').dispatchEvent(new Event('blur'));
			view.recalculateBetParams(); // update UI with targetProfit
			
			var displayCurrencyId = config.displayCurrencyId;
			var wagerSatoshis = view.parseCommaFloat(wager) * 1e8;
			var range = view.util.getBetRange();
			pipe.server.placeBet(wagerSatoshis, 0, range, clientSeed, displayCurrencyId, true);
		} else {
			rej(`Wager: ${wager}. TargetProfit: ${targetProfit}`);
		}
	});
	
	aPromise.then(async () => {
		placeBetPromiseResolve = undefined;
		const previousBalance = currentBalance;
		currentBalance = getBalanceFromUI();
		maxBalance = Math.max(maxBalance, currentBalance);
		const betProfit = fixDecimal(currentBalance - previousBalance);
		currentProfit = fixDecimal(currentProfit + betProfit);
		maxProfit = Math.max(maxProfit, currentProfit);
		const verificationUrl = document.querySelector('#UserBets tbody tr:first-of-type td:nth-child(2) a').href;
		const rolledNumber = Math.round(parseFloat(document.querySelector('#UserBets tbody tr:first-of-type td:nth-child(2) a span:first-of-type').innerText, 10) * 10000);

		let isValidBet
		try {
			const serverSecretSeed = await getServerSecretSeed(verificationUrl, rolledNumber);
			isValidBet = await validateBetResult(serverSecretSeed, clientSeed, 0, rolledNumber, serverSeedHash);
		} catch (err) {
			log(err);
			isValidBet = false;
		}

		const isLoss = betProfit < 0;
		if (isLoss) {
			lossesInARow = lossesInARow + 1;
			maxLossesInARow = Math.max(maxLossesInARow, lossesInARow);
		} else {
			lossesInARow = 0;
		}
		
		log(`${isLoss ? `   --- LOST (${rolledNumber}) valid: ${isValidBet} ---` : `   --- WON (${rolledNumber}) valid: ${isValidBet} ---`}
Current Balance: ${currentBalance}.      Bet Profit: ${betProfit}.          ResetCount: ${resetCount}
	Max Balance: ${maxBalance}.  Current Profit: ${currentProfit}.       Losses in Row: ${lossesInARow}
									Max Profit: ${maxProfit}.    Max Losses in Row: ${maxLossesInARow}`);

		updateLosses(betProfit);

		log(`-------------------------------------`);
		
		if (keepBetting && isValidBet) {
			setTimeout(() => placeSingleBet(), 0);
		}
	}).catch((err)=>{
		log("Failed to placeSingleBet:", err);
	});
	
	return aPromise;
}

if (!betTableObserver) {
	betTableObserver = createSingleBetMutationObserver();
}
startBetTableObserver();

document.querySelector('#ContentTabsContainer div:nth-child(5)').click();
