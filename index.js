'use strict';
const RippleAPI = require('ripple-lib').RippleAPI;

const api = new RippleAPI({
  server: 'wss://s.altnet.rippletest.net:51233' // test rippled server
});
var maxLedgerVersion;
var txID;


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

// set the home page route

app.get('/', function(req, res) {
  return res.send('Received a GET HTTP method');
  
  
  api.connect().then(() => {
    /* begin custom code ------------------------------------ */
	
    return doPrepare()


	
    //const myAddress = 'rf1BiGeXwwQoi8Z2ueFYTEXSwuJYfV2Jpn';

    //console.log('getting account info for', myAddress);
    //return api.getAccountInfo(myAddress);

  }).then(txJSON => {
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
	return doSubmit(txBlob)
  }).then(earliestLedgerVersion => {
	  res.send(validateTx(earliestLedgerVersion))
  }).then(() => {
    return api.disconnect();
  }).then(() => {
    console.log('done and disconnected.');
  }).catch(console.error);
  
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
  	return latestLedgerVersion + 1
}
	
async function validateTx(earliestLedgerVersion, res) {
  try {
    tx = await api.getTransaction(txID, {minLedgerVersion: earliestLedgerVersion})
    console.log("Transaction result:", tx.outcome.result)
    console.log("Balance changes:", JSON.stringify(tx.outcome.balanceChanges))
	 return "Transaction result:" + tx.outcome.result
  } catch(error) {
    console.log("Couldn't get transaction outcome:", error)
	  return "Couldn't get transaction outcome:" + error
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
