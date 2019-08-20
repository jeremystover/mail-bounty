/*

Next steps:

1) About web page content
2) Process withdrawl form submission
2) Test web functionality (add funds, withdraw in particular )
3) Extension - hook up to API functions (place, pay), icon and bounty amount in mail list, text in body of email (need verification code)
4) Test message to emails so people know it is not real amounts
5) Better logging of requests, IPs, hacking detection

*/


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
		console.log('before loops');
		for (var i in acct.withdrawls) withdrawls = withdrawls + acct.withdrawls[i].amount;
		for (var i in acct.deposits) deposits = deposits + acct.deposits[i].amount;
		for (var i in acct.bountiesSent) sent = sent + acct.bountiesSent[i].amount;
		for (var i in acct.bountiesReceived) received = received + acct.bountiesReceived[i].amount;
		balance = deposits + received - withdrawls - sent;
		console.log('after loops');
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
			res.send("Insufficient balance.");
			return;
		}
		xrpl.send(acct.xrplAccount, amt, function(result, pmt) {
			if (!result) {
				res.send("Payment failed.");
				return;
			}
			acct.balance = acct.balance - amt;
			acct.withdrawls.push(pmt);
			db.put(email, JSON.stringify(acct));
			res.send("Success.  Payment sent.");
		});
	});
});








/* 

Chrome Extension functions

*/
app.post('/balance', function(req, res) {
	console.log(req.body);
	const CLIENT_ID = '450274019939-ecc4cpim20h7se1a55l7539414nkvurl.apps.googleusercontent.com';
	const {OAuth2Client} = require('google-auth-library');
	const client = new OAuth2Client(CLIENT_ID);
	async function verify(token) {
	  const ticket = await client.verifyIdToken({
	      idToken: 'eyJhbGciOiJSUzI1NiIsImtpZCI6ImRmOGQ5ZWU0MDNiY2M3MTg1YWQ1MTA0MTE5NGJkMzQzMzc0MmQ5YWEiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJhY2NvdW50cy5nb29nbGUuY29tIiwiYXpwIjoiNDUwMjc0MDE5OTM5LWVjYzRjcGltMjBoN3NlMWE1NWw3NTM5NDE0bmt2dXJsLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tIiwiYXVkIjoiNDUwMjc0MDE5OTM5LWVjYzRjcGltMjBoN3NlMWE1NWw3NTM5NDE0bmt2dXJsLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tIiwic3ViIjoiMTA5OTI4MjYzNzY0NTQ2OTUyNjMxIiwiaGQiOiJyaXBwbGUuY29tIiwiZW1haWwiOiJqc3RvdmVyQHJpcHBsZS5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwiaWF0IjoxNTY2MzE4ODI1LCJleHAiOjE1NjYzMjI0MjUsImp0aSI6ImM5YWM3M2Y4OWEwNGFmNDE0YzNhODBmZTg5NGNhNjIxZjU0NTkzY2EifQ.VSzGSFd7LCNnH8RpU4CVHZ2aLZNeIZ-r5xx4X7tIolI2ARttKyA7CLthMigB9ZYl13I2iDn7y3lruNFbUaKG6Lcu3oswo5pSp2K5K79dkCQqcaF3Q-VI7SZ-bP8x-rWUUO68fYH63_O006XgpbRWIatD0UW8h6dXrlIdekf8UAIAe_mX2xDiPBKJiUOo3oLpkjBJv-oCEhNYAA3TJGuWalN_yg-JYqj2usPAeOANtyrPKfgLyk3MdZOjK6YgWagU9SDDxygfUY8Z13zI-HteSt3lQOndhgsxZBOdgKNhDMwnfDMxw2MrjyxbJ94ctzTD2rF4iXVF5IKkJbbbAB9-sw',
	      audience: CLIENT_ID,  // Specify the CLIENT_ID of the app that accesses the backend
	      // Or, if multiple clients access the backend:
	      //[CLIENT_ID_1, CLIENT_ID_2, CLIENT_ID_3]
	  });
	  
	  console.log("Got ticket ");
	  console.log(ticket.getPayload());
	  
	  
	  
	  const payload = ticket2.getPayload();
	  const userid = payload['sub'];
	  
	  res.json({'balance':100, 'userId':userid});
	  
	  // If request specified a G Suite domain:
	  //const domain = payload['hd'];
	}
	console.log(req);
	console.log(req.token);
	
	verify(req.token).catch(console.error);
	
	
	//res.json({'balance':100});
});

app.post('/place', loggedIn, function(req, res) {
	const messageId = req.body.messageId;
	const validHours = req.body.validHours;
	const recipientEmail = req.body.recipient;
	const amt = req.body.amount;
	const senderEmail = req.user.email; //not a variable only something we get back from gmail to make sure it is legit.
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
		db.put(messageId, JSON.stringify({'sender':senderEmail, 'recipient':recipientEmail, 'expires':new Date().addHours(validHours),'amount':amount, 'paidDate':''}));
		res.send("Bounty created");
	});	
});


app.post('/pay', loggedIn, function(req, res) {
	const messageId = req.body.messageId;
	//TODO: valid hours - should look up in record not in post var
	const validHours = req.body.validHours;
	const recipientEmail = req.body.recipient;
	const senderEmail = req.user.email;
	
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
			sAccount.bountiesSent.push(messageId);
			db.get(recipientEmail, function(err, rAccount) {
				if (err || rAccount===null) {
					//no account exists yet so create one... they can link later...
					rAccount = {'balance':0,'confirmViaEmail':true, 'bountiesSent':[],'bountiesReceived':[],'deposits':[],'withdrawls':[], 'xrplAddress':pmt.sender};
				} else {
					rAccount = JSON.parse(rAccount);
				}
				rAccount.balance = rAccount.balance + bounty.amount;
				rAccount.bountiesReceived.push(messageId);
				db.put(senderEmail, JSON.stringify(sAccount));
				db.put(recipientEmail, JSON.stringify(rAccount));
					
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











app.get("/ping", loggedIn, function(req, res) {
	res.send("pong");
});




app.listen(process.env.PORT, () => {
    console.log('Server is running on port 3000');
});

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