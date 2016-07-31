const getColors = require("get-image-colors");
var fs = require('fs'),
		async = require('async'),
		path = require('path'),
    request = require('request');

/** UTILITIES (ELECTRICITY, ETC.)**/
var download = function(uri, filename, callback){
  request.head(uri, function(err, res, body){
    console.log('content-type:', res.headers['content-type']);
    console.log('content-length:', res.headers['content-length']);

    request(uri).pipe(fs.createWriteStream(filename)).on('close', callback);
  });
};

//Add commas for numerical strings
exports.addCommas = function(nStr)
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

exports.getImageColor = function(url, cb)
{
	var filename = __dirname + 'temp' + path.extname(url);
	download(url, filename, (err) => {
		if (err)
		{
			console.warn("Could not download image");
			cb("Could not download image.", null);
		} else {
			getColors(filename, (err, colors) => {

				var color = undefined;
				async.detect(colors, function(color, callback) {
					if (color.get("hsl.s") > 0.3)
					{
						callback(null, true);
					}
					else {
						callback(null, false);
					}
				}, function(err, color) {
					if (color)
					{
						color.set("hsl.s", 1);
						color.set("hsl.l", 0.5);
						cb(null, { color: color.hex() });
					}
					else {
						console.warn("No suitable color found");
						cb("No suitable color found!", null);
					}
				});

				fs.unlink(filename, (err) => {
					if (err) console.error("Could not remove file!");
				});
			})
		}
	});
}
