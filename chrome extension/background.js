var access_token = "";
var initialized = false;


chrome.extension.onMessage.addListener(function(request, sender, sendResponse) {
  if (!initialized) {
	  initialized = true;
	  init();
	  console.log("initializing");
	  sendResponse({initializing:true});
  } else {
	  console.log("Returning token:" + access_token);
  		sendResponse( {token: access_token});
	}
});

console.log("Running background script.");

function init() {
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