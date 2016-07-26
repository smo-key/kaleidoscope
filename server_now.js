var request = require('request');
var async = require('async');
var moment = require('moment');

function parseSummary(summary, cb)
{
  if (summary != null)
  {
    var summaryMatches = summary.split('.');
    var summaryShort = "";
    if (summaryMatches.length >= 1)
    {
      for (var i=0; i<summaryMatches.length; i++)
      {
        //If the last word in the match starts with a capital letter and is less than 5 letters in length (Miss., etc.) or the result is too short, add another element
        var match = summaryMatches[i];
        var matchWords = match.split(' ');
        if (match.length + summaryShort.length < 120)
        {
          summaryShort += match + ".";
        }
        else if (/[A-Z][A-Za-z]{0,3}\b/.test(matchWords[matchWords.length - 1]))
        {
          summaryShort += match + ".";
        }
        else if (match.length < 2) {
          //Must be '...'
          summaryShort += match + ".";
        }
        else {
          summaryShort += match + ".";
          break;
        }
      }
      cb(summaryShort);
    }
    else {
      cb(summary);
    }
  } else { cb(summaryShort); }
}

exports.getEvents = function(session, conceptUri, lang, cb)
{
  //&dateStart=2016-07-09 <- for recent hits only
  /**For the most part, getting first 50 articles by relevance is pretty good - however, for larger items, also get the most *recent* articles **/
  async.parallel([
    function(callback) {
      request('http://eventregistry.org/json/event?action=getEvents&resultType=events&eventsConceptLang=eng&eventsCount=100&eventsEventImageCount=1&minArticlesInEvent=10&eventsIncludeEventSocialScore=true&conceptUri=' + conceptUri + '&eventsSortBy=rel&eventsPage=1', { jar: session }, function(error, response, body) {
        if (error) callback(error, [ ]);
        else if (JSON.parse(body).error !== undefined) {
          callback(null, [ ]);
        } else {
          var json = JSON.parse(body);
          callback(null, json.events.results);
        }
      });
    },
    function(callback) {
      request('http://eventregistry.org/json/event?action=getEvents&resultType=events&eventsConceptLang=eng&eventsCount=100&eventsEventImageCount=1&minArticlesInEvent=10&eventsIncludeEventSocialScore=true&conceptUri=' + conceptUri + '&eventsSortBy=date&eventsPage=1', { jar: session }, function(error, response, body) {
        if (error) callback(error, [ ]);
        else if (JSON.parse(body).error !== undefined) {
          callback(null, [ ]);
        } else {
          var json = JSON.parse(body);
          callback(null, json.events.results);
        }
      });
    }
  ], function(err, r)
  {
    var out = { status: err == null ? 500 : 200, error: err, events: [ ]};
    if (err)
    {
      return cb(out);
    }
    else {
      console.log("Analyzing events...");

      //De-dup
      var combined = r[0].concat(r[1]);
      var results = combined.filter(function(elem, index, self) {
        return index == self.indexOf(elem);
      });

      //Rate each event and append to array
      var maxRelevance = results[0].wgt;
      async.eachLimit(results, 8, function(event, asynccb)
      {
        //Get metadata
        if (event.warning === undefined)
        {
          var eventout = { };
          eventout.uri = event.uri;
          eventout.title = event.title[lang] || event.title["eng"] || null;
          eventout.time = moment(event.eventDate, "YYYY-MM-DD").fromNow();
          if (eventout.time.indexOf("in") > -1) eventout.time = "just now";
          if (eventout.time.indexOf("hours ago") > -1) eventout.time = "today";
          eventout.image = event.images[0] || null;

          //Location simplification
          if (event.location === undefined || event.location == null || event.location.length == 0) { eventout.location = "" }
          else {
            eventout.location = event.location.label[lang] || event.location.label["eng"] || "";
            if (event.location.country !== undefined && event.location.country != null) eventout.location += ", " + (event.location.country.label[lang] || event.location.country.label["eng"] || "");
            var matches = eventout.location.split(/\s*,\s*/);
            if (matches.length > 2)
            {
              eventout.location = matches[0].trim() + ", " + matches[1].trim();
            }
          }

          //Parse summary
          eventout.summary = event.summary[lang] || event.summary["eng"] || null;
          parseSummary(eventout.summary, function(summaryShort)
          {
            eventout.summaryShort = summaryShort;

            if ((eventout.summaryShort != null) && (eventout.summaryShort.length > 250))
            {
              eventout.summaryShort = eventout.summaryShort.match(/^.{0,250}\b/)[0].trim();
              eventout.summaryShort += "...";
            }

            //Get article counts
            eventout.articlesTotal = 0;
            eventout.articlesLang = event.articleCounts[lang] || event.articleCounts["eng"] || 0;
            eventout.languages = event.articleCounts.length;
            for(key in event.articleCounts) {
              if(event.articleCounts.hasOwnProperty(key)) {
                eventout.articlesTotal += event.articleCounts[key];
              }
            }

            //Calculate overall hotness
            var searchRelevance = event.wgt;
            var socialScore = event.socialScore;
            var timeDiffDays = Math.ceil(moment(new Date()).diff(moment(event.eventDate), 'days', true));
            if (timeDiffDays < 0.1) { timeDiffDays = 0.1; }
            var recencyFactor = 4.92679 / ((timeDiffDays)^(0.432481));
            if (recencyFactor > 50 || recencyFactor < 0) { recencyFactor = 50; }
            var relevanceFactor = (searchRelevance / maxRelevance)^4;
            var socialFactor = 0.017729 * ((socialScore)^(0.787861));
            var newsFactor = 0.017729 * ((eventout.articlesTotal)^(0.787861));

            eventout.hotness = (Math.log10(recencyFactor * (socialFactor * newsFactor))*(100/2.5)) + 3;
            eventout.relevance = eventout.hotness * relevanceFactor;
            eventout.hotness = Math.ceil(eventout.hotness);
            console.log("SocBase: " + socialScore + " Time: " + recencyFactor + " Soc: " + socialFactor + " Articles: " + eventout.articlesTotal + " News: " + newsFactor +  " SocF: " + socialFactor + " Score: " + eventout.relevance);

            if (eventout.summary == null || eventout.relevance < 0.1 ||
               eventout.hotness < 0.1 || eventout.title == null)
            {
              asynccb();
            }
            else {
              out.events.push(eventout);
              asynccb();
            }
          });
        } else { asynccb(); }
      }, function (err) {
        console.log("Done analyzing events!");

        //Sort array
        out.events = out.events.sort(function(e1, e2) {
          return e2.relevance - e1.relevance;
        });

        //Return
        out.status = 200;
        cb(out);
      });
    }
  });
}
