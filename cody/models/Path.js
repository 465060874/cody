function Path( path, name, deflanguage ) {
  // eliminate leading "/"
  path = path.substring(1);

  this.language = deflanguage;
  this.domain = "";
  this.request = "";
  this.id = "";

  // language
  var i = path.indexOf("/");
  if (i > 0 ) {
    this.language = path.substring(0, i);

    // domain or page link without the language
    path = path.substring(i+1);
    i = path.indexOf("/");
    if (i <= 0) {
      this.domain = path;
    } else {
      this.domain = path.substring(0, i);

      // subdomain or request
      path = path.substring(i + 1);
      i = path.indexOf("/");
      if (i <= 0) {
        this.request = path;
      } else {
        this.request = path.substring(0, i);

        // id
        path = path.substring(i + 1);
        i = path.indexOf("/");
        this.id = (i > 0) ? path.substring(0, i) : path;
      }
    }
  }
    var debughelp = {
        "language": this.language,
        "domain": this.domain,
        "request": this.request,
        "id": this.id
    };
  console.log(debughelp);

  this.pagelink = this.language + "/" + this.domain;
  this.link = "/" + this.pagelink;
}

module.exports = Path;