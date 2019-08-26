/*

Next steps:

**) Extension - hook up to API functions (place (on send), pay (check incoming msgs)); cleanup app button look/feel; 


1) account totals bug with nan
2) About and app web page content (link to chrome extension in webstore)
3) Process withdrawl form submission / test in and out


4) Hook up to real XRP ledger after testing
5) Better logging of requests, IPs, hacking detection

*/
//used to verify chrome extension requests
const CLIENT_ID = '450274019939-ecc4cpim20h7se1a55l7539414nkvurl.apps.googleusercontent.com';
const {OAuth2Client} = require('google-auth-library');
const client = new OAuth2Client(CLIENT_ID);
const _WebUrl = "https://mail-bounty.com";

var https = require('https');

const {Encode, Decode} = require('xrpl-tagged-address-codec');
 
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
					acct = {'balance':0,'confirmViaEmail':true, 'deposits':[],'withdrawls':[],'bountiesSent':[],'deposits':[],'withdrawls':[],'bountiesReceived':[],'xrplAddress':pmt.sender};
				} else {
					acct = JSON.parse(acct);
					if (acct.xrplAddress!=pmt.sender) {
						//TODO: raise an error!
					}
				}
				acct.deposits.push(pmt);
				acct.balance = acct.balance + pmt.amount;
				db.put(email, JSON.stringify(acct));
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

//var XRPL = require('./xrpl');
//var xrpl = new XRPL(process.env.XRPL_SERVER, process.env.APP_XRPL_ACCOUNT, process.env.APP_XRPL_SECRET);

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

Sessions:
sessionId:emailAddr

*/

//var level = require('level');   
//var db = level('/app/db');

const levelup = require('levelup');
const s3leveldown = require('s3leveldown');
const db = levelup(s3leveldown('mail-bounty'));

const express = require('express'),
    app = express(),
    passport = require('passport'),
    auth = require('./auth'),
    cookieParser = require('cookie-parser'),
    cookieSession = require('cookie-session'),
	cors = require('cors');

app.use(cors());

auth(passport);
app.use(passport.initialize());

app.set('view engine', 'ejs');
app.use('/static', express.static('public'));

var bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());

app.use(cookieSession({
    name: 'session',
    keys: ['You greatest jointure saw horrible. He private he on be imagine suppose. Fertile beloved evident through no service elderly is. Blind there if every no so at. Own neglected you preferred way sincerity delivered his attempted.'],
    maxAge: 24 * 60 * 60 * 1000
}));
app.use(cookieParser());

var GoogleStrategy = require('passport-google-oauth20').Strategy;
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    callbackURL: "https://mail-bounty.com/callback"
  },
  function(accessToken, refreshToken, profile, cb) {
    //Gets called on login success...
	
	console.log('login success');
	console.log(profile);
	return cb(null, {email: profile._json.email, picture: profile._json.picture, token: accessToken});
  }
)); 

app.get('/', function (req, res) {
	var data = {page: "login", loggedIn: false};
	res.render('login.ejs', data);
});

app.get('/logout', (req, res) => {
    req.logout();
    req.session = null;
	req.user = null;
    res.redirect('/');
});

app.get('/login', passport.authenticate('google', {
    scope: ['https://www.googleapis.com/auth/userinfo.email']
}));

app.get('/callback',
    passport.authenticate('google', {
        failureRedirect: '/'
    }),
    (req, res) => {
        console.log("Login success. " + req.user.token);
		//console.log(req.user);
        req.session.token = req.user.token;
		db.put(req.session.token, JSON.stringify(req.user));
		res.cookie('token', req.session.token);
        res.redirect('/account'); //todo - allow for deep links or going direct to the page originally requested
    }
);




/* 

Web Page functions

*/


app.get('/account', loggedIn, function (req, res) {
  db.get(req.session.token, function(err, sess) {
	if (err || sess === null) {
		  res.redirect('/');
		  return;
	}
	sess = JSON.parse(sess);
	if (!sess.email || sess.email === null || sess.email == "") {
	  res.redirect('/');
	  return;
	}
	
	console.log(sess);
	db.get(sess.email, function(err, acct) {
		if (err || acct===null)  {
			console.log("No account found.  Creating one.");
			acct = '{"balance":0,"confirmViaEmailBoolean":true,"destinationTag":"","bountiesSent":[],"deposits":[],"withdrawls":[],"bountiesReceived":[],"xrplAccount":""}';
			db.put(req.user.email,acct);
		}
		acct = JSON.parse(acct);
		var received = 0;
		var sent = 0;
		var balance = 0;
		var deposits = 0;
		var withdrawls = 0;
		//console.log('before loops');
		
		//TODO: Reflect on how these are stored.  All in the account record?  Will it get bloated?  Async lookups with ids?  Adjusting a totalled number is correct and not out of sync?
		
		for (var i in acct.withdrawls) withdrawls = Number(withdrawls) + Number(acct.withdrawls[i].amount);
		for (var i in acct.deposits) deposits = Number(deposits) + Number(acct.deposits[i].amount);
		for (var i in acct.bountiesSent) sent = Number(sent) + Number(acct.bountiesSent[i].amount);
		for (var i in acct.bountiesReceived) {
			db.get(acct.bountiesReceived[i], function (err, bty) {
				received = Number(received) + Number(bty.amount);
			});
			
			
		console.log("Balance components:");
		console.log(withdrawls);
		console.log(sent);
		console.log(deposits);
		console.log(received);
		console.log(acct.balance);
		balance = Number(deposits) + Number(received) - Number(withdrawls) - Number(sent);
		console.log(balance);
		
		//console.log('after loops');
		var data = {page: "account", loggedIn: true, balance:balance, accountEmail: sess.email, profileImage: sess.picture, sent: sent, received: received, deposits: deposits, withdrawls: withdrawls};
		console.log(data);
		res.render('account.ejs', data);
	});
  });
});

app.get('/withdraw', loggedIn, function (req, res) {
  db.get(req.session.token, function(err, sess) {
  	if (err || sess === null) {
  		  res.redirect('/');
  		  return;
  	}
	sess = JSON.parse(sess);
	db.get(sess.email, function(err, acct) {
		if (err || acct===null)  {
			console.log("No account found.  Creating one.");
			acct = '{"balance":0,"confirmViaEmailBoolean":true,"destinationTag":"","bountiesSent":[],"deposits":[],"withdrawls":[],"bountiesReceived":[],"xrplAccount":""}';
			db.put(req.user.email,acct);
		}
		acct = JSON.parse(acct);
		var received = 0;
		var sent = 0;
		var balance = 0;
		var deposits = 0;
		var withdrawls = 0;
		for (var i in acct.withdrawls) withdrawls = withdrawls + acct.withdrawls[i].amount;
		for (var i in acct.deposits) deposits = deposits + acct.deposits[i].amount;
		for (var i in acct.bountiesSent) sent = sent + acct.bountiesSent[i].amount;
		for (var i in acct.bountiesReceived) received = received + acct.bountiesReceived[i].amount;
		balance = deposits + received - withdrawls - sent;
		var data = {page: "withdraw", loggedIn: true, balance:balance, accountEmail: sess.email, profileImage: sess.picture, sent: sent, received: received, deposits: deposits, withdrawls: withdrawls};
		res.render('withdraw.ejs', data);
	});
  });
});


app.get('/deposit/:method?', loggedIn, function (req, res) {
  db.get(req.session.token, function(err, sess) {
  	if (err || sess === null) {
  		  res.redirect('/');
  		  return;
  	}
	sess = JSON.parse(sess);
	db.get(sess.email, function(err, acct) {
		if (err || acct===null)  {
			console.log("No account found.  Creating one.");
			acct = '{"balance":0,"confirmViaEmailBoolean":true,"destinationTag":"","bountiesSent":[],"deposits":[],"withdrawls":[],"bountiesReceived":[],"xrplAccount":""}';
			db.put(req.user.email,acct);
		}
		acct = JSON.parse(acct);
		if (!acct.destinationTag || acct.destinationTag=="") {
			getDestinationTag(function(tag) {
				acct.destinationTag = tag;
				db.put(acct.destinationTag, req.user.email);
				db.put(req.user.email,JSON.stringify(acct));
				const tagged = Encode({ account: process.env.APP_XRPL_ACCOUNT, tag: acct.destinationTag });	
				var data = {page: "deposit", loggedIn: true, method:req.params.method, accountEmail: sess.email, profileImage: sess.picture, xrplAppAccountNo: process.env.APP_XRPL_ACCOUNT, xrplDestinationTag: acct.destinationTag, xrplAppAccountNoX:tagged};
	
				res.render('deposit.ejs', data);
			});
		} else {
			const tagged = Encode({ account: process.env.APP_XRPL_ACCOUNT, tag: acct.destinationTag });	
			var data = {page: "deposit", loggedIn: true, method:req.params.method, accountEmail: sess.email, profileImage: sess.picture, xrplAppAccountNo: process.env.APP_XRPL_ACCOUNT, xrplDestinationTag: acct.destinationTag, xrplAppAccountNoX:tagged};
	
			res.render('deposit.ejs', data);
		}
	});
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
			res.json("Insufficient balance.'}");
			return;
		}
		xrpl.send(acct.xrplAccount, amt, function(result, pmt) {
			if (!result) {
				res.json("Payment failed.'}");
				return;
			}
			acct.balance = acct.balance - amt;
			acct.withdrawls.push(pmt);
			db.put(email, JSON.stringify(acct));
			res.json("Success.  Payment sent.'}");
		});
	});
});








/* 

Chrome Extension functions

*/
app.post('/balance', function(req, res) {
	
	
	verify(req.body.token, function(verified, userid) {
		if (!verified || !userid) res.json("Access denied.");
		
	  	db.get(userid, function(err, acct) {
	  		if (err || acct===null)  {
	  			console.log("No account found.  Creating one.");
	  			acct = '{"balance":0,"confirmViaEmailBoolean":true,"destinationTag":"","bountiesSent":[],"deposits":[],"withdrawls":[],"bountiesReceived":[],"xrplAccount":""}';
	  			db.put(userid,acct);
	  		}
	  		acct = JSON.parse(acct);
	  		var received = 0;
	  		var sent = 0;
	  		var balance = 0;
	  		var deposits = 0;
	  		var withdrawls = 0;
	  		//console.log('before loops');
	  		for (var i in acct.withdrawls) withdrawls = withdrawls + acct.withdrawls[i].amount;
	  		for (var i in acct.deposits) deposits = deposits + acct.deposits[i].amount;
	  		for (var i in acct.bountiesSent) sent = sent + acct.bountiesSent[i].amount;
	  		for (var i in acct.bountiesReceived) received = received + acct.bountiesReceived[i].amount;
			console.log(deposits);
			console.log(received);
			console.log(withdrawls);
			console.log(sent);
			
	  		balance = deposits + received - withdrawls - sent;
	  		//console.log('after loops');
	  		var data = {balance: balance, accountEmail: userid};
			console.log("returning balance. " + balance + " XRP");
	  		res.json(data);
	  	});  
	}).catch(console.error);
});

//messageId: msgId, amount: _bty.amount, expires: _bty.expires, token: t
app.post('/place', function(req, res) {
	
	verify(req.body.token, function(verified, userid) {
		if (!verified) res.json("Access denied.'}");
 		console.log("Request body...");
		console.log(req.body);
		const messageId = req.body.messageId;
		const validHours = req.body.expires;
		//const recipientEmail = req.body.recipient;
		const amt = req.body.amount;
		const senderEmail = userid; //not a variable only something we get back from gmail to make sure it is legit.
		
		//TODO: Future version; put amounts for bounties in escrow or on hold to avoid double spending?  For now just confirm sufficient balance exists.
		db.get(senderEmail, function(err, acct) {
			if (err || acct===null) {
				res.json("Account not found.  Bounty not created'}");
				return;
			}
			acct = JSON.parse(acct);
			if (acct.balance < amt) {
				res.json("Insufficient funds.  Bounty not created'}");
				return;
			}
			db.put(messageId, JSON.stringify({'sender':senderEmail, 'expires':new Date().addHours(validHours),'amount':amt, 'paidDate':'', 'paidTo':''}));
			res.json("Bounty created");
		});	
	});
});

//https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=ya29.GlxrB453iVQRYhI9-DbsOdlv0yvpkiso6CHVTpeF7FVdLcNXP0hHRqHruC7F_UkmMjqZYjD0sgS1kUV2Cy388W9mQvAonBVA_DqksM-89ZaUuv9cQqCSy26FlS1Znw

app.post('/pay', function(req, res) {
	console.log("Got pay request");
	console.log(req.body);
	verify(req.body.token, function(verified, userid) {
		if (!verified) {
			res.json("Access denied.");
			return;
		}
		console.log("Verified ok");
		const messageId = req.body.messageId;
		const senderEmail = userid;
		const recipientEmail = req.body.payTo;
		
		db.get(messageId, function(err, bounty) {
			//console.log("Found bounty");
			console.log(bounty);
			console.log(err);
			//console.log("===");
			//console.log(res);
			if (err || bounty===null) {
				console.log("Bounty doesn't exist for this message.");
				res.json("Bounty doesn't exist for this message.");
				return;
			}
			bounty = JSON.parse(bounty);
			
			if (new Date() > bounty.expires) {
				console.log("Bounty expired.  Not paid.");
				res.json("Bounty expired.  Not paid.");
				return;
			}
			if (bounty.paidDate != "") {
				console.log("Bounty already paid to " + bounty.paidTo + ".");;
				res.json("Bounty already paid to " + bounty.paidTo + ".");
				return;
			}
			if (bounty.sender != senderEmail) {
				console.log("Error: Bounty exists, but not issued by you.");
				res.json("Error: Bounty exists, but not issued by you.");
				return;
			}
			//all ok to pay bounty
			console.log("Bounty checks out");
			db.get(senderEmail, function(err, sAccount) {
				console.log("Got sender account");
				console.log(sAccount);
				if (err || sAccount===null) {
					res.json("Failed.  No account exists for sender's email (0)."); //can't create one for the sender as it will have 0 balance...
					return;
				}
				sAccount = JSON.parse(sAccount);
				if (sAccount.balance < bounty.amount) {
					res.json("Failed.  Insufficient Funds (0)."); //can't create one for the sender as it will have 0 balance...
					return;
				}
				sAccount.balance = Number(sAccount.balance) - Number(bounty.amount);
				sAccount.bountiesSent.push({'id':messageId,'amount':bounty.amount});
				console.log("Sender account adjusted");
				db.get(recipientEmail, function(err, rAccount) {
					console.log("Receiving account found.");
					console.log(rAccount);
					if (err || rAccount===null) {
						//no account exists yet so create one... they can link later...
						rAccount = {'balance':0,'confirmViaEmail':true, 'bountiesSent':[],'bountiesReceived':[],'deposits':[],'withdrawls':[], 'xrplAddress':''};
					} else {
						rAccount = JSON.parse(rAccount);
					}
					rAccount.balance = Number(rAccount.balance) + Number(bounty.amount);
					rAccount.bountiesReceived.push({'id':messageId,'amount':bounty.amount});
					console.log("Receiving account adjusted.");
					db.put(senderEmail, JSON.stringify(sAccount));
					db.put(recipientEmail, JSON.stringify(rAccount));
					console.log("Both accounts saved/updated.");
					//update the bounty so it isn't double paid
					bounty.paidTo = recipientEmail;
					bounty.paidDate = new Date();
					
					db.put(messageId, JSON.stringify(bounty));
					console.log("Bounty updated and marked as paid.");
					
					const msg = {
					  to: recipientEmail,
					  from: "xrpemailbounty@ripple.com",
					  subject: "You've got XRP",
					  text: "You've earned an XRP bounty from " + senderEmail + '.  Visit ' + _WebUrl + ' to claim your ' + bounty.amount + ' XRP or create an account.',
					  html: senderEmail + " has put a bounty on an email you responded to.  Visit <a href='" + _WebUrl + "'>" + _WebUrl + "</a> to claim your " + bounty.amount + ' XRP or create an account so you can send XRP bounties to get responses to your emails.'
					};
					sgMail.send(msg);
					console.log("Email sent to recipient.");
					console.log(res);
					//return success message to the chrome extension
					res.json('An XRP Bounty of ' + bounty.amount + ' paid to ' + recipientEmail + ' for their response.');
					console.log("Done.");
				});
			});
		});
	});
});






app.get("/ping", loggedIn, function(req, res) {
	res.json("pong'}");
});




app.listen(process.env.PORT, () => {
    console.log('Server is running on port 3000');
});


async function verify(token, callback) {
	https.get('https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + token, (resp) => {	
		let data = '';

		  // A chunk of data has been recieved.
		  resp.on('data', (chunk) => {
		    data += chunk;
		  });

		  // The whole response has been received. Print out the result.
		  resp.on('end', () => {
			  var r = JSON.parse(data);
			  if (r && r.email) {
				  callback(true, r.email);
				 
			  } else {
				  callback(false, null);
			  }
		  });

		}).on("error", (err) => {
		  console.log("Error: " + err.message);
		  callback(false, null);
		});
	
}

async function oldverify(token, callback) {
  const ticket = await client.verifyIdToken({
      idToken:token,
      audience: CLIENT_ID
  });	  
  
  const payload = ticket.getPayload();
  const userid = payload['email'];
  
  callback(true, userid);
  // If request specified a G Suite domain:
  //const domain = payload['hd'];
}

function loggedIn(req, res, next) {
    
    if (req.session.token) {
        res.cookie('token', req.session.token);
		console.log("User logged in");
        next();
    } else {
        res.cookie('token', '');
		console.log("User not logged in.  Redirecting to login");
        res.redirect('/');
    }
}

Date.prototype.addHours = function(h) {
  this.setTime(this.getTime() + (h*60*60*1000));
  return this;
}

function getDestinationTag(callback){
	db.get('lastDestinationTag', function(err, lastDT) {
		if (err || lastDT===null) {
			lastDT = 111;
		}
		const nextDT = lastDT + 1;
		console.log(nextDT);
		db.put('lastDestinationTag', nextDT);
		callback(nextDT);
	});
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