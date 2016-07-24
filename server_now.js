var request = require('request');

exports.getEvents = function(session, conceptUri, cb)
{
  request('http://eventregistry.org/json/event?action=getEvents&resultType=events&dateStart=2016-07-09&dateEnd=2016-07-23&eventsConceptLang=eng&eventsCount=200&eventsEventImageCount=1&eventsIncludeEventSocialScore=true&conceptUri=' + categoryUri + '&eventsSortBy=rel&eventsPage=1', { jar: session }, function(error, response, body) {
    var out = { status: 500, error: undefined, events: [ ]};
    if (error || response.statusCode != 200) {
      console.error(body);
      console.error(error);
      out.status = 500;
      out.error = error;
      if (!error) out.error = response.body;
      cb(out);
    }
    else {
      var json = JSON.parse(body);
      console.log(json);

      //Return
      out.status = 200;
      cb(out);
    }
  });
}
