var request = require('request');

exports.getEvents = function(session, conceptUri, cb)
{
  request('http://eventregistry.org/json/event?action=getEvents&resultType=events&dateStart=2016-07-09&dateEnd=2016-07-23&eventsConceptLang=eng&eventsCount=200&eventsEventImageCount=1&eventsIncludeEventSocialScore=true&conceptUri=' + conceptUri + '&eventsSortBy=rel&eventsPage=1', { jar: session }, function(error, response, body) {
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
      out.events = json.events.results;
      out.page = json.events.page;
      out.pages = json.events.pages;
      out.count = json.events.totalResults;
      out.status = 200;
      cb(out);
    }
  });
}
