var express = require('express');
var app = express();
var request = require('request');
var morgan = require('morgan');
var yaml = require("js-yaml");
var fs = require('fs');
var cache = require("./server_cache.js");
var now = require("./server_now.js");
var analysis = require("./server_analysis.js");
var util = require("./server_util.js");

/** DEBUGGING **/
var debug = true;
cache.setDebug(debug);
app.use(morgan('dev'));

/** CONFIGURATION **/
var config = { };
if (fs.existsSync("private.yml"))
{
  configdata = fs.readFileSync("private.yml");
  var cfg = yaml.safeLoad(configdata);
  config.port = cfg.port || process.env.PORT || 8000;
  config.er_email = cfg.eventRegistryEmail;
  config.er_pass = cfg.eventRegistryPassword;
  console.log(config);

  debug = cfg.debug || false;
  cache.setDebug(debug);
  cache.setApiKey(cfg.nyTimesApiKey);
}
else {
  console.error("***** No 'private.yml' found! Things will break! *****");
}

/** LOGIN TO PRIVATE API **/
var session = request.jar();
request.post('http://eventregistry.org/login',
{ form:
  {email:config.er_email, pass: config.er_pass},
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

app.get('/api/1/event', function(req, res) {
  if (debug) res.header("Access-Control-Allow-Origin", "http://localhost:8000");
  console.log("Get event data for event " + req.query.uri);
  analysis.getEventData(session, req.query.uri, req.query.lang || "eng", req.query.desc, req.query.title, function(err, data)
  {
    var status = (err == null) ? 200 : 500;
    res.status(status).json(data);
  });
});

app.get('/api/1/analyze', function(req, res) {
  if (debug) res.header("Access-Control-Allow-Origin", "http://localhost:8000");
  analysis.analyzeEvent(session, req.query.uri, req.query.lang || "eng", function(err, data)
  {
    var status = (err == null) ? 200 : 500;
    res.status(status).json({ articles: data });
  });
})

app.get('/api/1/analyze/status', function(req, res) {
  if (debug) res.header("Access-Control-Allow-Origin", "http://localhost:8000");
  analysis.getAnalysisStatus(req.query.uri, function(err, data)
  {
    var status = (err == null) ? 200 : 500;
    res.status(status).json(data);
  });
})

app.get('/api/1/util/imagecolor', function(req, res) {
  if (debug) res.header("Access-Control-Allow-Origin", "http://localhost:8000");
  util.getImageColor(req.query.url, function(err, data)
  {
    console.log(data);
    var status = (err == null) ? 200 : 500;
    res.status(status).json(data);
  });
})

/** LISTEN **/
app.listen(8001, function () {
  console.log('Listening on port 8001!');
});
