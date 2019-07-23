
// Require our emitter
var events = require('events');
const RippleAPI = require('ripple-lib').RippleAPI;
//var WebSocket = require('websocket');
var WebSocket = require('ws');
const AWAITING = {}
let autoid_n = 0

//

// Our main constructor function
var XRPL = function (server, appAccount) {
  // extend with emitter
	//this = new events.EventEmitter();
	var self = this;
	this.account = appAccount;
	this.ws = server;
	this.api = new RippleAPI({
	  server: server // test rippled server
	});
	this.maxLedgerVersion;
	this.txID;
	this.stillWaiting;
	this.latestLedgerVersion;
	this.isConnected = false;
	
	this.api.connect().then(() => {
		this.isConnected = true;
		console.log("Connected");
	}).catch(console.error);
	
	
	
	
	
	
	//BEGIN WEBSOCKET FOR INCOMING PAYMENTS
	
	this.socket = new WebSocket(this.ws)
	this.socket.addEventListener('open', (event) => {
	  // This callback runs when the connection is open
	  console.log("Incoming payment WebSocket connected!")
	  //this.emit('wsConnect',this.ws);
	  this.do_subscribe();
	  
	  const command = {
	    "id": "on_open_ping_1",
	    "command": "ping"
	  }
	  this.socket.send(JSON.stringify(command))
	  
	});
	this.socket.addEventListener('message', (event) => {
	  
		if (event.data.type == "transaction" && 
		event.data.validated && 
		event.data.status == "closed" && 
		event.data.meta.TransactionResult !== "tesSUCCESS" && 
		event.data.transaction.TransactionType=="payment" && 
		event.data.transaction.Destination==this.account &&
		typeof event.data.meta.delivered_amount === "string") {
			
			console.log('Got XRP payment message from server:', event.data)

		    const amount_in_drops = new Big(event.data.meta.delivered_amount)
		    const xrp_amount = amount_in_drops.div(1e6)
		    console.log("Received " + xrp_amount.toString() + " XRP.")
		 
			this.emit("PaymentReceived", {"sender":event.data.transaction.Account,"amount":xrp_amount,"date":event.data.transaction.date});
			
		}	else {
			console.log('Ignoring non-payment message from server:', event.data)
		}
	});
	this.socket.addEventListener('close', (event) => {
	  // Use this event to detect when you have become disconnected
	  // and respond appropriately.
	  console.log('Incoming payment WebSocket disconnected...')
	  this.emit('wsDisconnect',"Error: No longer listening for incoming payments.  Please restrart.");
	});
	this.socket.addEventListener('message', (event) => {
	  const parsed_data = JSON.parse(event.data)
	  if (ws_HANDLERS.hasOwnProperty(parsed_data.type)) {
	    // Call the mapped handler
	    ws_HANDLERS[parsed_data.type](parsed_data)
	  } else {
	    console.log("Unhandled message from server", event)
	  }
	});
	
	this.do_subscribe = async function () {
		console.log("Attempting subscription");
	  const sub_response = await this.api_request({
	    command:"subscribe",
	    accounts: [this.account]
	  })
	  if (sub_response.status === "success") {
	    console.log("Successfully subscribed!")
	  } else {
	    console.error("Error subscribing: ", sub_response)
	  }
	}
	
	this.api_request = function(options) {
	  if (!options.hasOwnProperty("id")) {
	    options.id = "autoid_" + (autoid_n++)
	  }

	  let resolveHolder;
	  AWAITING[options.id] = new Promise((resolve, reject) => {
	    // Save the resolve func to be called by the handleResponse function later
	    resolveHolder = resolve
	    try {
	      // Use the socket opened in the previous example...
			//if (socket && this.isConnected) 
				this.socket.send(JSON.stringify(options))
	    } catch(error) {
	      reject(error)
	    }
	  })
	  AWAITING[options.id].resolve = resolveHolder;
	  return AWAITING[options.id]
	}
	//END WEB SOCKET CODE
	
	
	
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






const handleResponse = function(data) {
  if (!data.hasOwnProperty("id")) {
    console.error("Got response event without ID:", data)
    return
  }
  if (AWAITING.hasOwnProperty(data.id)) {
    AWAITING[data.id].resolve(data)
  } else {
    console.error("Response to un-awaited request w/ ID " + data.id)
  }
}


const log_tx = function(tx) {
  console.log(tx.transaction.TransactionType + " transaction sent by " +
              tx.transaction.Account +
              "\n  Result: " + tx.meta.TransactionResult +
              " in ledger " + tx.ledger_index +
	"\n  Validated? " + tx.validated);
	
}

ws_HANDLERS = {
  "response": handleResponse,
	"transaction": log_tx
  // Fill this out with your handlers in the following format:
  // "type": function(event) { /* handle event of this type */ }
}

	







return;






/*
TODO:

Monitor incoming payments: https://xrpl.org/monitor-incoming-payments-with-websocket.html
XRPL transaction to receiver address
*/

//Monitor for incoming payments from xrpledger:
//https://xrpl.org/monitor-incoming-payments-with-websocket.html














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
	  "Destination": "rUCzEr6jrEyMpjhs4this.wsdQdz4g8Y382NxfM"
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
  "Destination": "rUCzEr6jrEyMpjhs4this.wsdQdz4g8Y382NxfM"
}


*/
