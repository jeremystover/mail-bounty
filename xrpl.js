
// Require our emitter
var events = require('events');
const RippleAPI = require('ripple-lib').RippleAPI;
//var WebSocket = require('websocket');
var WebSocket = require('ws');
var socket;
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
	
	
	
	socket = new WebSocket(this.ws)
	socket.addEventListener('open', (event) => {
	  // This callback runs when the connection is open
	  console.log("Connected!")
		this.emit('wsConnect',this.ws);
	  const command = {
	    "id": "on_open_ping_1",
	    "command": "ping"
	  }
	  socket.send(JSON.stringify(command))
	});
	socket.addEventListener('message', (event) => {
	  console.log('Got message from server:', event.data)
	});
	socket.addEventListener('close', (event) => {
	  // Use this event to detect when you have become disconnected
	  // and respond appropriately.
	  console.log('Disconnected...')
	});
	socket.addEventListener('message', (event) => {
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
	    accounts: ["rp5U7pmw6uupPwcTZrdH9saucwuFB5zTkD"]
	  })
	  console.log("Got something back.");
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
			if (socket && this.isConnected) socket.send(JSON.stringify(options))
	    } catch(error) {
	      reject(error)
	    }
	  })
	  AWAITING[options.id].resolve = resolveHolder;
	  return AWAITING[options.id]
	}
	
	return this;
};

// Inherit from emitter, but retain constructor
XRPL.prototype = Object.create(events.EventEmitter.prototype, {
  constructor: {
    value: XRPL
  }
});

XRPL.prototype.setName = function (newName) {
  this.name = newName;
  // We can trigger arbitrary events
  // these are just hooks that other
  // code could chose to listen to.
  

	
  this.emit('nameChanged', newName);
};

XRPL.prototype.watch = function() {
	this.do_subscribe()
}
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









function CountXRPDifference(affected_nodes, address) {
  // Helper to find an account in an AffectedNodes array and see how much
  // its balance changed, if at all. Fortunately, each account appears at most
  // once in the AffectedNodes array, so we can return as soon as we find it.

  // Note: this reports the net balance change. If the address is the sender,
  // the transaction cost is deducted and combined with XRP sent/received

  for (let i=0; i<affected_nodes.length; i++) {
    if ((affected_nodes[i].hasOwnProperty("ModifiedNode"))) {
      // modifies an existing ledger entry
      let ledger_entry = affected_nodes[i].ModifiedNode
      if (ledger_entry.LedgerEntryType === "AccountRoot" &&
          ledger_entry.FinalFields.Account === address) {
        if (!ledger_entry.PreviousFields.hasOwnProperty("Balance")) {
          console.log("XRP balance did not change.")
        }
        // Balance is in PreviousFields, so it changed. Time for
        // high-precision math!
        const old_balance = new Big(ledger_entry.PreviousFields.Balance)
        const new_balance = new Big(ledger_entry.FinalFields.Balance)
        const diff_in_drops = new_balance.minus(old_balance)
        const xrp_amount = diff_in_drops.div(1e6)
        if (xrp_amount.gte(0)) {
          console.log("Received " + xrp_amount.toString() + " XRP.")
          return
        } else {
          console.log("Spent " + xrp_amount.abs().toString() + " XRP.")
          return
        }
      }
    } else if ((affected_nodes[i].hasOwnProperty("CreatedNode"))) {
      // created a ledger entry. maybe the account just got funded?
      let ledger_entry = affected_nodes[i].CreatedNode
      if (ledger_entry.LedgerEntryType === "AccountRoot" &&
          ledger_entry.NewFields.Account === address) {
        const balance_drops = new Big(ledger_entry.NewFields.Balance)
        const xrp_amount = balance_drops.div(1e6)
        console.log("Received " + xrp_amount.toString() + " XRP (account funded).")
        return
      }
    } // accounts cannot be deleted at this time, so we ignore DeletedNode
  }

  console.log("Did not find address in affected nodes.")
  return
}

function CountXRPReceived(tx, address) {
  if (tx.meta.TransactionResult !== "tesSUCCESS") {
    console.log("Transaction failed.")
    return
  }
  if (tx.transaction.TransactionType === "Payment") {
    if (tx.transaction.Destination !== address) {
      console.log("Not the destination of this payment.")
      return
    }
    if (typeof tx.meta.delivered_amount === "string") {
      const amount_in_drops = new Big(tx.meta.delivered_amount)
      const xrp_amount = amount_in_drops.div(1e6)
      console.log("Received " + xrp_amount.toString() + " XRP.")
      return
    } else {
      console.log("Received non-XRP currency.")
      return
    }
  } else if (["PaymentChannelClaim", "PaymentChannelFund", "OfferCreate",
          "CheckCash", "EscrowFinish"].includes(
          tx.transaction.TransactionType)) {
    CountXRPDifference(tx.meta.AffectedNodes, address)
  } else {
    console.log("Not a currency-delivering transaction type (" +
                tx.transaction.TransactionType + ").")
  }
}










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
