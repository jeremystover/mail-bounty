function getToken() {
      chrome.identity.getAuthToken({ interactive: true }, function(token) {
        if (chrome.runtime.lastError) {
			console.log("identity error");
          console.log(chrome.runtime.lastError);
          return;
        }
        console.log("Token received");
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