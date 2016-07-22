var express = require('express');
var app = express();
var request = require('request');

const debug = true;

/** UTILITIES (ELECTRICITY, ETC.)**/
function addCommas(nStr)
{
	nStr += '';
	x = nStr.split('.');
	x1 = x[0];
	x2 = x.length > 1 ? '.' + x[1] : '';
	var rgx = /(\d+)(\d{3})/;
	while (rgx.test(x1)) {
		x1 = x1.replace(rgx, '$1' + ',' + '$2');
	}
	return x1 + x2;
}

/** PUBLIC API **/
app.get('/api/1/stats/string', function(req, res) {
  request('http://eventregistry.org/jsonCache/overview?action=getRecentStats&maxCacheAge=10', function(error, response, body) {
    if (debug) res.header("Access-Control-Allow-Origin", "http://localhost:8000");
    if (error || response.statusCode != 200) {
      res.status(500).json({ error: error });
      console.error(error);
    }
    else {
      var json = JSON.parse(body);
      var string = "Searching <strong>" + addCommas(json.totalArticleCount) + "</strong> articles from <strong>" + addCommas(json.totalSourceCount) + "</strong> news sources";
      var out = { statString: string };
      res.status(200).json(out);
    }
  });
});

app.get('/api/1/trending/suggest', function(req, res) {
  request('http://eventregistry.org/jsonCache/trends?action=getConceptTrendGroups&conceptType=org&conceptType=person&conceptType=loc&conceptCount=5&conceptIncludeConceptImage=false&conceptIncludeConceptTrendingHistory=false&conceptLang=eng&maxCacheAge=1&source=news&type=concept', function(error, response, body) {
    if (debug) res.header("Access-Control-Allow-Origin", "http://localhost:8000");
    if (error || response.statusCode != 200) {
      console.error(error);
      res.status(500).json({ error: error });
    }
    else {
      var json = JSON.parse(body);
      var out = { list: [ ] };
      for (var i=0; i<json.person.trendingConcepts.length; i++)
      {
        out.list.push(json.person.trendingConcepts[i].label.eng);
        out.list.push(json.org.trendingConcepts[i].label.eng);
        out.list.push(json.loc.trendingConcepts[i].label.eng);
      }
      res.status(200).json(out);
    }
  });
});


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
app.get('/api/1/trending/images', function(req, res) {
  request('https://api.nytimes.com/svc/topstories/v2/home.json?apikey=***REMOVED***', function(error, response, body1) {
    if (debug) res.header("Access-Control-Allow-Origin", "http://localhost:8000");
    if (error || response.statusCode != 200) {
      res.status(500).json({ error: error });
      console.error(error);
    }
    else {
      var json1 = JSON.parse(body1);
      var out = { copyright: json1.copyright, images: [ ] };
      var im1 = parseTrendingImages(json1, out);

      request('https://api.nytimes.com/svc/topstories/v2/world.json?apikey=***REMOVED***', function(error, response, body2) {
        if (error || response.statusCode != 200) {
          res.status(500).json({ error: error });
          console.error(error);
        }
        else {
          var json2 = JSON.parse(body2);
          var im2 = parseTrendingImages(json2, out);

          request('https://api.nytimes.com/svc/topstories/v2/opinion.json?apikey=***REMOVED***', function(error, response, body3) {
            if (error || response.statusCode != 200) {
              res.status(500).json({ error: error });
              console.error(error);
            }
            else {
              json3 = JSON.parse(body3);
              var im3 = parseTrendingImages(json3, out);
              var images = im1.concat(im2).concat(im3);
              out.images = images;
              res.status(200).json(out);
            }
          });
        }
      });
    }
  });
});

/** LISTEN **/
app.listen(8001, function () {
  console.log('Listening on port 8001!');
});
