//
// Johan Coppieters - jan 2013 - jWorks
//
//
var mysql = require('mysql');
var jcms = require('./index.js');

console.log("loading " + module.id);


function SitemapController(context) {
  // only called for using my methods
  if (context === undefined) { return; }
  console.log("SitemapController.constructor -> page(" + context.page.itemId + ") = " + context.page.title + ", request = " + context.request);
  
  // init inherited controller
  jcms.TreeController.call(this, context);
}

SitemapController.prototype = Object.create( jcms.TreeController.prototype );
module.exports = SitemapController;



SitemapController.prototype.doRequest = function( finish ) {
  var self = this;
  
  self.context.fn = "admin/sitemap.ejs";
  
  if (self.context.request == "realdelete") {
    self.realDelete( self.getParam("node"), function whenDone(result) {
      if (result.status != "OK") { 
        self.feedback(false, "Something went wrong during delete."); 
      }
      finish();
    });
    
    
  } else if (self.context.request == "savedata") {
    //TODO: get id from page editor
    self.saveData( self.getParam("node"), self.getParam("data"), 0, finish);

    
  } else if (self.context.request == "adjust") {
    self.adjustElements( self.getParam("node"), function whenDone(result) {
      // get all info and data on this node
      self.context.request = "getnode";
      jcms.TreeController.prototype.doRequest.call(self, finish);
    });

    
  } else {
    // this.super.doRequest( finish );  of  this.super.doRequest.call(this, finish);
    jcms.TreeController.prototype.doRequest.call(self, finish);
    
  }
};

/* One off object for making roots for Globals and General */
function Root(aList, id, name) {
  this.getId = function() { return id; };
  this.getName = function() { return name; };
  this.hasChildren = function() { return true; };
  this.getChildren = function() { return aList; };
 }
 
/* Overridden - Config functions */
SitemapController.prototype.getRoot = function() {
  return 0;
  // return this.app.roots[this.context.page.language];
};

SitemapController.prototype.getType = function(theNode) { 
  return ""; 
};

SitemapController.prototype.getFilePath = function() { 
  return ""; 
};
SitemapController.prototype.getObject = function(id) {
  var language = this.context.page.language;  
  return this.app.getPage(language, id);
};

/* SitemapController - Specific actions */

SitemapController.prototype.saveData = function(thePage, theData, theId, finish) {    
  var self = this;
  console.log("Received SitemapController - saveData, pageId = " + thePage);
  
  var aPage = self.getObject( self.toId(thePage) );
  try {
    
    if (! self.isAllowed(aPage.item)) {
      finish( { status: "NAL" } );
      return;
    }
    
    aPage.content[theId] = theData;
    aPage.updateContent(this, theId, theData, function(err) {
      if (err) {
        finish( { status: "NOK", error: err } );
      } else {
        finish( { status: "OK" } );
      }
    });
    
    
  } catch (e) {
    console.log(e);
    console.log("SitemapController.SaveData: failed to save the content of page " + thePage);

    finish( { status: "NOK", error: e } );
  }
};

/* Overridden - Action functions */

SitemapController.prototype.addObject = function( title, refNode, type, kind, finish ) {
    var self = this;
    console.log("Received SitemapController - addObject, refnode = " + refNode + ", type = " + type);
    
    var refNodeId = self.toId(refNode);
    var orderNr, aParent;

    // fetch the user id
    var userId = this.getLoginId();
    
    // fetch the parent and sortorder
    if (type == "inside") {
      orderNr = 5;
      aParent = self.app.getItem(refNodeId);
    } else { 
      // after -> is always at the end -> we never get this !! (worked with previous version of jsTree)
      var refItem = self.app.getItem(refNodeId);
      orderNr = refItem.sortorder + 10;
      aParent = refItem.parent;
    }
    
    // can we make modifications to this parent node
    if (! self.isAllowed(aParent)) {
      finish( { status: "NAL" } );
      return;
    }
    
    // make the item
    var basis = jcms.Item.addDefaults({name: title, user: userId, sortorder: orderNr}, aParent);
    var anItem = new jcms.Item(basis, self.app);
    
    try {
      anItem.doUpdate(self, function() {
        // we need the id of the new item, so use the callback
        self.app.addItem(anItem);
          
        // make the page in all languages
        var langs = self.app.getLanguages();
 
        jcms.Application.each( langs, function makePageForLanguage(done) {
          // iterator over all languages
          basis = jcms.Page.addDefaults({language: this.id}, anItem);
          var aPage = new jcms.Page(basis, self.app);
            
          aPage.doUpdate(self, function() {
              self.app.addPage(aPage);
              done();
          }, true);
          
        }, function whenDone(err) {
          // terminator
          
          if (err) {
            finish( { status: "NOK", error: err } );
            
          } else {
            //TODO: add default elements from template and insert in the database
            //aContent.FetchElements(aPage.fLanguage, - aDefaultTemplateId);
            //aContent.doInsertElements();
          
            finish( { status: "OK", node: "id_" + anItem.id } );
          }
        });
      });
        
    } catch (e) {
      console.log("SiteMapController.AddPage: Failed to create the Item or Page objects.");
      console.log(e);
      finish( { status: "NOK", error: e } );
    }
};


SitemapController.prototype.moveObject = function( nodeId, refNode, type, finish ) {
  // type = "before", "after" or "inside"
  console.log("Received SitemapController - moveObject, refnode = " + refNode + 
              ", node = " + nodeId + ", type = " + type);
  
  var orderNr;
  var aParent;
  
  // fetch the parent and insertion point
  if (type == "inside") {
    aParent = this.app.getItem(this.toId(refNode));
    orderNr = 9999;
  } else {  
    var refItem = this.app.getItem(this.toId(refNode));
    aParent = this.app.getItem(refItem.parentId);
    orderNr = refItem.sortorder + ((type == "before") ? -5 : +5);
  }
  
  // fetch the node to be moved
  var anItem = this.app.getItem(this.toId(nodeId));
  var curParent = this.app.getItem(anItem.parentId);
  
  // check the new target parent
  if (! this.isAllowed(aParent)) {
    finish( { status: "NAL" } );
    return;
  }
  
  // check the current parent
  if (! this.isAllowed(curParent)) {
    finish( { status: "NAL" } );
    return;
  }
  
    
  // position in the tree
  anItem.parentId = aParent.id;
  console.log("SiteMapController.MovePage: old order = " + anItem.sortorder + ", new order = " + orderNr);
  anItem.sortorder = orderNr;
  
  try {
    // anItem.doUpdate(this); -> done in respace too, so no need to call it here
    this.app.buildSitemap();
    
    this.respace(aParent, function whenDone() {
      finish( { status: "OK" } );
    });
    
  } catch (e) {
    console.log("SiteMapController.MovePage: Failed to update the Item object.");
    console.log(e);
    finish( { status: "NOK", error: e.toString() } );
  }
};


SitemapController.prototype.renameObject = function( title, nodeId, finish ) {
  var self = this;
  console.log("Received SitemapController - renameObject, node = " + nodeId + ", title = " + title);
      
  var aPage = self.getObject( self.toId(nodeId) );
  if (aPage) {
      
    if (! self.isAllowed(aPage.item)) {
      finish( { status: "NAL" } );
      return;
    }

    aPage.title = title;
  
    try {
      aPage.doUpdate(self, function() {
        
       // perhaps overkill but for sortorder == alphabetical the order of pages can change
       self.app.buildSitemap();
       
       // rename the item if it's the page of the default language (although item names are not shown)
       if ((self.app.isDefaultLanguage(aPage.language)) || (aPage.item.name == jcms.Item.kDefaultName)) {
          aPage.item.name = title;
          aPage.item.doUpdate(self, function() {
            finish( { status: "OK" } );
          });
        } else {
          finish( { status: "OK" } );
        }
      });
      
      
    } catch (e) {
      console.log("SiteMapController.RenameObject: Failed to update the Page or Item object.");      
      finish( {status: "NOK", error: e } );
    }
    
  } else {
    finish( {status: "NOK", error: "page not found" } );
  }
};


SitemapController.prototype.realDelete = function( node, finish ) {
  var self = this;
  
  console.log("Received SitemapController - realdelete, node = " + node);
  
  //request to delete a node from the tree
  var aPage = self.getObject( self.toId(node) );
  var anItem = aPage.item;
  
  if (! self.isAllowed(anItem)) {
    finish( { status: "NAL" } );
    return;
  }
  
  if (aPage.hasChildren()) {
    finish( { status: "NOE" } );
    return;
  }
  
  try {
    anItem.doDelete(self, function() {
      finish( { status: "OK" } );
    });
    
  } catch(e) {
    console.log("SiteMapController.RealDelete: Failed to delete the Page object -- " + e);  
    finish( { status: "NOK", error: e } );
  }
};


SitemapController.prototype.deleteObject = function( nodeId, finish ) {
  var self = this;
  
  // for pages, this function only de-activates the item
  console.log("Received SitemapController - deleteObject, node = " + nodeId);
  
  try {
    var aPage = self.getObject( self.toId(nodeId) );
    
    if (! self.isAllowed(aPage.item)) {
      finish( { status: "NAL" } );
      return;
    }

    aPage.doDeactivate(self, function() {
      finish( { status: "OK" } );
    });

    
  } catch (e) {
    console.log("SiteMapController.DeletePage: Failed to delete the Page object -- " + e);  
    finish( { status: "NOK", error: e } );
  }
};



SitemapController.prototype.uploadFile = function( filePath, nodeId ) {
};


SitemapController.prototype.fetchNode = function( theNode ) {
  var self = this;
  
  var aPage = self.getObject( self.toId(theNode) );
  if (! self.isAllowed(aPage.item)) { return {status: "NAL"}; }
  
  // just switch the page in our current context and we're done ??
  self.context.page = aPage;
  
  //TODO: get all elements connected to this page
  self.context.editElements = [];
  
  console.log("SitemapController.FetchNode: node = " + theNode + " + language = " + aPage.language + " => " + self.context.page.item.id);

};

SitemapController.prototype.updateElements = function( nodeId, finish ) {
	finish();
	/*
	 String aCList = this.getParam("elements");
    String aList[] = aCList.split(",");
    int nr = 1;
    for (String anId: aList) {
      try {
        int anItemNr = Integer.parseInt(anId);
        String aType = this.getParam("K"+anId);
        
        if (aType.equals("X")) 
          TElement.doDelete(this.fRequest, anItemNr);
        else if (anItemNr > 900)
          TElement.doInsert(this.fRequest, thePage.fItemId, this.getParam("N"+anId), 
                    aType, this.getParam("S"+anId), nr*10);
        else
          TElement.doUpdateLoad(this.fRequest, anItemNr, this.getParam("N"+anId), 
                      aType, this.getParam("S"+anId), nr*10);
      } catch (Exception e) {}
      nr++;
    }
	 */
};

SitemapController.prototype.saveInfo = function( nodeId, finish ) {
	var self = this;
	
  var aPage = self.getObject( self.toId(nodeId) );
  var anItem = aPage.item;

  anItem.scrapeFrom(self);
  anItem.doUpdate(self, function() {

    aPage.scrapeFrom(self);
    aPage.doUpdate(self, function() {

      self.updateElements(aPage, function() {

        self.app.buildSitemap();
        self.context.shownode = anItem.id;
        finish();
      });
    });
  });
 };


SitemapController.prototype.toId = function( nodeId ) {
  return (! nodeId) ? 0 : ((nodeId.indexOf("_") > 0) ? nodeId.substring(3) : nodeId);
};


/* Controller specific, called from template */

SitemapController.prototype.getAdminTree = function() {
  return this.getTree( new Root(this.app.admins, 1, "Admin") );
};

SitemapController.prototype.getGlobalTree = function() {
  return this.getTree( new Root(this.app.globals, 1, "Globals") );
};


SitemapController.prototype.adjustElements = function( theNode, finish ) {
  var self = this;
  console.log("SiteMapController.adjustElements: add correct Elements for (" + theNode + ")");
  
  var aPage = self.getObject( self.toId(theNode) );

  self.saveInfo(theNode, function whenDone() {
    aPage.deleteElements( function (){
      aPage.copyElements( aPage.language, - aPage.item.templateId, function() {
        self.context.savedPage = aPage;
        self.context.fetchnode = "id_" + theNode;
      });
    });
  
    finish();
  });

};


/* SitemapController utilities */
SitemapController.prototype.respace = function( parent, finish ) {
	var self = this;
	
  // Find all children, any page of the item will do, they all have the same children in any language
  var aPage = this.getObject(parent.id);

  var nr = 0;
  jcms.Application.each(aPage.children, function respaceOnePage(done) {
    var aChildPage = this;
    nr += 10;
    console.log("SiteMapController.Respace: checking '" + aChildPage.item.name + "' now = " + aChildPage.item.sortorder + " to " + nr);
    if (aChildPage.item.sortorder != nr) {
      aChildPage.item.sortorder = nr;
      aChildPage.item.doUpdate(self, function() {
        done();
      });
    } else {
      done();
    }
    
  }, function whenDone(err) {
    if (err) { console.log("SitemapController - respace: error = " + err); }
    if (typeof finish == "function") { finish(); }
    
  });

};


SitemapController.prototype.isAllowed = function( theNode ) {
  var aUserDomain = this.getLogin().getDomain();
  var anItemDomain = theNode.getAllowedGroups();
  
  console.log("TSiteMapController.isAllowed: user = '" + aUserDomain + "', item = '" + anItemDomain + "'");

  if (aUserDomain.length === 0) { return false; }
  if ((aUserDomain=="*") || (aUserDomain=="rWorks")) { return true; }
    
  if ((anItemDomain.equals=="*") || (anItemDomain.length === 0)) { return true; }
  
  var aList = anItemDomain.split(",");
  for (var x in aList) {
    if (aList[x]==aUserDomain) { 
      return true; 
    }
  }
  
  return false;
};

