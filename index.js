 //XRPWS handles web socket ot listen for incoming payments
var XRPLWS = require('./xrplws');
var xrplws = new XRPLWS(process.env.XRPL_SOCKET_SERVER, process.env.APP_XRPL_ACCOUNT);
xrplws.on('PaymentReceived', function(error, pmt) {
	db.get(pmt.sender, function (err, email) {
		var new_balance = 0;
		if (err || email===null) {
			//TODO: account link doesn't exist - ideally we'd return the payment... or at least send myself an email so I know it is 'lost'
			
		} else {
			db.get(email, function(err, acct) {
				if (err || acct===null) {
					//create account object
					acct = {'balance':0,'confirmViaEmail':true, 'xrplAddress':pmt.sender};
				} else {
					acct = JSON.parse(acct);
					if (acct.xrplAddress!=pmt.sender) {
						//TODO: raise an error!
					}
				}
				
				acct.balance = acct.balance + pmt.amount;
				db.set(email, JSON.stringify(acct));
				console.log("Incoming payment added to account balance.");
			});
		}
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


const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_EMAILER_KEY);

/*
db objects:

Emails:
xrplAccountNumber: emailaddr

Accounts:
emailaddr: {balance,confirmViaEmailBoolean,xrplAccount Number}

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
var session = require('express-session');
app.set('view engine', 'ejs');
app.use('/static', express.static('public'));
app.use(session({secret: 'some secret value, changeme'}));  
var port = process.env.PORT || 8080;

var GoogleStrategy = require('passport-google-oauth20').Strategy;
var passport = require('passport');
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    callbackURL: "https://mail-bounty.com/callback"
  },
  function(accessToken, refreshToken, profile, cb) {
    //User.findOrCreate({ googleId: profile.id }, function (err, user) {
    //  return cb(err, user);
    //});
	console.log('login success');
	console.log(profile);
	return cb(null, profile._json.email);
  }
));
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  done(null, user);
});

function loggedIn(req, res, next) {
    if (req.user) {
        next();
    } else {
        res.redirect('/login');
    }
}

app.post('/place', loggedIn, function(req, res) {
	const messageId = req.body.messageId;
	const validHours = req.body.validHours;
	const recipientEmail = req.body.recipient;
	const amt = req.body.amount;
	const senderEmail = req.user; //not a variable only something we get back from gmail to make sure it is legit.
	//messageId:{amount,expires,paidDate,recipientHash,senderHash}
	//validate input vars??
	//TODO: Future version; put amounts for bounties in escrow or on hold to avoid double spending?  For now just confirm sufficient balance exists.
	db.get(senderEmail, function(err, acct) {
		if (err || acct===null) {
			res.send("Account not found.  Bounty not created");
			return;
		}
		acct = JSON.parse(acct);
		if (acct.balance < amt) {
			res.send("Insufficient funds.  Bounty not created");
			return;
		}
		db.set(messageId, JSON.stringify({'sender':senderEmail, 'recipient':recipientEmail, 'expires':new Date().addHours(validHours),'amount':amount, 'paidDate':''}));
		res.send("Bounty created");
	});	
});

app.post('/pay', loggedIn, function(req, res) {
	const messageId = req.body.messageId;
	const validHours = req.body.validHours;
	const recipientEmail = req.body.recipient;
	const senderEmail = req.user;
	
	db.get(messageId, function(err, bounty) {
		if (err || bounty===null) {
			res.send("Failed: Bounty doesn't exist for this message.");
			return;
		}
		bounty = JSON.parse(bounty);
		if (new Date() > bounty.expires) {
			res.send("Failed: Bounty expired.");
			return;
		}
		if (bounty.recipient != recipientEmail) {
			res.send("Failed: Recipient not included on original bounty.");
			return;
		}
		if (bounty.sender != senderEmail) {
			res.send("Failed: Bounty not issued by you.");
			return;
		}
		//all ok to pay bounty
		db.get(senderEmail, function(err, sAccount) {
			if (err || sAccount===null) {
				res.send("Failed.  No account exists for sender's email (0)."); //can't create one for the sender as it will have 0 balance...
				return;
			}
			sAccount = JSON.parse(sAccount);
			if (sAccount.balance < bounty.amount) {
				res.send("Failed.  Insufficient Funds (0)."); //can't create one for the sender as it will have 0 balance...
				return;
			}
			sAccount.balance = sAccount.balance - bounty.amount;
				
			db.get(recipientEmail, function(err, rAccount) {
				if (err || rAccount===null) {
					//no account exists yet so create one... they can link later...
					rAccount = {'balance':0,'confirmViaEmail':true, 'xrplAddress':pmt.sender};
				} else {
					rAccount = JSON.parse(rAccount);
				}
				rAccount.balance = rAccount.balance + bounty.amount;
				db.set(senderEmail, JSON.stringify(sAccount));
				db.set(recipientEmail, JSON.stringify(rAccount));
					
				const msg = {
				  to: recipientEmail,
				  from: "xrpemailbounty@ripple.com",
				  subject: "You've got XRP",
				  text: senderEmail + ' has put a bounty on an email you responded to.  Visit ' + _WebUrl + '/cashout to claim your ' + bounty.amount + ' XRP or create an account so you can send XRP bounties to get responses to your emails.',
				  html: senderEmail + " has put a bounty on an email you responded to.  Visit <a href='" + _WebUrl + "/cashout'>" + _WebUrl + "/cashout</a> to claim your " + bounty.amount + ' XRP or create an account so you can send XRP bounties to get responses to your emails.'
				};
				sgMail.send(msg);
				
				
				res.send("Bounty paid successfully.");
			});
		});
		
	});
});

app.post('/link', loggedIn, function(req, res) {
	const email = req.body.email;
	const acctId = req.body.account;
	
	//check to see if this email is linked to an account already
	db.get(acctId, function(error, linkedEmail) {
		if (error || linkedEmail === null) { //we do not
			//check to see if this email is registered to another account
			db.get(email, function(err, acct) {
				if (err || acct === null) { // we do not... this is a new link. create it.
					db.set(email, "{'balance':0,'confirmViaEmailBoolean':'true','xrplAccount':'" + acctId + "'}");
					res.send('Success: Ledger account linked to email address.');
					return;
				} else { //account exists for this, but not linked.  Create the link
					db.set(acctId, email);
					res.send('Success: Ledger account linked to email address. (1)');
					return;
				}
			});
		} else { //linked account exists...
			db.get(email, function(err, acct) {
				if (err || acct === null) { // we do not have an account.  Create one...
					db.set(email, "{'balance':0,'confirmViaEmailBoolean':'true','xrplAccount':'" + acctId + "'}");
					res.send('Success: Ledger account linked to email address.');
					return;
				} else { //we do have a link and an account. Confirm they match.
					acct = JSON.parse(acct);
					if (acct.xrplAccount == acctId && linkedEmail == email) {
						res.send('Success: Ledger account already linked to this email address (1).');
						return;
					} else {
						res.send('Error: Ledger account already linked to another email address (1).');
						return;
					}
				}
			});
		}
	});
});

//cash out...  suseptible in that only need email address to do but they can only send the payment to the account associated with the addresss...
app.post('/out', loggedIn, function (req, res) {
	
	const email = req.body.email;
	const amt = req.body.amount;
	
	db.get(email, function(error, acct) {
		if (error || acct===null) {
			res.send('Account not found (1).');
			return;
		}
		acct = JSON.parse(acct);
		if (acct.balance < amt) {
			res.send("Insufficient balance.");
			return;
		}
		xrpl.send(acct.xrplAccount, amt, function(result) {
			if (!result) {
				res.send("Payment failed.");
				return;
			}
			acct.balance = acct.balance - amt;
			db.set(email, JSON.stringify(acct));
			res.send("Success.  Payment sent.");
		});
	});
});

app.get('/', function (req, res) {
	res.sendFile('/app/html/login.html');
});

app.get('/account', loggedIn, function (req, res) {
	res.render('account', {'balance':1500});
	//res.sendFile('/app/html/account.html');
});

app.get('/login', passport.authenticate('google', { scope: ['email'] }));
app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
});
app.get('/callback', passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect home.
   res.redirect('/account');
   //console.log(req);
   res.send("Login success.");
});
  


app.listen(port, function() {
    console.log('Our app is running on http://localhost:' + port);
});


Date.prototype.addHours = function(h) {
  this.setTime(this.getTime() + (h*60*60*1000));
  return this;
}

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
X Pay out bounty (verify it exists, Connect to Redis and store/retreive bounties, mark completed, if confirm via email send email to recipient)
X Verify balance exists and return hash to include in email - queried via ajax from extension when inserting bounty
---
Settings:
X xrpl account #
X Figure out most secure secret storage on herkoku



Future consideration:
confirm via email on

Could a chrome extension securely operate and sign transactions locally?  If so, we could operate directly on ledger.
Guidelines for supporting an exchange and cold wallet security

1) account balance / escrow

2) pay (from,to)

3) Generate a new account??

4) Use destination tags to allow one account id to fund multiple email address accounts

*/




