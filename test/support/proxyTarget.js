'use strict';

var express = require('express')
var chunkLength = require('../../lib/chunkLength');

function proxyTarget(port, timeout) {
  var target = express();

  timeout = 1000 || timeout;

  target.get('/', function(req, res) {
    setTimeout(function() {
      res.send('Success');
    },timeout);
  });

  target.post('/post', function (req, res, next) {
    req.pipe(res);
    //var chunks = [];
    //req.on('data', function(chunk) { chunks.push(chunk); });
    //req.on('end', function()       {
      //var upload = Buffer.concat(chunks, chunkLength(chunks));
      //res.write(upload);
      //res.end();
      //res.json({
        //attachment: upload
      //});
    //});
    //req.on('error', function(err)  { next(err); });
  });

  target.use(function (req, res, next) {
    res.send('Failure');
  });

  return target.listen(port);
}

module.exports = proxyTarget;
