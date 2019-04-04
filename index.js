'use strict';
const RippleAPI = require('ripple-lib').RippleAPI;

const api = new RippleAPI({
  server: 'wss://s.altnet.rippletest.net:51233' // test rippled server
});
var maxLedgerVersion;
var txID;
var stillWaiting;
var latestLedgerVersion;
var isConnected = false;

/*
TODO:

1) account balance

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

api.on('ledger', ledger => {
  console.log("Ledger version", ledger.ledgerVersion, "was just validated.")
	latestLedgerVersion = ledger.ledgerVersion;
});

api.connect().then(() => {
	isConnected = true;
	console.log("Connected");
}).catch(console.error);

// set the home page route
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

    /* end custom code -------------------------------------- */
  }).then(txBlob => {
	stillWaiting = true
	return doSubmit(txBlob)
  }).then(earliestLedgerVersion => {
	  return res.send("{'txId':'" + txID + "', 'earliestLedger':'" + earliestLedgerVersion[0] + "', 'maxLedger':'" + maxLedgerVersion + "', 'tenativeCode':'" + earliestLedgerVersion[1] + "', 'tenativeMessage':'" + earliestLedgerVersion[2] + "'}");
  })
});

app.listen(port, function() {
    console.log('Our app is running on http://localhost:' + port);
});



async function doPrepare() {
	const sender = "rLZYQ2AES7huGFMtwDcjnFd9yK3L9zMKbp"
	const preparedTx = await api.prepareTransaction({
	  "TransactionType": "Payment",
	  "Account": sender,
	  "Amount": api.xrpToDrops("22"), // Same as "Amount": "22000000"
	  "Destination": "rUCzEr6jrEyMpjhs4wSdQdz4g8Y382NxfM"
	}, {
	  // Expire this transaction if it doesn't execute within ~5 minutes:
	  "maxLedgerVersionOffset": 75
	})
	maxLedgerVersion = preparedTx.instructions.maxLedgerVersion
	console.log("Prepared transaction instructions:", preparedTx.txJSON)
	console.log("Transaction cost:", preparedTx.instructions.fee, "XRP")
	console.log("Transaction expires after ledger:", maxLedgerVersion)
	return preparedTx.txJSON
}

async function doSubmit(txBlob) {
	const latestLedgerVersion = await api.getLedgerVersion()
  	const result = await api.submit(txBlob)
  	console.log("Tentative result code:", result.resultCode)
  	console.log("Tentative result message:", result.resultMessage)
	
  	// Return the earliest ledger index this transaction could appear in
  	// as a result of this submission, which is the first one after the
  	// validated ledger at time of submission.
  	return [latestLedgerVersion + 1, result.resultCode, result.resultMessage]
}
	
async function validateTx(earliestLedgerVersion) {
  try {
	  console.log("validating Transaction: " + txID)
    tx = await api.getTransaction(txID, {minLedgerVersion: earliestLedgerVersion})
    console.log("Transaction result:", tx.outcome.result)
    console.log("Balance changes:", JSON.stringify(tx.outcome.balanceChanges))
	 return [true, "Transaction result:" + tx.outcome.result]
  } catch (error) {
    console.log("Couldn't get transaction outcome:", error)
	  return [false, "Couldn't get transaction outcome:" + error]
	  
  }  
}
/*

Address: rLZYQ2AES7huGFMtwDcjnFd9yK3L9zMKbp
Secret: shA7JyMcxqp7aK38GLpYpFbJ5q65M


{
  "TransactionType": "Payment",
  "Account": "rLZYQ2AES7huGFMtwDcjnFd9yK3L9zMKbp",
  "Amount": "2000000",
  "Destination": "rUCzEr6jrEyMpjhs4wSdQdz4g8Y382NxfM"
}


*/
