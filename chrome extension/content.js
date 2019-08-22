var xrpBountyString = '[[A bounty of {{amount}} XRP has been added to this email by <a href="mailto:{{sender}}" target="_blank">{{sender}}</a> to be paid out to the first to respond within {{deadline}} hours.]]';
var xrpBountyRegEx = new RegExp(xrpBountyString.replace(/\[/g,'\\[').replace(/\]/g,'\\]').replace('\{\{amount\}\}','([0-9 -()+]+)').replace('\{\{sender\}\}','([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)').replace('\{\{sender\}\}','([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)').replace('\{\{deadline\}\}','([0-9 -()+]+)'));

var id_token = "";
var user_balance = "";
var maxBounty = 20;


Promise.all([
	InboxSDK.load('1', 'sdk_XRPBounty_1633776426'),
	InboxSDK.loadScript('https://code.jquery.com/jquery-3.4.1.min.js')
])
.then(function(results){
  var sdk = results[0];
  
  if (typeof jQuery != 'undefined') {  
      // jQuery is loaded => print the version
      console.log("jQuery version: " + jQuery.fn.jquery);
  } else {
	  console.log("jQuery not loaded.");
  }
  

  // the rest of your app code here
	//load up settings including account balance<?>, XRP address, status of that address or a verify button, default amount, default expiration
	//give them a withdrawl button to pull their XRP out (unless we're doing all transactions on ledger then bounties sit and can be claimed )
  
  
  
   //configure toolbar 
	sdk.Toolbars.addToolbarButtonForApp({
		title:'XRP Bounty',
		iconUrl:'https://d1ic4altzx8ueg.cloudfront.net/finder-au/wp-uploads/2018/07/xrp-logo-black-250x250.png',
  		hasDropdown: true,
    	onClick(menu) {
		  //_menu = menu;
			
		  menu.dropdown.el.innerHTML = `
		    Loading your account...
		  `;
		  
		  //this authorizes with token and gets balance...
		  checkUserBalance(sdk.User.getEmailAddress(), function(b) {
		   	buildSettingsModal(menu, b);
		  });
		  
    	}
 	});
	// the SDK has been loaded, now do something with it!
	sdk.Compose.registerComposeViewHandler(function(composeView){
		var amount = 3;
		console.log("Registering Compose View");
		
		var addBtyModal = document.createElement('div');
		addBtyModal.innerHTML = "When you add a bounty to this message, you commit to pay it if the user responds before the expiration.<br><br><table ><tr><td>Enter the amount:</td><td><input type='text' id='xrp_bounty_amount' value='" + amount + "'></td></tr><tr><td>Bounty Expires:</td><td><select id='xrp_bounty_expires'><option value=1>In 1 hour</option><option value=24>In 24 hours</option><option value=72>In three days</option><option value=168>In one week</option><option value=8760>In one year</option></select></td></tr></table>";
		
		
		var _bty = {amount:0, expires: 0}; 
		composeView.on('presending', function(event){
			var bdy = composeView.getHTMLContent();
			var btyExists = xrpBountyRegEx.exec(bdy);
			xrpBountyRegEx.compile(xrpBountyRegEx);
		
			if (btyExists!==null) {
				_bty.amount = btyExists[1];
				_bty.expires = btyExists[4];
			} 
		});
	
		composeView.on('sent', function(event){
			event.getThreadID().then(function(msgId) { //using threadid because we can't get the id of the message on response - we only can get the message id of the response and the don't match.  thread id is less precise but prevents that.
		
			    checkAuthToken(sdk.User.getEmailAddress(), function(t) {
					console.log("Placing bounty:");
					console.log({ messageId: msgId, amount: _bty.amount, expires: _bty.expires, token: t});
			  	   $.post( "https://mail-bounty.com/place", { messageId: msgId, amount: _bty.amount, expires: _bty.expires, token: t}, function( data ) {
			  		  _bty = {amount:0, expires: 0};
			  
					  //console.log("Bounty Placed");
					  console.log(data);
					  //todo: check for errors...
				  });
			  });
		  });
		});
		
		
		composeView.addButton({
			title: "Add XRP Bounty",
			iconUrl: 'https://d1ic4altzx8ueg.cloudfront.net/finder-au/wp-uploads/2018/07/xrp-logo-black-250x250.png',
			onClick: function(event) {
				//use dropdown to confirm amount and expiration
				//verify they have enough in their account??
				xrpBountyRegEx.compile(xrpBountyRegEx);
				var btyExists = xrpBountyRegEx.exec(event.composeView.getHTMLContent());
				console.log(btyExists);
				console.log(event.composeView.getHTMLContent());
				xrpBountyRegEx.compile(xrpBountyRegEx); //this resets the RegEx;
	
				if (btyExists!==null) { 
					console.log("Bounty already exists.");
					const modalView = sdk.Widgets.showModalView({
					    chrome: true,
					    constrainTitleWidth: false,
					    el: document.createElement('div'),
					    showCloseButton: true,
					    title: 'Bounty already exists'
					  });
				  
					return;
				}
				
				const modalView = sdk.Widgets.showModalView({
				    buttons: [{
				      color: 'red',
				      onClick: () => {
						  checkUserBalance(sdk.User.getEmailAddress(), function(b) {
							  
							  var amt = $( "#xrp_bounty_amount" ).val();
						  	  var exp = $( "#xrp_bounty_expires" ).val();
					  
					  
	  					  	  var bty = xrpBountyString.replace('\{\{amount\}\}', Math.min(maxBounty,amt)).replace('\{\{sender\}\}',  sdk.User.getEmailAddress()).replace('\{\{sender\}\}',  sdk.User.getEmailAddress()).replace('\{\{deadline\}\}', exp);
	  						//this inserts into the html but doesn't place until message is sent.
	  							event.composeView.insertHTMLIntoBodyAtCursor(bty);
								modalView.close();
							});
	  					},
				      orderHint: 1,
				      text: 'Add Bounty',
				      title: 'Add Bounty',
				      type: 'PRIMARY_ACTION'
				    }],
				    chrome: true,
				    constrainTitleWidth: true,
				    el: addBtyModal,
				    showCloseButton: true,
				    title: 'Add XRP Bounty'
				});
			}
		
		});
	});
	
	//sdk.Conversations.registerThreadViewHandler(function(messageView) {
	sdk.Conversations.registerThreadViewHandler(function(threadView) { 
		console.log("In tvh");

		var messageViewArray = threadView.getMessageViews();
		for (var m in messageViewArray) {
			
			const emailBody = messageViewArray[m].getBodyElement().innerHTML;
			xrpBountyRegEx.compile(xrpBountyRegEx);
			var bountyInfo = xrpBountyRegEx.exec(emailBody);
				
			if (bountyInfo === null) continue; //no bounty exists for this message
		
			//var hash = bountyInfo[1];
			var amt = bountyInfo[1];
			var sender = bountyInfo[2];
			var deadline = bountyInfo[4];
		
			//TODO: pay code and response on backend
			//TODO: edit regex with updated format  
			//TODO: handle fails
			threadView.getThreadIDAsync().then(function(id) { 
			
				checkAuthToken(sdk.User.getEmailAddress(), function(t) {
					//run check to see if bounty exists for this message id (on server, lookup hash, verify expiration, execute bounty, mark paid, send 'you've got bounty email', return success)
					console.log("Posting to pay.");
					console.log({ messageId: id, payTo: messageViewArray[m].getSender().emailAddress, token: t});
					$.post( "https://mail-bounty.com/pay", { messageId: id, payTo: messageViewArray[m].getSender().emailAddress, token: t}, function( data ) {
					
						console.log("got response");
						console.log(data);
					
						var successMessageHtml = document.createElement('div');
						successMessageHtml.innerHTML = data;
					//todo - use a different notification here instead of a modal
						const modalView = sdk.Widgets.showModalView({
						    chrome: true,
						    constrainTitleWidth: true,
						    el: successMessageHtml,
						    showCloseButton: true,
						    title: 'XRP Bounty'
						  });
					
					}, "json");
				});
			
			//handle bounty paid event by notifying user
			});
		}	
		//});
	});
});


//this will loop until an id token is available
function checkAuthToken(email, callback) {
	if (id_token!="") callback(id_token);
	
    chrome.extension.sendMessage({email: email}, function(response) {
		console.log(response);
	  if (!response || !response.token) {
		setTimeout(checkAuthToken, 1500, email, callback);
		return;
	  }
	  id_token = response.token;
	  callback(id_token);
    });
}


function checkUserBalance(email, callback) {
	if (user_balance!="") callback(user_balance);
	checkAuthToken(email, function(t) {
		console.log("Posting to check balance.");
		$.post("https://mail-bounty.com/balance", {token: t}, function(response) {
			user_balance = response.balance;
			callback(user_balance);
	    });
	});
}

function buildSettingsModal(menu, balance) {
  menu.dropdown.el.innerHTML = `<style>/*! CSS Used from: Embedded */
::-webkit-input-placeholder{color:#999;}
/*! CSS Used from: https://mail-bounty.com/static/bootstrap.min.css */
a{background-color:transparent;}
a:active,a:hover{outline:0;}
b{font-weight:bold;}
img{border:0;}
@media print{
*,*:before,*:after{background:transparent!important;color:#000!important;-webkit-box-shadow:none!important;box-shadow:none!important;text-shadow:none!important;}
a,a:visited{text-decoration:underline;}
a[href]:after{content:" (" attr(href) ")";}
img{page-break-inside:avoid;}
img{max-width:100%!important;}
p,h3{orphans:3;widows:3;}
h3{page-break-after:avoid;}
}
*{-webkit-box-sizing:border-box;-moz-box-sizing:border-box;box-sizing:border-box;}
*:before,*:after{-webkit-box-sizing:border-box;-moz-box-sizing:border-box;box-sizing:border-box;}
a{color:#2196f3;text-decoration:none;}
a:hover,a:focus{color:#0a6ebd;text-decoration:underline;}
a:focus{outline:5px auto -webkit-focus-ring-color;outline-offset:-2px;}
img{vertical-align:middle;}
h3,h5{font-family:inherit;font-weight:400;line-height:1.1;color:#444444;}
h3{margin-top:23px;margin-bottom:11.5px;}
h5{margin-top:11.5px;margin-bottom:11.5px;}
h3{font-size:34px;}
h5{font-size:20px;}
p{margin:0 0 11.5px;}
.panel{margin-bottom:23px;background-color:#ffffff;border:1px solid transparent;border-radius:3px;-webkit-box-shadow:0 1px 1px rgba(0,0,0,0.05);box-shadow:0 1px 1px rgba(0,0,0,0.05);}
.panel-body{padding:15px;}
.panel-footer{padding:10px 15px;background-color:#f5f5f5;border-top:1px solid #dddddd;border-bottom-right-radius:2px;border-bottom-left-radius:2px;}
.panel-default{border-color:#dddddd;}
.panel-body:before,.panel-body:after{content:" ";display:table;}
.panel-body:after{clear:both;}
@media (min-width:768px) and (max-width:991px){
.hidden-sm{display:none!important;}
}
@media (min-width:992px) and (max-width:1199px){
.hidden-md{display:none!important;}
}
p{margin:0 0 1em;}
a{-webkit-transition:all 0.2s;-o-transition:all 0.2s;transition:all 0.2s;}
.panel{border:none;border-radius:2px;-webkit-box-shadow:0 1px 4px rgba(0,0,0,0.3);box-shadow:0 1px 4px rgba(0,0,0,0.3);}
.panel-footer{border-top:none;}</style><div class="panel panel-default">
<div class="panel-body">
<h5><i class="xrp hidden-sm"></i>XRP Bounty Account Balance</h5>
<h3 class="hidden-sm hidden-md"><b>` + balance + ` XRP</b></h3>
  <p> &nbsp;</p>
  <p><b>Add a Bounty:</b><BR>
  While composing, click the <img src='https://d1ic4altzx8ueg.cloudfront.net/finder-au/wp-uploads/2018/07/xrp-logo-black-250x250.png' style="width: 15px; display: inline; vertical-align: middle;" /> next to the "SEND" button.
  <p><b>Claim a Bounty:</b><BR>
  Respond to an email sent with a bounty before it expires to claim the bounty. The bounty will be added to your account when the sender reads your response.
</div>
<div class="panel-footer">
<b><a href="https://mail-bounty.com/deposit" id="xrp_bounty_deposit_button">Deposit</a> | <a href="https://mail-bounty.com/withdraw" id="xrp_bounty_withdraw_button">Withdraw</a> <i class="fa fa-paper-plane"></i></b>
</div>
  </div>`;
  /*
  document.getElementById("xrp_bounty_withdraw_button").addEventListener('click', function(e) {
  console.log('withdraw btn click');
  //window.open('https://mail-bounty.com/withdraw', '_blank');
  });
  document.getElementById("xrp_bounty_deposit_button").addEventListener('click', function(e) {
  console.log('deposit btn click');
  //window.open('https://mail-bounty.com/deposit', '_blank');
  });
  */
}

//on send, get message id and record the bounty to a database
//on view message, check for a bounty issued by me; confirm reply send date; validate with server to see if bounty needs to be paid;  If so, send an email to the recipient with instructions on how to claim it
//need a way to claim and export xrp
//need a way to add xrp
//settings to control amount and response time.  Amount settable by editing the string?  Should we encode that somewhere to verify?  Do we need a secret key to ensure the hash is not fakable.  


var sha256 = function sha256(ascii) {
	function rightRotate(value, amount) {
		return (value>>>amount) | (value<<(32 - amount));
	};
	
	var mathPow = Math.pow;
	var maxWord = mathPow(2, 32);
	var lengthProperty = 'length'
	var i, j; // Used as a counter across the whole file
	var result = ''

	var words = [];
	var asciiBitLength = ascii[lengthProperty]*8;
	
	//* caching results is optional - remove/add slash from front of this line to toggle
	// Initial hash value: first 32 bits of the fractional parts of the square roots of the first 8 primes
	// (we actually calculate the first 64, but extra values are just ignored)
	var hash = sha256.h = sha256.h || [];
	// Round constants: first 32 bits of the fractional parts of the cube roots of the first 64 primes
	var k = sha256.k = sha256.k || [];
	var primeCounter = k[lengthProperty];
	/*/
	var hash = [], k = [];
	var primeCounter = 0;
	//*/

	var isComposite = {};
	for (var candidate = 2; primeCounter < 64; candidate++) {
		if (!isComposite[candidate]) {
			for (i = 0; i < 313; i += candidate) {
				isComposite[i] = candidate;
			}
			hash[primeCounter] = (mathPow(candidate, .5)*maxWord)|0;
			k[primeCounter++] = (mathPow(candidate, 1/3)*maxWord)|0;
		}
	}
	
	ascii += '\x80' // Append Ƈ' bit (plus zero padding)
	while (ascii[lengthProperty]%64 - 56) ascii += '\x00' // More zero padding
	for (i = 0; i < ascii[lengthProperty]; i++) {
		j = ascii.charCodeAt(i);
		if (j>>8) return; // ASCII check: only accept characters in range 0-255
		words[i>>2] |= j << ((3 - i)%4)*8;
	}
	words[words[lengthProperty]] = ((asciiBitLength/maxWord)|0);
	words[words[lengthProperty]] = (asciiBitLength)
	
	// process each chunk
	for (j = 0; j < words[lengthProperty];) {
		var w = words.slice(j, j += 16); // The message is expanded into 64 words as part of the iteration
		var oldHash = hash;
		// This is now the undefinedworking hash", often labelled as variables a...g
		// (we have to truncate as well, otherwise extra entries at the end accumulate
		hash = hash.slice(0, 8);
		
		for (i = 0; i < 64; i++) {
			var i2 = i + j;
			// Expand the message into 64 words
			// Used below if 
			var w15 = w[i - 15], w2 = w[i - 2];

			// Iterate
			var a = hash[0], e = hash[4];
			var temp1 = hash[7]
				+ (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) // S1
				+ ((e&hash[5])^((~e)&hash[6])) // ch
				+ k[i]
				// Expand the message schedule if needed
				+ (w[i] = (i < 16) ? w[i] : (
						w[i - 16]
						+ (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15>>>3)) // s0
						+ w[i - 7]
						+ (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2>>>10)) // s1
					)|0
				);
			// This is only used once, so *could* be moved below, but it only saves 4 bytes and makes things unreadble
			var temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) // S0
				+ ((a&hash[1])^(a&hash[2])^(hash[1]&hash[2])); // maj
			
			hash = [(temp1 + temp2)|0].concat(hash); // We don't bother trimming off the extra ones, they're harmless as long as we're truncating when we do the slice()
			hash[4] = (hash[4] + temp1)|0;
		}
		
		for (i = 0; i < 8; i++) {
			hash[i] = (hash[i] + oldHash[i])|0;
		}
	}
	
	for (i = 0; i < 8; i++) {
		for (j = 3; j + 1; j--) {
			var b = (hash[i]>>(j*8))&255;
			result += ((b < 16) ? 0 : '') + b.toString(16);
		}
	}
	return result;
};