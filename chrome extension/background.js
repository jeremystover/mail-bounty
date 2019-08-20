function getToken() {
      chrome.identity.getAuthToken({ interactive: true }, function(token) {
        if (chrome.runtime.lastError) {
			console.log("identity error");
          console.log(chrome.runtime.lastError);
          return;
        }
        console.log("Token received");
		console.log(token);
        access_token = token;
      });
	  
	  
    }


chrome.extension.onMessage.addListener(function(request, sender, sendResponse) {
  console.log("Returning token:");
  sendResponse( {token: access_token});
});
console.log("Running background script.");
var access_token = "";
getToken();






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
                        console.log(response);
                    break;
                    case 'Denied':
                        // Example: error_subtype=access_denied&error=immediate_failed
                        console.log(response);
                    break;
                    case 'Error':
                        // Example: 400 (OAuth2 Error)!!1
                        console.log(response);
                    break;
                }
            }
        }
    });

    chrome.tabs.update(authenticationTab.id, {'url': url});
});