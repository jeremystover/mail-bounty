
// Require our emitter
var events = require('events');
const RippleAPI = require('ripple-lib').RippleAPI;

// Our main constructor function
var XRPL = function (server, appAccount, secretKey) {
  // extend with emitter
	//this = new events.EventEmitter();
	var self = this;
	this.account = appAccount;
	this.ws = server;  //server should be localhost...
	console.log(server);
	console.log(appAccount);
	console.log(secretKey); 
	this.serverAPI = new RippleAPI({
	  server: server // test rippled server
	});
	
	this.maxLedgerVersion;
	this.txID;
	this.stillWaiting;
	this.latestLedgerVersion;
	this.isConnected = false;
	this.secretKey = secretKey; //"";
	this.earliestLedgerVersion;
	
	this.signingAPI = new RippleAPI(); //local and used for signing securely
	
	
	this.serverAPI.connect().then(() => {
		this.isConnected = true;
		console.log("Connected");
	}).catch(console.error);
	
	this.send = async function(toAccount, amount,callback) {
	  console.log("Sending payment...");
	  if (!isConnected)  {
		  console.log("Not connected. Send failed.");
	  	  this.emit("PaymentFailed","Not Connected");
		  callback(false, {});
	  }
  	
	  doPrepare(this.account, amount, toAccount, this.signingAPI).then(data => {
		  const txJSON = data.preparedTx;
		  self.maxLedgerVersion = data.maxLedgerVersion;
		  
		  const response = self.signingAPI.sign(txJSON, self.secretKey)
		  self.txID = response.id
		  
		  console.log("Identifying hash:", txID)
		  const txBlob = response.signedTransaction
		  console.log("Signed blob:", txBlob)
		  
		  return txBlob
      }).then(txBlob => {
		self.stillWaiting = true
		return doSubmit(txBlob, self.serverAPI)
	  }).then(earliestLedgerVersion => {
		  this.emit("PaymentSuccess", {'txId':self.txID, 'earliestLedger':earliestLedgerVersion[0], 'maxLedger':self.maxLedgerVersion, 'tenativeCode':earliestLedgerVersion[1], 'tenativeMessage':earliestLedgerVersion[2]});
		  self.earliestLedgerVersion = earliestLedgerVersion[0];
		  callback(true, {'amount':amount,'toAccount':toAccount,'txId':self.txID, 'earliestLedger':earliestLedgerVersion[0], 'maxLedger':self.maxLedgerVersion, 'tenativeCode':earliestLedgerVersion[1], 'tenativeMessage':earliestLedgerVersion[2]});
		  //include verification step here so we can return success?
		  this.verify();
	  });
	};
	
	this.verify = function () {
			if (!this.isConnected) { 
	  		  console.log("Not connected. Verify failed.");
	  	  	  this.emit("VerificationFailed","Not Connected");
			} 	
			validateTx(this.earliestLedgerVersion, this.txID, this.serverAPI).then(txResponse => {
		  		if (txResponse[0]) {
					this.emit("VerificationResponse", txResponse[1]);
				} else if (self.latestLedgerVersion > maxLedgerVersion) { //this is not updating... need to redo with lates on dev site.
					this.emit("VerificationResponse", txResponse[1]);
				} else {
					this.emit("VerificationResponse","Transaction still pending.");
				}
			});
	
	};
	
	this.destroy = function() {
		//TODO: Close any open connections and prepare object to go away.
	}
	return this;
};

// Inherit from emitter, but retain constructor
XRPL.prototype = Object.create(events.EventEmitter.prototype, {
  constructor: {
    value: XRPL
  }
});

// Export it to the world
module.exports = XRPL;

async function doPrepare(sender, xrpamount, recipient, api) {
	const preparedTx = await api.prepareTransaction({
	  "TransactionType": "Payment",
	  "Account": sender,
	  "Amount": api.xrpToDrops(xrpamount), // Same as "Amount": "22000000"
	  "Destination": recipient
	}, {
	  // Expire this transaction if it doesn't execute within ~5 minutes:
	  "maxLedgerVersionOffset": 75
	})
	maxLedgerVersion = preparedTx.instructions.maxLedgerVersion
	console.log("Prepared transaction instructions:", preparedTx.txJSON)
	console.log("Transaction cost:", preparedTx.instructions.fee, "XRP")
	console.log("Transaction expires after ledger:", maxLedgerVersion)
	return {"preparedTx": preparedTx.txJSON, "maxLedger": maxLedgerVersion};
}

async function doSubmit(txBlob, api) {
	const latestLedgerVersion = await api.getLedgerVersion()
  	const result = await api.submit(txBlob)
  	console.log("Tentative result code:", result.resultCode)
  	console.log("Tentative result message:", result.resultMessage)
	
  	// Return the earliest ledger index this transaction could appear in
  	// as a result of this submission, which is the first one after the
  	// validated ledger at time of submission.
  	return [latestLedgerVersion + 1, result.resultCode, result.resultMessage]
}
	
async function validateTx(earliestLedgerVersion, txID, api) {
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
  "Destination": "rUCzEr6jrEyMpjhs4this.wsdQdz4g8Y382NxfM"
}


*/
