var request = require('request');
var async = require('async');

exports.startAnalyzeEvent = function(session, eventId, lang)
{

}

getArticles = function(session, eventUri, lang, page, cb)
{
  request('http://eventregistry.org/json/event?eventUri=' + eventUri + '&action=getEvent&resultType=articles&articlesLang=' + lang + '&articlesSortBy=socialScore&articlesCount=200&articlesIncludeArticleImage=false&articlesIncludeArticleSocialScore=false&articlesPage=' + page, { jar: session }, function(error, response, body) { //sortBy=cosSim
    if (error || response.statusCode != 200) {
      console.error(body);
      console.error(error);
      cb(error, null);
    }
    else {
      var json = JSON.parse(body);
      console.log("GET Article List for event")
      console.log(json);
      console.log(json[eventUri].articles.results.length);
      cb(null, json[eventUri].articles);
    }
  });
}

analyzeArticle = function(article, cb)
{
  //1. Get metadata
  //2. Download article
  //3. Scrape article for text
  //4. Send text to Python server
  //5. Return analysis data

  cb(null, article);
}

exports.analyzeEvent = function(session, eventUri, lang, cb)
{
  const maxEventCount = 200;
  var totalPages = Math.floor(maxEventCount / 200);
  var pagesReceived = 0;

  //Get first event
  console.log("Starting event analysis...");
  getArticles(session, eventUri, lang, 1, function(err, json)
  {
    if (err != null) {
      cb(err, null);
    }
    else
    {
      var articles = json.results;
      totalPages = Math.floor(Math.min(maxEventCount, json.totalResults) / 200);
      pagesReceived++;
      async.doWhilst(function(callback) {
        if (pagesReceived < totalPages)
        {
          getArticles(session, eventUri, lang, ++pagesReceived, function(err, json)
          {
            callback(err, json.results);
          });
        } else {callback(null, [ ]); }
      }, function() { return pagesReceived < totalPages; }, function(err, results)
      {
        if (err != null) {
          cb(err, null);
        }
        else
        {
          //Concat all results
          console.log(articles.length);
          console.log("Concatenating results...");
          async.eachSeries(results, function(result, callback) {
            articles = articles.concat(result);
            callback(null);
          }, function(err) {
            if (err != null) {
              cb(err, null);
            }
            else
            {
              //Start mass analysis of all sources
              console.log("Starting mass download...");
              console.log(articles.length);
              async.mapLimit(articles, 32, function(article, callback) {
                analyzeArticle(article, function(err, processed)
                {
                  if (err == null)
                  {
                    callback(null, processed);
                  }
                  else {
                    callback(err, null);
                  }
                });
              }, function(err, processedArticles) {
                if (err != null) {
                  cb(err, null);
                }
                else {
                  console.log("Done processing articles!")
                  cb(null, processedArticles);
                }
              });
            }
          });
        }
      });
    }
  });
}

exports.getAnalysisStatus = function(eventUri)
{

}
