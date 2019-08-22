var access_token = "";
var initialized = false;

var authTokens = {};

chrome.extension.onMessage.addListener(function(request, sender, sendResponse) {
  if (!initialized) {
	  console.log("initializing");
	  init(request.email, sendResponse);
	  
  } else {
     // chrome.storage.local.get(['key'], function(result) {
     //   console.log('Value currently is ' + result.key);
      //});
	  console.log("Getting token for " + emailToKey(request.email));
	  
	  sendResponse({token: authTokens[emailToKey(request.email)].token});
	  return;
	  chrome.storage.local.get(emailToKey(request.email), function (val) {
		  console.log(val);
		  console.log("Returning token:" + val.token);
	  		sendResponse( {token: val.token});
	  });
	}
});

console.log("Running background script.");

var timer;

function init(em, sendResponse) {
	clearTimeout(timer);
	
	//clear storage
	chrome.storage.sync.get(null, function(items) {
	    var allKeys = Object.keys(items);
		for(var k in allKeys) {
			//chrome.storage.local.remove(allKeys[k]);
		}
		chrome.identity.getAccounts(function(accounts) {
			
			for (var a in accounts) {
			
				chrome.identity.getAuthToken({ 'account':{'id':accounts[a].id},'interactive': false }, function(token) {
				  // Use the token.
				
				
					var xhr = new XMLHttpRequest();
					xhr.open("GET", chrome.extension.getURL('https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + token), true);
					xhr.send();
				
					xhr.onreadystatechange = function() {
					  if (xhr.readyState == 4) {
					    // JSON.parse does not evaluate the attacker's scripts.
					    var resp = JSON.parse(xhr.responseText);
						console.log(resp);
						console.log(resp.email);
						console.log(em);
						if (resp.email) {
							var key = emailToKey(resp.email);
							if (em==resp.email) {
								if (sendResponse) sendResponse( {token: token});
							}
							authTokens[key] = {'token': token, 'id': resp.user_id, 'email': resp.email}
							chrome.storage.local.set({ key : authTokens[key]}, function() {
							     console.log('Auth Token Stored for ' + key + " (" + token + ")");
							 });
						 }
					 }
					}		
				});
			}
		});
	});
	
	initialized = true;
	timer = setTimeout(init, 3000000, sendResponse);
}
init(null, null);

function emailToKey(e) { if (!e) return null; return e.replace("@","").replace(".",""); }

function hold() {
	// Using chrome.tabs
	var manifest = chrome.runtime.getManifest();

	var clientId = encodeURIComponent(manifest.oauth2.client_id);
	var scopes = encodeURIComponent(manifest.oauth2.scopes.join(' '));
	var redirectUri = encodeURIComponent('urn:ietf:wg:oauth:2.0:oob:auto');

	var url = 'https://accounts.google.com/o/oauth2/auth' + 
	          '?client_id=' + clientId + 
	          '&response_type=id_token' + 
	          '&access_type=offline' + 
	          '&redirect_uri=' + redirectUri + 
	          '&scope=' + scopes;

	var RESULT_PREFIX = ['Success', 'Denied', 'Error'];
	chrome.tabs.create({'url': 'about:blank'}, function(authenticationTab) {
	    chrome.tabs.onUpdated.addListener(function googleAuthorizationHook(tabId, changeInfo, tab) {
	        if (tabId === authenticationTab.id) {
	            var titleParts = tab.title.split(' ', 2);

	            var result = titleParts[0];
	            if (titleParts.length == 2 && RESULT_PREFIX.indexOf(result) >= 0) {
	                chrome.tabs.onUpdated.removeListener(googleAuthorizationHook);
	                chrome.tabs.remove(tabId);

	                var response = titleParts[1];
	                switch (result) {
	                    case 'Success':
	                        // Example: id_token=<YOUR_BELOVED_ID_TOKEN>&authuser=0&hd=<SOME.DOMAIN.PL>&session_state=<SESSION_SATE>&prompt=<PROMPT>
	                        var resultVars = response.split("&");
							access_token = resultVars[0].split("=")[1];
	                    break;
	                    case 'Denied':
	                        // Example: error_subtype=access_denied&error=immediate_failed
	                        console.log("Denied.");
							console.log(response);
							
	                        var resultVars = response.split("&");
							access_token = resultVars[0].split("=")[1];
	                    break;
	                    case 'Error':
	                        // Example: 400 (OAuth2 Error)!!1
							console.log("Error");
	                        console.log(response);
							
	                        var resultVars = response.split("&");
							access_token = resultVars[0].split("=")[1];
							
	                    break;
	                }
	            }
	        }
	    });

	    chrome.tabs.update(authenticationTab.id, {'url': url});
	});
}