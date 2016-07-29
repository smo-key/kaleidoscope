var request = require('request');
var async = require('async');
var moment = require('moment');
var textExtractor = require('unfluff');
var _ = require('lodash');

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
  var result = { };
  result.url = article.url;
  result.title = article.title;
  result.sourceTitle = article.source.title;
  result.sourceUrl = article.source.uri;
  result.date = article.date + " " + article.time;
  result.relevance = article.sim;

  //2. Download article
  var session = request.jar();
  request.get(result.url, { jar: session }, function(error, response, body) {
    if (error || response.statusCode != 200) {
      console.log("ERROR: " + (error || response.statusCode || "Unknown!") + " " + result.url);
      cb(null, null);
    }
    else {
      // console.log("Extracting text from article...");
      //3. Scrape article for text
      data = textExtractor.lazy(body, 'en');
      text = data.text();
      // console.log(text);

      //4. Send text to Python server


      //5. Return analysis data
      result.text = text;
      cb(null, result);
    }
  });
}

exports.analyzeEvent = function(session, eventUri, lang, cb)
{
  const maxEventCount = 400;
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
              //De-dup based on article URLs
              var uniqueArticles = _.uniqBy(articles, 'url');

              //Start mass analysis of all sources
              console.log("Starting download of " + uniqueArticles.length + " articles...");
              async.mapLimit(uniqueArticles, 32, function(article, callback) {
                analyzeArticle(article, function(err, processed)
                {
                  callback(err, processed);
                });
              }, function(err, processedArticles) {
                if (err != null) {
                  cb(err, null);
                }
                else {
                  //Sort articles by time and remove null entries
                  async.filter(processedArticles, function(article, callback) {
                    callback(null, article != null);
                  }, function(err, articles)
                  {
                    var sortedArticles = articles.sort(function(e1, e2) {
                      return moment(e1.date).diff(moment(e2.date), 'days', true);
                    });

                    //Return articles
                    console.log("Done processing articles!")
                    cb(null, sortedArticles);
                  });
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
