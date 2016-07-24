var request = require('request');
var time = require('moment');
var util = require("./server_util.js");

var debug = false;
exports.setDebug = function(bool)
{
  debug = bool;
}

/** CACHED FUNCTIONS **/
var cache = { };
exports.get = function()
{
  return cache;
}
exports.updateTrending = function(session, cb)
{
	var skipCheck = false;
	if (cache.trending === undefined) cache.trending = { };
	if (cache.trending.suggest === undefined) cache.trending.suggest = { status: 500, error: null, list: [ ] };
	if (cache.trending.suggest.time === undefined) { skipCheck = true; }
	if (skipCheck || (cache.trending.suggest.time.diff(time(new Date()), 'seconds') <= (-60 * 30))) {
		cache.trending.suggest.time = time(new Date());
		cache.trending.suggest.list = [ ];
    console.log("Updating trending suggestions...");

		request('http://eventregistry.org/json/trends?action=getConceptTrendGroups&conceptType=wiki&conceptType=org&conceptType=person&conceptType=loc&conceptCount=5&conceptIncludeConceptImage=false&conceptIncludeConceptTrendingHistory=false&conceptLang=eng&source=news&type=concept', { jar: session }, function(error, response, body) {
			if (error || response.statusCode != 200) {
				console.error(body);
				console.error(error);
				cache.trending.suggest.status = 500;
				cache.trending.suggest.error = error;
				if (!error) cache.trending.suggest.error = response.body;
				cb();
			}
			else {
				var json = JSON.parse(body);
				request('http://eventregistry.org/json/suggestConcepts?prefix=&lang=eng&source=concepts&source=conceptClass', { jar: session }, function(error, response, body) {
					if (error || response.statusCode != 200) {
						console.error(body);
						console.error(error);
						cache.trending.suggest.status = 500;
						cache.trending.suggest.error = error;
						if (!error) cache.trending.suggest.error = response.body;
						cb();
					}
					else {
						var json2 = JSON.parse(body);
						for (var i=0; i<json.wiki.trendingConcepts.length; i++)
						{
							cache.trending.suggest.list.push(json.person.trendingConcepts[i].label.eng);
							cache.trending.suggest.list.push(json.org.trendingConcepts[i].label.eng);
							cache.trending.suggest.list.push(json.loc.trendingConcepts[i].label.eng);
							cache.trending.suggest.list.push(json.wiki.trendingConcepts[i].label.eng);
							cache.trending.suggest.list.push(json2[(2*i) % json2.length].label.eng);
							cache.trending.suggest.list.push(json2[((2*i)+1) % json2.length].label.eng);
						}
						cache.trending.suggest.status = 200;
						cb();
					}
				});
			}
		});
	}
	else {
		cb();
	}
}

function parseTrendingImages(json)
{
  var images = [ ];

  var count = json.results.length > 10 ? 10 : json.results.length;
  for (var i=0; i<count; i++)
  {
    var item = { title: json.results[i].title, url: json.results[i].url, image: null }
    for (var j=0; j<json.results[i].multimedia.length; j++)
    {
      if (json.results[i].multimedia[j].type == "image" && json.results[i].multimedia[j].format == "superJumbo")
      {
        var image = { caption: json.results[i].multimedia[j].caption, url: json.results[i].multimedia[j].url, copyright: json.results[i].multimedia[j].copyright, articleUrl: json.results[i].url, articleTitle: json.results[i].title };
        item.image = image;
      }
    }
    if (item.image !== null)
    {
      images.push(image);
    }
  }

  return images;
}
exports.updateTrendingImages = function(session, cb)
{
	if (cache.trending === undefined) cache.trending = { };
	if (cache.trending.images === undefined) cache.trending.images = { status: 500, error: null, images: [ ] };
	if ((cache.trending.images.time === undefined) || (cache.trending.images.time.diff(time(new Date()), 'seconds') <= (-60 * 30))) {
    cache.trending.images.time = time(new Date());
    console.log("Updating trending images...");

	  request('https://api.nytimes.com/svc/topstories/v2/home.json?apikey=***REMOVED***', function(error, response, body1) {
	    if (error || response.statusCode != 200) {
				cache.trending.images.status = 500;
				cache.trending.images.error = error;
	      console.error(error);
				cb();
	    }
	    else {
	      var json1 = JSON.parse(body1);
				cache.trending.copyright = json1.copyright;
				cache.trending.images.images = [ ];
	      var im1 = parseTrendingImages(json1);

	      request('https://api.nytimes.com/svc/topstories/v2/world.json?apikey=***REMOVED***', function(error, response, body2) {
	        if (error || response.statusCode != 200) {
						cache.trending.images.status = 500;
						cache.trending.images.error = error;
			      console.error(error);
						cb();
	        }
	        else {
	          var json2 = JSON.parse(body2);
	          var im2 = parseTrendingImages(json2);

	          request('https://api.nytimes.com/svc/topstories/v2/national.json?apikey=***REMOVED***', function(error, response, body3) {
	            if (error || response.statusCode != 200) {
								cache.trending.images.status = 500;
								cache.trending.images.error = error;
					      console.error(error);
								cb();
	            }
	            else {
	              json3 = JSON.parse(body3);
	              var im3 = parseTrendingImages(json3);
	              var images = im1.concat(im2).concat(im3);
								cache.trending.images.images = images;
                cache.trending.images.error = undefined;
                cache.trending.images.status = 200;
								cb();
	            }
	          });
	        }
	      });
	    }
	  });
	}
	else {
		cb();
	}
}

exports.updateStatsString = function(session, cb)
{
  if (cache.stats === undefined) cache.stats = { };
	if (cache.stats.string === undefined) cache.stats.string = { status: 500, error: null, statString: "" };
	if ((cache.stats.string.time === undefined) || (cache.stats.string.time.diff(time(new Date()), 'seconds') <= (-60 * 30))) {
    cache.stats.string.time = time(new Date());
    console.log("Updating stats string...");

    request('http://eventregistry.org/jsonCache/overview?action=getRecentStats&maxCacheAge=10', function(error, response, body) {
      if (error || response.statusCode != 200) {
        cache.stats.string.status = 500;
        cache.stats.string.error = error;
        console.error(error);
        cb();
      }
      else {
        var json = JSON.parse(body);
        var string = "Searching <strong>" + util.addCommas(json.totalArticleCount) + "</strong> articles from <strong>" + util.addCommas(json.totalSourceCount) + "</strong> news sources";
        cache.stats.string.statString = string;
        cache.stats.string.error = undefined;
        cache.stats.string.status = 200;
        cb();
      }
    });
  }
  else {
    cb();
  }
}
