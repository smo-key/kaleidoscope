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

app.get('/api/1/suggest/trending', function(req, res) {
  request('http://eventregistry.org/jsonCache/trends?action=getConceptTrendGroups&conceptType=org&conceptType=person&conceptType=loc&conceptCount=5&conceptIncludeConceptImage=false&conceptIncludeConceptTrendingHistory=false&conceptLang=eng&maxCacheAge=1&source=news&type=concept', function(error, response, body) {
    if (debug) res.header("Access-Control-Allow-Origin", "http://localhost:8000");
    if (error || response.statusCode != 200) {
      res.status(500).json({ error: error });
      console.error(error);
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

/** LISTEN **/
app.listen(8001, function () {
  console.log('Listening on port 8001!');
});
