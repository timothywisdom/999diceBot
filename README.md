# 999diceBot

A JavaScript Bot for 999dice.com

1. Go to https://www.999dice.com/?388516348 (note this is my referral link so I'll get a kickback from the site, as a thanks for the bot)
2. Get some "Free Dogecoin" from the faucet
3. Hit F12 to open your Dev Tools
4. Open the Javascript console tab
5. Copy and Paste the contents of index.js into the Javascript console and press Enter. WARNING: Unless you understand JavaScript code, I highly recommend never doing this with code you don't understand or from people you don't know and trust.
6. Type "start()" and press Enter to start the bot
7. Watch the JavaScript console for output of what's happening
8. Type "stop()" and press Enter to stop the bot

This is a bot that will attempt to win at 999dice.com.
The bot will place a bet for 0.01% of your earnings with a 51% chance to win. If it loses, it will then calculate the wager needed to win back your last loss with a 95% chance of winning.
At 0.01% of your balance, you can afford to lose 4 times in a row, which has a probability of 0.006125% of happening. It should be noted that we've seen 3 losses in a row happen many times (which has a 0.1225% chance).

Lost bets are validated using the Server Seed, your Client Seed and Nonce of 0.

## Configuration
Change the values of the following parameters to alter how the bot behaves. To alter a parameter, type
> [parameterName] = [value]

into the JavaScript Console.

|Parameter Name                       | Default Value |Notes                                                                  |
|:------------------------------------|:-------------:|:---------------------------------------------------------------------|
|defaultWagerPercentOfBalance         | 0.01          |Percent of your current balance that is wagered if you have no losses |
|defaultChanceToWinPercent            | 51            |Your "Chance to Win" if you have no losses                       |
|defaultChanceToWinAgainstLostPercent | 95            |Your "Chance to Win" if you have losses                      |

If you increase defaultWagerPercentOfBalance, you'll win faster but you're likely to not have enough balance to overcome a losing streak (of 3 or more losses in a row).

## Bet Validation
Every losing bet is validated using the algorithm given by the site. I've written the validation code in C# and again in JavaScript. Before each bet, the site gives you the hashed version of the ServerSeed. You choose the ClientSeed and the BetId is always 0 (for single bets). The rolled number is calculated by concatenating:

> ServerSeed + ClientSeed + BetId

then hashing that (twice) and then extracting bits to "roll" the number. You can validate any bet via JavaScript or C# (I recommend using LinqPad, a free C# app, to run the BetValidator.cs file).

The command (in both JS and C#) is:
> validateBetResult([ServerSeed], [ClientSeed], [BetId (i.e. 0)], [BetResult], [ServerSeedHashed])

Validation will check that when the ServerSeed is hashsed, it will produce ServerSeedHashed. Then it will attempt to recreate the BetResult using the above formula.

## WARNING

The site has caused this bot to lose 3 times in a row with a 95% chance to win each bet. This has a mathematical 0.1225% chance of happening (consecutively), yet it happens multiple times in a day - so the site is suspicious!

I have also seen a few losing bets fail validation, which means the site could be cheating. I'm still validating if there's not a timing bug in the bot code, which might also produce this result.

Suffice to say, I don't fully trust this site to be 100% provably fair, as they claim.
