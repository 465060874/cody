//
// Johan Coppieters - jan 2013 - jWorks
//
//

var express = require('express');
var fs = require('fs');
var mysql = require('mysql');

var ejs = require('ejs');
var cody = require('./cody');

cody.server = express();

// cookies are encrypted, so we need a pass phrase
cody.server.use(express.bodyParser());
cody.server.use(express.cookieParser("a secret"));
cody.server.use(express.cookieSession());


// startup a routing for all static content of cody (images, javascript, css)
cody.server.get("/cody/static/*", function (req, res) {
    var fileserver = new cody.Static(req, res, "");
    fileserver.serve();
});

// startup a routing for the unit tests
cody.server.all("/cody/*", function (req, res) {
    var aPath = new cody.Path("cody/en/test", "cody", "en");
    var aContext = new cody.Context(aPath, undefined, undefined, req, res);
    res.render("../cody/views/front/index.ejs", { context: aContext });
});


// startup all the web applications

cody.bootstrap = function () {
// startup all the web applications


var connection = mysql.createConnection({
  host: "localhost",
  user: "cody", password: "ydoc",
  database: "cody"
})

connection.connect();

connection.query("SELECT * FROM websites WHERE active='Y' AND ownerconfirmed='Y' ORDER BY id", function(err, rows, fields) {
    if(err) throw err;
    cody.Application.each(rows, function(next){
      var row = this;
      console.log(row);

      cody.startWebApp(cody.server, {
            "name": row.name,
            "version": row.version,
            "defaultlanguage": row.defaultlanguage,
            "hostnames" : row.hostname,
            "dbuser": row.dbuser,
            "dbpassword": row.dbpassword,
            "dbhost": row.dbhost,
            "datapath": row.datapath,
            "db": row.db,
            "controllers": require("./" + row.name + "/controllers/")
        }, next);

    }, function() {
      console.log("Loaded all apps....");
      connection.end();

      cody.server.listen(3000);
      console.log('Listening on port 3000');
    });
});



if (!process.stderr.isTTY) {
    process.on('uncaughtException', function (err) {
        console.error('Uncaught exception : ' + err.stack);
    });
}

};
cody.bootstrap();
