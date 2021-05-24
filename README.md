# 999diceBot

A JavaScript Bot for 999dice.com

1. Go to https://www.999dice.com/
2. Get some "Free Dogecoin" from the faucet
3. Hit F12 to open your Dev Tools
4. Open the Javascript console tab
5. Copy and Paste the contents of index.js into the Javascript console and press Enter
6. Type "start()" and press Enter to start the bot
7. Watch the JavaScript console for output of what's happening
8. Type "stop()" and press Enter to stop the bot

This is a bot that will attempt to win at 999dice.com.
The bot will place a bet for 0.01% of your earnings with a 51% chance to win. If it loses, it will then calculate the wager needed to win back your last loss with a 95% chance of winning.
At 0.01% of your balance, you can afford to lose 4 times in a row, which has a probability of 0.006125% of happening. It should be noted that we've seen 3 losses in a row happen many times (which has a 0.1225% chance).

Lost bets are validated using the Server Seed, your Client Seed and Nonce of 0.

## WARNING

The site has caused this bot to lose 3 times in a row with a 95% chance to win each bet. This has a mathematical 0.1225% chance of happening (consecutively), yet it happens multiple times in a day - so the site is suspicious!
