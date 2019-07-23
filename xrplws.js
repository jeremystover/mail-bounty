// Require our emitter
var events = require('events');
var WebSocket = require('ws');
const AWAITING = {}
let autoid_n = 0

// Our main constructor function
var XRPLWS = function (server, appAccount) {
  // extend with emitter
	//this = new events.EventEmitter();
	var self = this;
	this.account = appAccount;
	this.ws = server;
	
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
	
	this.destroy = function() {
		//TODO: Close any open connections and prepare object to go away.
	}
	return this;
};

// Inherit from emitter, but retain constructor
XRPLWS.prototype = Object.create(events.EventEmitter.prototype, {
  constructor: {
    value: XRPLWS
  }
});

// Export it to the world
module.exports = XRPLWS;


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