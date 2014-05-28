var express = require('express'),
  app = express(),
  proxy = require('../');

app.use(proxy('www.google.com'));

app.get('/', function(req, res) {
  throw new Error();
});


app.listen(5000);