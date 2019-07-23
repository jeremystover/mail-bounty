 //XRPWS handles web socket ot listen for incoming payments
var XRPLWS = require('./xrplws');
var xrplws = new XRPLWS(process.env.XRPL_SOCKET_SERVER, process.env.APP_XRPL_ACCOUNT);
xrplws.on('PaymentReceived', function(error, pmt) {
	db.get(pmt.sender, function (err, acct) {
		var new_balance = 0;
		if (err || acct===null) {
			//account doesn't exist
			acct = {'balance':pmt.amount,'confirmViaEmail':true, 'email':''};
		} else {
			acct = JSON.parse(acct);
			acct.balance = acct.balance + pmt.amount;
		}
		db.set(pmt.sender, JSON.stringify(acct));
		console.log("Incoming payment added to account balance.");
	});
});
xrplws.on("wsDisconnect", function(data) {
	console.log("Web Socket Disconnected.  Need to restart");
	xrplws.destroy();
	//attempt to reconnect
	xrplws = new XRPL(xrpl_ws_server, );
});

var XRPL = require('./xrpl');
var xrpl = new XRPL(process.env.XRPL_SERVER, process.env.APP_XRPL_ACCOUNT, process.env.APP_XRPL_SECRET);



/*
db objects:

Emails:
emailaddr:xrplAccountNumber

Accounts:
xrplAccountNumber:{balance,confirmViaEmailBoolean,email}

Bounties:
messageId:{amount,expires,paidDate,recipientHash,senderHash}

XRPL Transactions:
transactionId:{date, amount, xrplAccount, sendOrReceive}

*/

var db = require('redis').createClient(process.env.REDISCLOUD_URL);
db.on('connect', function() {
    console.log('Redis client connected');
});
db.on('error', function (err) {
    console.log('Something went wrong ' + err);
});

var express = require('express');
var app = express();
app.set('view engine', 'ejs');
app.use(express.static(__dirname + '/public'));
var port = process.env.PORT || 8080;

var GoogleStrategy = require('passport-google-oauth20').Strategy;
var passport = require('passport');
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    callbackURL: "https://xrp-mail-bounty.herokuapp.com/callback"
  },
  function(accessToken, refreshToken, profile, cb) {
    //User.findOrCreate({ googleId: profile.id }, function (err, user) {
    //  return cb(err, user);
    //});
	console.log('login success');
	console.log(profile._json.email);
	return cb(null, profile._json.email);
  }
));
// set the port of our application
// process.env.PORT lets the port be set by Heroku

// set the view engine to ejs


// make express look in the public directory for assets (css/js/img)

function loggedIn(req, res, next) {
    if (req.user) {
        next();
    } else {
        res.redirect('/login');
    }
}


app.get('/place', loggedIn, function(req, res) {
	//const messageId = req.body.messageId;
	//const validHours = req.body.validHours;
	//const recipientEmail = req.body.recipient;
	//const senderEmail = req.body.sender;
	res.send(req.user);
	//messageId:{amount,expires,paidDate,recipientHash,senderHash}
	//vulnerable in that anyone could create a bounty and claim it for themselves...
	
});

app.post('/claim', loggedIn, function(req, res) {
	
	
});

app.post('/link', loggedIn, function(req, res) {
	//TODO: Link email address to xrpl Account Number so we're set to receive payment.
	const email = req.body.email;
	const acctId = req.body.account;
	
	//check to see if we have an account already
	db.get(acctId, function(error, data) {
		if (error || data === null) { //we do not
			//check to see if this email is registered to another account
			db.get(email, function(err, acct) {
				if (err || data === acct) { // we do not... this is a new link. create it.
					db.set(email, acctId);
					db.set(acctId, "{'balance':0,'confirmViaEmailBoolean':'true','email':'" + email + "'}");
					res.send('Success: Ledger account linked to email address.');
					return;
				} else { //account linked to another id...  possibly handle in the future 
					res.send('Error: Ledger account already linked to another email address (0).');
					return;
				}
			});
		} else {
			var acct = JSON.parse(data);
			if (!acct.email || acct.email=="") {
			
				//check to see if email is registered
				db.get(email, function(err, acct) {
					if (err || data === acct) { // we do not... this is a new link. create it.
						db.set(email, acctId);
						acct.email = email;
						db.set(acctId, JSON.stringify(acct));
						res.send('Success: Ledger account linked to email address.');
						return;
					} else { //we do have a link, but not an account.  create one.
						db.set(acctId, "{'balance':0,'confirmViaEmailBoolean':'true','email':'" + email + "'}");
						res.send('Error: Ledger account already linked to another email address (1).');
						return;
					}
				});
			} else { //there is an account with an email.  Need to throw an error here as it is not clear what to do.  
				//add the link to the existing email.
				db.set(acct.email, acctId);
				res.send('Error: Ledger account already linked to another email address (2).');
				return;
			}
		}
		
	});
	
});

//cash out...  suseptible in that only need email address to do but they can only send the payment to the account associated with the addresss...
app.post('/out', loggedIn, function (req, res) {
	
	const email = req.body.email;
	const amt = req.body.amount;
	
	db.get(email, function(error, acctId) {
		if (error || acctId===null) {
			res.send('Account not found (1).');
			return;
		}
		db.get(acctId, function(err, acct) {
			if (err || acct===null) {
				res.send('Account not found (2).');
				return;
			}
			acct = JSON.parse(acct);
			if (acct.balance < amt) {
				res.send("Insufficient balance.");
				return;
			}
			xrpl.send(acctId, amt, function(result) {
				if (!result) {
					res.send("Payment failed.");
					return;
				}
				acct.balance = acct.balance - amt;
				db.set(acctId, JSON.stringify(acct));
				res.send("Success.  Payment sent.");
			});
		});
		
	});
})





app.get('/login', passport.authenticate('google', { scope: ['email'] }));

app.get('/callback', passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect home.
   //res.redirect('/');
   res.send("Login success.");
});
  


app.listen(port, function() {
    console.log('Our app is running on http://localhost:' + port);
});




/*
TODO:

For MVP: 

---
>> Cash in instructions page that generates destination tag (require destination tag on incoming) + creates account with gmail saml
X ** Monitor incoming payments: https://xrpl.org/monitor-incoming-payments-with-websocket.html
X Connect to Redis to update balance amounts
--- 
>> Cash out request page that requires gmail saml login and UX to enter amount
X ** XRPL transaction to receiver address
---
GMAIL Integration:
Pay out bounty (verify it exists, Connect to Redis and store/retreive bounties, mark completed, if confirm via email send email to recipient)
Verify balance exists and return hash to include in email - queried via ajax from extension when inserting bounty
---
Settings:
xrpl account #
confirm via email on
Figure out most secure secret storage on herkoku



Future consideration:

Could a chrome extension securely operate and sign transactions locally?  If so, we could operate directly on ledger.
Guidelines for supporting an exchange and cold wallet security

1) account balance / escrow

2) pay (from,to)

3) Generate a new account??

4) Use destination tags to allow one account id to fund multiple email address accounts

*/




