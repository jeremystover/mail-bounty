InboxSDK.load('1', 'sdk_XRPBounty_1633776426').then(function(sdk){
	//load up settings including account balance<?>, XRP address, status of that address or a verify button, default amount, default expiration
	//give them a withdrawl button to pull their XRP out (unless we're doing all transactions on ledger then bounties sit and can be claimed )
	sdk.Toolbars.addToolbarButtonForApp({
		title:'XRP Bounty',
		iconUrl:'https://d1ic4altzx8ueg.cloudfront.net/finder-au/wp-uploads/2018/07/xrp-logo-black-250x250.png',
  	  	hasDropdown: true,
        onClick(menu) {
          menu.dropdown.el.innerHTML = `
            <input class="button1" type="button" value="button1">
            <p>
            <input class="button2" type="button" value="button2">
          `;
          const button1 = menu.dropdown.el.querySelector('.button1');
          button1.addEventListener('click', function(e) {
			  console.log('btn click');
          });
        }
	});
	
	// the SDK has been loaded, now do something with it!
	sdk.Compose.registerComposeViewHandler(function(composeView){
		var amount = 3;
		// 
		composeView.addButton({
			title: "Add XRP Bounty",
			iconUrl: 'https://d1ic4altzx8ueg.cloudfront.net/finder-au/wp-uploads/2018/07/xrp-logo-black-250x250.png',
			onClick: function(event) {
				//use dropdown to confirm amount and expiration
				//verify they have enough in their account??
				
				var xhr = new XMLHttpRequest();
				xhr.open("GET", "https://mail-bounty.com/ping", true);
				xhr.onreadystatechange = function() {
				  if (xhr.readyState == 4) {
				    // WARNING! Might be evaluating an evil script!
				    console.log("(" + xhr.responseText + ")");
				  }
				}
				xhr.send();
				
				event.composeView.insertTextIntoBodyAtCursor('[[An XRP bounty of ' + amount + ' XRP has been added to this email.  Claim this bounty by responding within 24 hours.  '  + sha256(sdk.User.getEmailAddress() + amount) + ']]');
			},
		});
		
		composeView.on('sent', function(event){
			var threadId = event.composeView.getThreadID();
			var msgId = event.getMessageID();
			console.log(event);
			//for each recipient, 
				//send to database -> message id, hash of sender, threadId, recipient, bounty amount, and secret key + bounty expiration + amount
		});
	});
	sdk.Conversations.registerMessageViewHandler(function(messageView) {
		//threadView.getMessageViewsAll().forEach(function(msg) { //this reviews all message ids when thread is loaded.  consider just when actual message is opened?
		messageView.getMessageIDAsync().then(function(id) { 
			console.log(id); 
			//run check to see if bounty exists for this message id (on server, lookup hash, verify expiration, execute bounty, mark paid, send 'you've got bounty email', return success)
			//handle bounty paid event by notifying user
		});	
		//});
	});
});


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