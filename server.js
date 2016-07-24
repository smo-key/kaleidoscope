var express = require('express');
var app = express();
var request = require('request');
var cache = require("./server_cache.js");
var now = require("./server_now.js");

/** DEBUGGING **/
const debug = true;
cache.setDebug(debug);

/** LOGIN TO PRIVATE API **/
var session = request.jar();
request.post('http://eventregistry.org/login',
{ form:
  {email:'pachachura.arthur@gmail.com', pass: '***REMOVED***'},
  jar: session,
}, function(error, response, body) {
  if ((error) || (response.statusCode != 200)) {
    console.error("Login to EventRegistry failed: " + (error ? error : body.desc));
  }
  else {
    console.log("Login to EventRegistry successful!");
		console.log(response.headers['set-cookie']);
  }
});

/** PUBLIC API **/
app.get('/api/1/trending/images', function(req, res) {
	if (debug) res.header("Access-Control-Allow-Origin", "http://localhost:8000");
	cache.updateTrendingImages(session, function()
	{
		res.status(cache.get().trending.images.status).json(
		{
			error: cache.get().trending.images.error, images: cache.get().trending.images.images, copyright: cache.get().trending.images.copyright
		});
	});
});

app.get('/api/1/trending/suggest', function(req, res) {
	if (debug) res.header("Access-Control-Allow-Origin", "http://localhost:8000");
	cache.updateTrending(session, function()
	{
		res.status(cache.get().trending.suggest.status).json(
		{
			error: cache.get().trending.suggest.error, list: cache.get().trending.suggest.list
		});
	});
});

app.get('/api/1/stats/string', function(req, res) {
	if (debug) res.header("Access-Control-Allow-Origin", "http://localhost:8000");
	cache.updateStatsString(session, function()
	{
		res.status(cache.get().stats.string.status).json(
		{
			error: cache.get().stats.string.error, statString: cache.get().stats.string.statString
		});
	});
});

app.get('/api/1/events', function(req, res) {
  if (debug) res.header("Access-Control-Allow-Origin", "http://localhost:8000");
  console.log("Get event list for: " + req.query.q + " (" + req.query.uri + ")");
  now.getEvents(session, req.query.uri, req.query.lang || "eng", function(data)
  {
    var status = data.status;
    delete data.status;
    res.status(status).json(data);
  });
});

/** LISTEN **/
app.listen(8001, function () {
  console.log('Listening on port 8001!');
});
