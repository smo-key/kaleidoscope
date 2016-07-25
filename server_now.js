var request = require('request');
var async = require('async');
var moment = require('moment');

exports.getEvents = function(session, conceptUri, lang, cb)
{
  //&dateStart=2016-07-09 <- for recent hits only
  /**For the most part, getting first 50 articles by relevance is pretty good - however, for larger items, also get the most *recent* articles **/
  request('http://eventregistry.org/json/event?action=getEvents&resultType=events&eventsConceptLang=eng&eventsCount=50&eventsEventImageCount=1&minArticlesInEvent=10&eventsIncludeEventSocialScore=true&conceptUri=' + conceptUri + '&eventsSortBy=rel&eventsPage=1', { jar: session }, function(error, response, body) {
    var out = { status: 500, error: undefined, events: [ ]};
    if (error || JSON.parse(body).error !== undefined) {
      console.error(body);
      console.error(error);
      out.status = 500;
      out.error = error;
      if (!error) out.error = JSON.parse(body).error;
      cb(out);
    }
    else {
      var json = JSON.parse(body);
      out.page = json.events.page;
      out.pages = json.events.pages;
      out.count = json.events.totalResults;
      out.events = [ ];
      // out.events = json.events.results;

      console.log("Analyzing events...");
      // console.log(json.events.results);

      //Rate each event and append to array
      var maxRelevance = json.events.results[0].wgt;
      async.eachLimit(json.events.results, 8, function(event, asynccb)
      {
        //Get metadata
        if (event.warning === undefined)
        {
          var eventout = { };
          eventout.uri = event.uri;
          eventout.title = event.title[lang] || event.title["eng"] || null;
          if (event.location === undefined || event.location == null || event.location.length == 0) { eventout.location = "" }
          else {
            eventout.location = event.location.label[lang] || event.location.label["eng"] || "";
            if (event.location.country !== undefined) eventout.location += ", " + (event.location.country.label[lang] || event.location.country.label["eng"] || "");
          }
          eventout.time = moment(event.eventDate, "YYYY-MM-DD").fromNow();
          eventout.image = event.images[0] || null;

          //Parse summary
          eventout.summary = event.summary[lang] || event.summary["eng"] || null;
          eventout.summaryShort = eventout.summary != null ? eventout.summary.match(/^.+?\.|^.*/)[0] : null;
          if ((eventout.summaryShort != null) && (eventout.summaryShort.length > 400))
          {
            eventout.summaryShort = eventout.summaryShort.match(/^.{0,400}\b/)[0].trim();
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
          var timeDiffHours = moment(new Date()).diff(moment(event.eventDate), 'hours');
          var recencyFactor = 10.2273515 / ((timeDiffHours)^(0.5494897));
          var relevanceFactor = searchRelevance / maxRelevance;
          var socialFactor = 0.01772985 * ((socialScore)^(0.787861));
          var newsFactor = 0.01772985 * ((eventout.articlesLang)^(0.787861));

          eventout.hotness = Math.ceil(25 * recencyFactor * (socialFactor + newsFactor));
          eventout.relevance = eventout.hotness * relevanceFactor;
          console.log("SocBase: " + socialScore + " Time: " + recencyFactor + " Soc: " + socialFactor + " News: " + newsFactor +  " SocF: " + socialFactor + " Score: " + eventout.relevance);

          if (eventout.summary == null || eventout.relevance == 0 || eventout.title == null)
          {
            asynccb();
          }
          else {
            out.events.push(eventout);
            asynccb();
          }
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
