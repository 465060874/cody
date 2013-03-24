//
// Johan Coppieters - jan 2013 - jWorks
//
//
console.log("loading " + module.id);
var jcms = require('./index.js');


function Atom(basis) {
  // copy from basis
  for (var a in basis) {
    if (basis.hasOwnProperty(a)) {
      this[a] = basis[a];
    }
  }
  this.parentId = this.parent;
  this.parent = null;
}
module.exports = Atom;


Atom.kDefaultName = "New item";

Atom.addDefaults = function(basis, parent) {
  if (typeof parent == "undefined") { parent = {}; }
  
  basis.name = basis.name || Atom.kDefaultName;
  basis.parent = basis.parent || parent.id;
  basis.user = basis.user || parent.user;
  basis.extention = basis.extention || "";
  basis.sortorder = basis.sortorder || 9999;
  basis.created = basis.created || new Date();
  basis.updated = basis.updated || new Date();
};


Atom.prototype.pickParent = function(atomList) {
  this.parent = atomList[this.parentId];
};

Atom.loadAtoms = function(connection, store) {
  //TODO: change to "atoms"
  connection.query('select * from objects', [], function(err, result) {
    store(result);
  });
};

/* required protocol for nodes: */

Atom.prototype.getAllowedGroups = function() { 
  return "*"; 
};
Atom.prototype.hasChildren = function() { 
  return this.app.hasAtomChildren(this); 
};
Atom.prototype.isActive = function() { 
  return true; 
};
Atom.prototype.isVisible = function() { 
  return true; 
};
Atom.prototype.getChildren = function() { 
  return this.app.getAtomChildren(this); 
};
Atom.prototype.getSortOrder = function() { 
  return this.sortorder; 
};
Atom.prototype.setSortOrder = function(nr) {
  this.sortorder = nr;
};
Atom.prototype.setName = function(name) { 
  this.name = name; 
};
Atom.prototype.getName = function() { 
  return this.name; 
};
Atom.prototype.getId = function() { 
  return this.id; 
};

/* Atom specific */

Atom.prototype.isChild = function(anAtom) {
  return anAtom.parentId == this.id;
};


Atom.prototype.scrapeFrom = function(controller) {
  // update all item info from the controller
  this.name = controller.getParam("name");
  this.extention = controller.getParam("extention");
  this.caption = controller.getParam("name");
};


Atom.prototype.doUpdate = function(controller, finish) {
  var self = this;
  
  var values = [self.name, self.parentId, self.sortorder, self.caption, self.extention];
  
  // new or existing record?
  if ((typeof self.id == "undefined") || (self.id === 0)) {
    
    console.log("Atom.doUpdate -> insert atom " + self.name);
    values.push(controller.getLoginId());
    controller.query("insert into items (name, parent, sortorder, caption, extention, updated, created, user) " +
                     "values (?, ?, ?, ?, ?, now(), now(), ?)", values,
      function(err, result) {
        if (err) { 
          console.log("Atom.doUpdate -> erroring inserting atom: " + self.name);
          console.log(err); 
        } else {
          self.id = result.insertId;
          console.log("Atom.doUpdate -> inserted atom: " + self.id);
          if (typeof finish == "function") { finish.call(self, controller); }
        }
    });
    
  } else {
    console.log("Atom.doUpdate -> update atom " + self.id + " - " + self.name);
    values.push(self.id);
    controller.query("update atoms set name = ?, parent = ?, sortorder = ?, caption = ?, extention = ?, updated = now() " +
                     "where id = ?", values,
      function(err) {
        if (err) { 
          console.log("Atom.doUpdate -> erroring updating atom: " + self.id);
          console.log(err); 
        } else {
          console.log("Atom.doUpdate -> updated atom: " + self.id);
          if (typeof finish == "function") { finish.call(self, controller); }
        }
    });
  }
};

Atom.prototype.doDelete = function(controller, finish) {
  var self = this;
  console.log("Atom.doDelete -> delete atom " + self.id + " - " + self.name);
  controller.query("delete from atoms where id = ?", [ self.id ], function() {
    delete controller.app.atoms[self.id];
    console.log("Item.doUpdate -> deleted atom: " + self.id);
  });
};

