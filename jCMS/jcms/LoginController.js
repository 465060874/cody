//
// Johan Coppieters - mar 2013 - jCMS
//
//
console.log("loading " + module.id);

var mysql = require("mysql");
var jcms = require("./index.js");


function LoginController(context) {
  // only called for using my methods
  if (typeof context == "undefined") { return; }
  console.log("LoginController.constructor -> page(" + context.page.itemId + ") = " + context.page.title + ", request = " + context.request);
  
  
	// view to be used for getting the username/password
	this.loginView = "front/login.ejs";	
		
	// URL used when user logs in and no specific page/action was requested before
	this.loggedInUrl = (context.language || "nl") + "/dashboard";
	// URL used when the user request a log out.
	this.loggedOutUrl = "/" + (context.language || "nl");
		
	// use this view for the admin operations
	this.adminView = "cms/users.ejs";
	  
	// init inherited controller
	jcms.Controller.call(this, context);
}

LoginController.prototype = Object.create( jcms.Controller.prototype );
module.exports = LoginController;


// Used to be: LoginController.prototype = new jcms.Controller();
// Object.create() is an excellent choice for creating an object without going through its constructor



LoginController.prototype.doRequest = function( finish ) {
  var self = this;
  
  self.context.fn = this.adminView;
		
  // request for displaying the login screen
  if (self.isRequest("")) {
    
    finish( self.loginView );
		
  // request for trying to log in with the given parameters
  } else if (self.isRequest("login")) {
    self.tryLogin( finish );    
 
  } else if (self.isRequest("logout")) {
    self.setLogin({});
    // redirect internally
    var anApp = self.app;
    var aContext = anApp.buildContext( self.loggedOutUrl, self.context.req, self.context.res );
    anApp.handToController(aContext);    
    
  } else {
   finish();
  }
  
  return null;
};


LoginController.prototype.markLogin = function( theUserName, theLogin, locked, finish ) {
  // override this one if you want to log the login (= ! isActive() -> failed)
  // don't forget to call "finish"...
  
  console.log("LoginController.markLogin -> " +
       ((theLogin.isActive()) ? "Login succesful for: " : 
        ((locked) ? "User locked: " : "Login failed for: ")) + theUserName);
    
  finish();
};
	
LoginController.prototype.tryLogin = function( finish ) {
  var self = this;  
  var aUserName = self.getParam("username");
  var locked = false;
  
  // remove login from context and session -> there is no way back...
  self.setLogin({});
  
  jcms.User.getUser(self, aUserName, this.getParam("password"), function (aUser) {
    
    console.log("login rec: " + aUser.id + " - " + aUser.badlogins + " - " + aUser.maxbadlogins);
    if (aUser && (aUser.badlogins >= aUser.maxbadlogins)) {
      aUser.active = false;
      locked = true;
    }
   
    self.markLogin(aUserName, aUser, locked, function() {
      if (aUser.isActive()) {
        self.feedBack(true, "login-successful");
        
        // remember the user in the context and session
        self.setLogin(aUser);
        aUser.clearBadLogins(self, function() {
          self.continuRequest( finish );
        });
        
      } else {
        // failed to login, go back to the same screen
        self.feedBack(false, (locked) ? "login-locked" : "login-failed");
        jcms.User.addBadLogin(self, aUserName, function() {
          finish(self.loginView);
        });
      }
      
    });
    
      
  });
};


LoginController.prototype.continuRequest = function(finish) {
  var self = this;
  var anApp = self.app;
  
  //check for pending request from before the login request
  var aSession = self.context.session;
  if (aSession && aSession.pendingContext) {
    console.log("LoginController.tryLogin -> found pending session after login");
    
    // hand off control to pending controller and adapt our context, remove pending request
    self.context.copyFromMini(aSession.pendingContext);
    delete aSession.pendingContext;
    anApp.handToController(self.context);
    
  } else {
    console.log("LoginController.tryLogin -> found no pending session after login -> go to 'logged-in page'");

    // no pending request, send to "logged in" page
    var aContext = anApp.buildContext( self.loggedInUrl, self.context.req, self.context.res );
    anApp.handToController(aContext);
  }
};

