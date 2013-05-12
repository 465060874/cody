//
// Johan Coppieters - jan 2013 - jWorks
//
//

// Next items are also in the issues on BitBucket
//TODO: #1 - drop active from items
//TODO: #1 - drop datatable from templates
//TODO: #1 - rename defaultoper from templates to defaultrequest
//TODO: #1 - rename nr from users to sortorder
//TODO: #1 - rename class in templates to controller

//TODO: #2 - use allowdelete, allowinsert of item
//TODO: #3 - set defaultrequest of item somewhere...

var mysql = require('mysql');
var jcms = require('./index.js');

console.log("loading " + module.id);


function Application(name, version, datapath) {
  // hashmaps with a (special) page per language
  this.homepages = {};
  this.dashboards = {};
  this.globals = {};
  this.orphans = {};
  this.logins = {};
  
  this.templates = null;    // hashmap with (id - template)
  this.items = null;        // hashmap with (id - item)
  this.pages = null;        // array with all pages
  this.urls = null;         // hashmap with (urls - page)
  this.atoms = null;        // hashmap with (id - atom)
  this.languages = [];      // array with all languages
  this.domains = null;      // array with all (user) domains
  this.forms = {};          //TODO: hashmap with (id - form) -- or use some stuff from Yanic
  this.controllers = {};    // hashmap with (name - constructor)
    
  this.testing = false;
  this.logging = true;
  this.name = name;
  this.version = version;
  this.datapath = datapath;
  
  this.dumped = false;  
}
module.exports = Application;

// Constants
Application.kDefaultLanguage = "nl";

// Atom roots
Application.kImageRoot = 1;
Application.kFileRoot = 2;

// Content root id's
Application.kNoPage = -1;
Application.kHomePage = 1;
Application.kLoginPage = 2;
Application.kOrphansPage = 3;
Application.kFooterPage = 4;
Application.kDashboardPage = 9;
Application.kGlobalPage = 99;



Application.prototype.init = function() {
  this.getConnection();
  
  this.addControllers();
  
  // daisy chained loading of all CMS elements:
  //   languages, templates, items, pages, forms, ...
  this.fetchStructures();
};

Application.prototype.addController = function(name, controller) {
  this.controllers[name] = controller;
};

Application.prototype.addControllers = function() {
  // do this dynamically for all templates[x].controllerName -- Tim ?
  this.addController('Controller', jcms.Controller);
  this.addController('ContentController', jcms.Controller);
  this.addController('LoginController', jcms.LoginController);
  this.addController('UserController', jcms.UserController);
  this.addController('SitemapController', jcms.SitemapController);
  this.addController('ImageController', jcms.ImageController);
  
};


Application.prototype.err = function(p1, p2, res) {
  console.log("*** error ***");
  this.log(p1, p2);
  
  if (res !== undefined) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.response.write("404 Not Found\n");
    res.response.end();
  }
};
Application.prototype.log = function(p1, p2) {
  if (this.logging) {
    if (p1 === undefined && p2 === undefined) {
      console.log("Application -> ");
      console.log(this);
      
    } else if (p2 === undefined) {
      console.log(" - " + p1);
      
    } else {
      console.log(p1 + " -> " + p2);
    }
  }
};

Application.prototype.getDataPath = function() {
  return this.datapath;
};

///////////////
// Utilities //
///////////////
Application.endOfTime = function() {
	return new Date(2100,12,31,23,59,59);
};

// Daisy chain operators
// - list should be an array
// - iterator is a function that should the passed function when done
//   if it passes an error to the function the loop end here
// - finished is a function that is called when everything is done with no parameter
//   or that is called when the first error occurs
//
// Example:
//   var list = [1, 2, 3, 4, 5];
//   var sum = 0;
//   Application.each(list, function(done) { 
//    sum += this; 
//    done();  // pass an error is something went wrong
//
//   }, function(err) { 
//     // do something with the err if any...
//     console.log("sum = " + sum);
//
//   });

Application.each = function(list, iterator, finished) {
  var nr = list.length;
  function one(current) {
   if (current >= nr) {
     finished();
     
   } else {
     iterator.call(list[current], function(err) {
       if (err) {
         finished(err);
       }
       one(current+1);
     });
   }
  }
  one(0);
};


// Daisy chain functions
// - functionList is a list of functions to be executed
// - each function is executed, with a callback function to be called at the end
// - if this callback is passed an error, the execution is terminated 
//   and the finish function will be called with this error
// - the finish function is called at the end with no error if everything went well
//
// Example:
//  var anObject = { nr: 0 };
//  var aList = [ [anObject, function(done) { this.nr++; done(); }], 
//                [anObject, function(done) { this.nr += 2; done(); }] ];
//  var nr = 0;
//  Application.doList(flist, function(err) { 
//    console.log("error ? " + err + ", total = " + anObject.nr); 
//  });
//
Application.doList = function(functionList, finished) {
  var nr = functionList.length;
  function one(current) {
   if (current >= nr) {
     if (typeof finished === "function") { finished(); }
     
   } else {
     var entry = functionList[current];
     entry[1].call( entry[0], function(err) {
       if (err) {
         if (typeof finished === "function") { finished(err); }
       }
       one(current+1);
     });
   }
  }
  one(0);
};

//////////////////
// Page serving //
//////////////////
Application.prototype.servePage = function(req, res) {
  var self = this;
   
  // can't show all content, because during init, it is fetched async
  if (! this.dumped) { this.dump(); }
  
  // get url path, strip leading '/'
  var path = req._parsedUrl.pathname.substring(1);
  self.log("------------------------------------------------------------------- " + new Date() + "--");
  self.log("servePage - path -> " + path);
  
   
  var aContext = this.buildContext( path, req, res );
  self.handToController(aContext);
};

Application.prototype.buildContext = function (path, req, res) {
  var self = this;
  
  // get the page
  var language = self.findLanguage(path);
  var page = self.findPage(path, language);
  
  if (page === null) {
      self.err("servePage", "No page found for path = " + path + " & language = " + language, res);
      return null;
  }

  self.log("servePage -> page", page.language + "/" + page.itemId + " - " + page.title);
  
  // build a context
  var context = new jcms.Context(path, page, self, req, res);
  console.log("servePage - params -> ");  console.log(context.params);
  console.log("servePage - session -> "); console.log(context.session);
  console.log("servePage - files -> ");   console.log(req.files);
  return context;
};

Application.prototype.handToController = function(context) {
  var self = this;
  
  // make a controller and send it 'doRequest'
  self.log("handToController", context.page.item.template.controllerName);
  var controller = context.page.getController(context);
  
  if (controller === null) {
    self.err("handToController", "No controller found for " + context.page.item.template.controllerName);
    return;
  }
  
  // check if authentication is required for this action
  //  and if so and not yet done: store this action and perform login first
  if (controller.needsLogin()) {
    if (controller.isLoggedIn()) {
      self.log("http get - check login", "already logged in");
    } else {
      self.log("http get - check login", "needs login, redirect/remember");
      
      self.logInFirst(context);
      return;
    }
  }
  
  controller.doRequest( function(fn, header) {
    // calback function should always be called by doRequest
    //  render with given or the template in the context (controller may have changed it)
    //  if no render template present ( == "") either
    //    -- assume the controller performed res.writeHead() / .write() / .end() -- ajax req?
    //    -- another controller has taken over

    if (typeof fn == "object") {
      controller.gen(fn, header);
      
    } else {
      if (typeof fn != "undefined") { 
        context.fn = fn; 
      }
      
      self.log("Application.handToController -> finish - template file = ", (context.fn==="") ? "** none **" : context.fn);
      if (context.fn !== "") {
        context.res.render(context.fn, context);
      }
    }
      
    controller.close();
  });
};

Application.prototype.logInFirst = function(context) {
  var self = this;
  var req = context.req;
  
  // copy minimal version of the context to our session
  req.session.pendingContext = context.getMini();
  
  // build context and make LoginController
  var aContext = self.buildContext( context.page.language + "/login", req, context.res );
  self.handToController(aContext);
};

/////////////////
// SQL support //
/////////////////
Application.prototype.getConnection = function() {
  
  if (typeof this.connection === "undefined") {
    this.log("Application", "Make new Connection");
    
    //TODO: read from config file
    // https://github.com/felixge/node-mysql
    this.connection = mysql.createConnection({
        host: 'localhost',
        user: 'root', password: 'Jd2qqNAt',
        database: this.name
    });
  } else {
    this.log("Application", "Returning existing connection");
  }
  
  if (typeof this.connection === "undefined") {
    throw(new Error("Fatal error: No database connection"));
  }
  return this.connection;
};

Application.prototype.returnConnection = function( connection ) {
  // Do nothing: we only have 1 connection and we don't close it in between requests...
  
};

///////////////////////////////////////////
// Fetch all structured data into memory //
///////////////////////////////////////////
Application.prototype.fetchStructures = function() {
  Application.doList([
    [this, Application.prototype.fetchLanguages],
    [this, Application.prototype.fetchTemplates],
    [this, Application.prototype.fetchItems],
    [this, Application.prototype.fetchPages],
    [this, Application.prototype.fetchForms],
    [this, Application.prototype.fetchDomains],
    [this, Application.prototype.fetchAtoms]
  ]);
};

///////////////
// Languages //
///////////////
Application.prototype.fetchLanguages = function(done) {
  var self = this;
  
  jcms.Page.loadLanguages(this.connection, function(result) {
    self.languages = result;
    self.log("Application.fetchLanguages", "fetched " + result.length + " languages");
    
    // next step
    done();
  });
};

Application.prototype.getLanguages = function() {
	return this.languages;
};
Application.prototype.isDefaultLanguage = function(language) {
  return language == Application.kDefaultLanguage;
};
Application.prototype.findLanguage = function(url) {
  var i = url.indexOf("/");
  return (i > 0) ? url.substring(0, i) : Application.kDefaultLanguage;
};


///////////////
// Templates //
///////////////
Application.prototype.getTemplate = function(templateId) {
  return this.templates[templateId];
};
Application.prototype.fetchTemplates = function(done) {
  var self = this;
  
  jcms.Template.loadTemplates(this.connection, function(result) {
    self.templates = {};
    for (var i = 0; i < result.length; i++) {
      // make an Template object of our data
      var O = new jcms.Template(result[i], self.controllers);
      
      // store under its id
      self.templates[O.id] = O;
    }
    self.log("Application.fetchTemplates", "fetched " + result.length + " templates");
    
    // next step
    done();
  });
};


///////////
// Items //
///////////
Application.prototype.getItem = function(itemId) {
  return this.items[itemId];
};
Application.prototype.attachItemChildren = function() {
  // loop through all items and attach their parent
  for (var i in this.items) {
    // let the page itself pick from the list
    this.items[i].pickParent(this.items);
  }
};

Application.prototype.addItem = function(anItem) {
  var self = this;
  
	self.items[anItem.id] = anItem;
	anItem.pickParent(this.items);
  self.log("Application.addItem", "added " + anItem.id + " / " + anItem.name);
};

Application.prototype.fetchItems = function(done) {
  var self = this;
  
  jcms.Item.loadItems(this.connection, function(result) {
    // make hashtable on item id
    self.items = {};
    
    for (var i = 0; i < result.length; i++) {
      // make an Item object of our data
      var O = new jcms.Item(result[i], self);
      
      // store under its id
      self.items[O.id] = O;
    }
    self.attachItemChildren();

    self.log("Application.fetchItems", "fetched " + result.length + " items");
    // console.log(self.items);
    
    // next step
    done();
  });
};


///////////
// Pages //
///////////
Application.prototype.getPageLink = function(path) {
  var pos = path.indexOf("/");
  if (pos < 0) { return path; }
  
  pos = path.indexOf("/", pos+1);
  if (pos < 0) { return path; }
  
  return path.substring(0, pos); 
};

Application.prototype.getSubDomain = function(path) {
  var pos = path.indexOf("/");
  if (pos < 0) { return ""; }
  
  pos = path.indexOf("/", pos+1);
  if (pos < 0) { return ""; }
  
  return path.substring(pos+1);
};

Application.prototype.getPage = function(languageOrLink, itemId) {
  if (typeof itemId == "undefined") {
    return this.urls[languageOrLink];
  } else { 
    return this.urls[languageOrLink+"/"+itemId];
  }
};

Application.prototype.findPage = function(path, language) {
  // Use only language/domain
  var pageLink = this.getPageLink(path);
  var aPage = this.urls[pageLink];
  
  // if page not found -> serve the language/notfound page
  if (typeof aPage === "undefined") {
    aPage = this.urls[language + "/notfound"];
  }
  
  // if no notfound-page -> try to serve the home page
  if (typeof aPage === "undefined") {
    aPage = this.urls[language + "/welcome"];
    console.log("Application.findPage - " + language + "/welcome");
  }
  
  if (typeof aPage !== "undefined") {
    aPage = aPage.getDisplay();
  }
  
  return aPage;
};

Application.prototype.genRoots = function() {
  this.homepages = {};
  this.dashboards = {};
  this.globals = {};
  this.orphans = {};
  this.logins = {};
  
  // loop through all pages
  //   - put in correct special page variable for quick access +
  //   - lookup for each page its 'toplevel' (root)
  for (var i in this.pages) {
    var p = this.pages[i];
    if (p.item.id === Application.kHomePage)      {  this.homepages[p.language] = p; }
    if (p.item.id === Application.kOrphanPage)    {  this.orphans[p.language] = p; }
    if (p.item.id === Application.kDashboardPage) {  this.dashboards[p.language] = p; }
    if (p.item.id === Application.kGlobalPage)    {  this.globals[p.language] = p; }
    if (p.item.id === Application.kLoginPage)     {  this.logins[p.language] = p; }    
    
    // let the page find its toplevel
    p.addRoot();
  }  
};

Application.prototype.attachChildrenToPages = function() {
  // loop through all pages and attach their children
  for (var i in this.pages) {
    // let the page itself pick from the list
    this.pages[i].addChildren(this.pages);
  }
};

Application.prototype.buildSitemap = function() {
  this.attachChildrenToPages();
  this.genRoots();
};

Application.prototype.addPage = function(page) {
	page.addTo(this);
	this.buildSitemap();
};

Application.prototype.fetchPages = function(done) {
  var self = this;
  
  jcms.Page.loadPages(self.connection, function(result) {
    self.pages = [];
    self.urls = {};
    
    Application.each(result, function(nextOne) {
      
      var onePage = new jcms.Page(this, self);
      
      onePage.addTo(self);
      onePage.getContent(self.connection, nextOne);

    }, function(err) { 
      self.buildSitemap();
      
      self.log("Application.fetchPages", "fetched " + result.length + " pages");
      
      // next step
      done();
    });
  });
};

Application.prototype.deletePagesForItem = function( itemId, finish ) {
  var self = this;
  
  // delete the pages in every language from the url hashmap
  for (var i in self.languages) {
    var lan = self.languages[i].id;
    var P = self.getPage(lan, itemId);
    delete self.urls[lan+"/"+itemId];
    if (P.link !== "") {
      delete self.urls[lan+"/"+P.link];
    }
  }
  
  // delete the page from the pages array
  // by rebuilding the array while omitting the pages
  var newList = [];
  for (var p in this.pages) {
    if (self.pages[p].itemId != itemId) {
      newList.push(self.pages[p]);
    }
  }
  self.pages = newList;
  
  // rebuild the tree structure
  self.buildSitemap();
  
  finish();
};

Application.prototype.dump = function() {
  var cnt = 0;
  
  function printLevel(r, nr) {
    var tab = "";
    for (var i=0; i<nr; i++) { tab = tab + " "; }

    for(var p in r) {
      console.log(tab + r[p].shortString());
      cnt += r[p].contentLength();
      printLevel(r[p].children, nr+2);
    }
  }
  
  this.dumped = true;
  console.log("--- Controllers ---");
  for (var c in this.controllers) {
    console.log(c);
  }
  
  console.log("--- Homepages ---");
  printLevel(this.homepages, 0);
  
  console.log("--- Dashboard ---");
  printLevel(this.dashboards, 0);
  
  console.log("--- Pages ---");
  printLevel(this.orphans, 0);
  
  console.log("--- Global ---");
  printLevel(this.globals, 0);
  
  console.log("--- Logins ---");
  printLevel(this.logins, 0);
  
  console.log("----------------");
  console.log("Total content: " + cnt + " bytes");
  console.log("----------------");
};


///////////
// forms //
///////////
Application.prototype.getForm = function(formId) {
  return {};
  //TODO: read forms from the database...
  // return this.forms[formId];
};
Application.prototype.fetchForms = function(done) {
   var self = this;
  
   // fetch all forms
  
   // next step
   done();
};


/////////////////////
//Users - Domains //
/////////////////////
Application.prototype.fetchDomains = function(done) {
  var self = this;
  
  // fetch all user domains
  jcms.User.getDomains(self.connection, function(result) {
    self.storeDomains(result);
    self.log("Application.fetchDomains", "fetched " + result.length + " domains");
    
    // next step
    done();
  });
};

Application.prototype.storeDomains = function(result) {
  var self = this;
  self.domains = [];
  for (var i = 0; i < result.length; i++) {
    self.domains.push(result[i].domain);
  }
};


///////////
// Atoms //
///////////
Application.prototype.getAtom = function(id) {
  return this.atoms[id];
};

Application.prototype.addAtom = function(atom) {
  this.atoms[atom.id] = atom;
  atom.app = this;
};

Application.prototype.hasAtomChildren = function(parent) {
  for (var i = 0; i < this.atoms.length; i++) {
    if (this.atoms[i].id == parent.id) {
      return true;
    }
  }
  return false;
};
Application.prototype.getAtomChildren = function(parent) {
  var list = [];
  for (var i in this.atoms) {
    var anAtom = this.atoms[i];
    if (parent.isChild(anAtom)) {
      list.push(anAtom);
    }
  }
  list.sort( function(a, b) { return a.sortorder - b.sortorder; });
  return list;
};

Application.prototype.fetchAtoms = function(done) {
  var self = this;
  
  // fetch all atoms
  jcms.Atom.loadAtoms(self.connection, function(result) {
    self.atoms = {};
    for (var i = 0; i < result.length; i++) {
      self.addAtom(new jcms.Atom(result[i]));
    }
    self.log("Application.fetchAtoms", "fetched " + result.length + " atoms");
    
    // next step
    done();
  });
};


