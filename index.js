
//XRPWS handles web socket ot listen for incoming payments
var XRPLWS = require('./xrplws');
var xrplws = new XRPLWS('wss://s.altnet.rippletest.net:51233', 'rUCzEr6jrEyMpjhs4wSdQdz4g8Y382NxfM');
xrplws.on('PaymentReceived', function(data) {
	
});
xrplws.on("wsDisconnect", function(data) {
	console.log("Web Socket Disconnected.  Need to restart");
	xrplws.destroy();
	//attempt to reconnect
	xrplws = new XRPL('wss://s.altnet.rippletest.net:51233', 'rUCzEr6jrEyMpjhs4wSdQdz4g8Y382NxfM');
});


//NEXT STEP - setup database and record incoming payment to account balance...
/*
db objects:

Accounts:
hashFromEmail:{balance,xrpl_address,confirmViaEmailBoolean}

Bounties:
messageId:{amount,expires,paidDate,recipientHash,senderHash}

XRPL Transactions:
transactionId:{date, amount, xrplAccount, sendOrReceive}

*/

var db = require('redis').createClient(process.env.REDIS_URL);
db.on('connect', function() {
    console.log('Redis client connected');
});
db.on('error', function (err) {
    console.log('Something went wrong ' + err);
});

db.set('my test key', 'my test value');
db.get('my test key', function (error, result) {
    if (error) {
        console.log(error);
        throw error;
    }
    console.log('GET result ->' + result);
});



return;



/*
TODO:

For MVP: 

---
Cash in instructions page that generates destination tag (require destination tag on incoming) + creates account with gmail saml
** Monitor incoming payments: https://xrpl.org/monitor-incoming-payments-with-websocket.html
Connect to Redis to update balance amounts
---
Pay out bounty (verify it exists, Connect to Redis and store/retreive bounties, mark completed, if confirm via email send email to recipient)
--
Settings:
xrpl account #
confirm via email on
--- 
Cash out request page that requires gmail saml login and UX to enter amount
** XRPL transaction to receiver address
--- 
Verify balance exists and return hash to include in email - queried via ajax from extension when inserting bounty
---
Figure out most secure secret storage on herkoku



Future consideration:

Could a chrome extension securely operate and sign transactions locally?  If so, we could operate directly on ledger.
Guidelines for supporting an exchange and cold wallet security

1) account balance / escrow

2) pay (from,to)

3) Generate a new account??

*/


var express = require('express');
var app = express();

// set the port of our application
// process.env.PORT lets the port be set by Heroku
var port = process.env.PORT || 8080;
// set the view engine to ejs
app.set('view engine', 'ejs');

// make express look in the public directory for assets (css/js/img)
app.use(express.static(__dirname + '/public'));

/* set the home page route
app.get('/verify/:id/:earliestLedgerVersion/:maxLedgerVersion', function(req,res) {
    console.log("verifying payment");
	if (!isConnected) { 
		res.send("Not connected.");
		return;
	} 	
	validateTx(req.params.earliestLedgerVersion).then(txResponse => {
  		if (txResponse[0]) {
			res.send(txResponse[1]);
		} else if (latestLedgerVersion > req.params.maxLedgerVersion) {
			res.send(txResponse[1]);
		} else {
			res.send("Transaction still pending.");
		}
	});
});



app.get('/send', function(req, res) {
  //return res.send('Received a GET HTTP method');
  console.log("Sending payment...");
  if (!isConnected)  {
	  res.send("Not connected.");
  	return;
	}
  	
    doPrepare().then(txJSON => {
	  const response = api.sign(txJSON, "shA7JyMcxqp7aK38GLpYpFbJ5q65M")
	  txID = response.id
	  console.log("Identifying hash:", txID)
	  const txBlob = response.signedTransaction
	  console.log("Signed blob:", txBlob)
	  return txBlob
	
	//console.log(info);
    //console.log('getAccountInfo done');

    /* end custom code -------------------------------------- 
  }).then(txBlob => {
	stillWaiting = true
	return doSubmit(txBlob)
  }).then(earliestLedgerVersion => {
	  return res.send("{'txId':'" + txID + "', 'earliestLedger':'" + earliestLedgerVersion[0] + "', 'maxLedger':'" + maxLedgerVersion + "', 'tenativeCode':'" + earliestLedgerVersion[1] + "', 'tenativeMessage':'" + earliestLedgerVersion[2] + "'}");
  })
});
*/

app.listen(port, function() {
    console.log('Our app is running on http://localhost:' + port);
});


