var Promise = require('bluebird');  // Promises for async calls
var path = require('path');  // filesystem path to return app.get
var express = require('express');  // the webserver listener
var app = express();  // utilizing the webserver
var sprintf = require('sprintf-js').vsprintf;
//var json2html = require('node-json2html');

/* The trick to bodyParser is that it only looks at the relevant
Content-Type. Everything else is silently dropped. In this case,
colorado-svg.html needed the Content-Type=application/json header. 
Other options were valid, but this provides simple access for 
future enhancements. */
var bodyParser = require('body-parser');
app.use(bodyParser.json({ strict: false }));

/* POST takes a straight forward JSON input from colorado-svg.html,
queries the local MySQL DB for county info, then scrapes the relevant
site pages for water flow details and returns it back to 
colorado-svg.html for post-processing */
app.post('/loadout/scrapes', function (req, res) {
    var start = process.hrtime();
    var clicked = req.body.county;
    if (!clicked)  { console.log("Failed!"); res.end("Got nothing..."); }
    else {
        var content = '';     
        //console.log("clicked is " + clicked);
        dbQuery(clicked).then(function(result1)  {
            //result1 here should be the DB rows returned
            // console.log("got: ", result1);

            /* Basic check here to ensure the county had results to
            query.  If not, build an empty result and return.  Pass any
            result rows to scrapeIt for async page scrapes. */
            if (result1.length == 0)   {
                //var buildIt = { 'results': 'empty' };
                var buildIt = ["<tr><td colspan=5 align=center> No results found. </td><tr>"];
                return buildIt;
            } else  { return scrapeIt(result1); }
        }).then(function(results)   {
            /* results here should contain the JSON array of formatted
            page scrape data combined with DB data per result1 */
            //console.log("returning: ", results);
            /* Didn't like the tableify format so I'm building it manually */
            var output = "<table><tr><th class='" + clicked + "'>Station</th><th class='recent'>Recent</th><th class='height'>Height</th><th class='latitude'>Lat.</th><th class='longitude'>Long.</th></tr>";
            if (results.length == 1)    {
                output += results;
                var counter = "0";
            } else  {
                //console.log(results.length);
                var counter = results.pop();
                for (var line in results)   {
                    output += results[line];
                }                
            }
            var timer = process.hrtime(start);
            //console.log("Time: ", timer[1]/1000000);
            var s = timer[0];
            var ms = timer[1]/1000000;
            //console.log(s + 's ' + ms + 'ms');
            output += '</table><p><div id="stats">Scraped ' + counter + ' sites in ' + s + 's ' + ms + 'ms.</div>';
            //console.log(output);
            res.end(output);
        });
    }
});

/* stupid simple GET to show the index page. By using this function
with the NGINX proxy for HTTPS to this app, we avoid CORS and 
HTTPS/HTTP contamination issues.  */
app.get('/loadout', function(req, res) {
    res.sendFile(path.join(__dirname + '/index.html'));
});

app.get('/loadout/colorado.svg', function(req, res) {
    res.sendFile(path.join(__dirname + '/colorado.svg'));
});

app.get('/loadout/tooltip.svg', function(req, res) {
    res.sendFile(path.join(__dirname + '/tooltip.svg'));
});

/* stupid simple GET to show the SVG page. By using this function
with the NGINX proxy for HTTPS to this app, we avoid CORS and 
HTTPS/HTTP contamination issues.  */
app.get('/loadout/svg', function(req, res) {
    res.sendFile(path.join(__dirname + '/colorado-svg.html'));
});

/* Hard code the listener to the localhost IP so NGINX can proxy 
HTTPS to this service.*/
var server = app.listen(8080, '127.0.0.1', function()    {
    console.log("Listening on port %s:%s", server.address().address, server.address().port);
});

/* dbQuery takes the ID of the clicked polygon from colorado-svg.html
and converts it to match the county column format in the MySQL DB. Then
it returns the matching county rows and the data is passed to scrapeIt
for async page scrapes to collect the live data desired. */
function dbQuery(county)    {
    var rows;
    // Promisify the MySQL query
    var mysql = require('promise-mysql');
    /* DB access details are held externally, but consist of
    host, user, password, database in a JSON array */
    var db = require('./dbsec');  // db contains the brackets already
    if (county) { 
        county = county.slice(0, -7).toUpperCase(); 
        // console.log(county); 
    }
    queryString = "select county, state, station, abbrev, usgsid, latitude, longitude from stations where county = " + mysql.escape(county); 
    return mysql.createConnection(db).then(function(conn)  {
        cnx = conn;
        var rows = cnx.query(queryString);
        cnx.end();
        /* Just for posterity, you can't actually see rows.length here
        and that is why we have the subsequent .then block. The code
        functions without that block, but I prefer the visibility for 
        future troubleshooting. */
        // console.log("num: ", rows.length);
        return rows;
    }).then(function(rows)   {
        /* only needed for debugging */
        // console.log("num: ", rows.length);
        return rows;
    }).catch(function(error)  {
        console.log("Error was " + error);
        /* burned too many hours debugging valid code when the issue was
        actually a problem with the query string. Left for posterity. */
        //console.log("string is " + queryString);
        if (cnx && cnx.end) cnx.end();  // close the DB connection if we failed
    });
}

/* The most interesting function takes the resulting rows pertinent to the 
selected county that were queried from the MySQL database, makes a promisory
map across them and scrapes the state waterflow pages for the latest activity,
concatenates each scrape result into a single block and returns it for output
back at colorado-svg.html */
function scrapeIt(rows, output)   {
    // Promisify request for async page scrapes
    var request = require("request-promise");
    // the page parser
    var cheerio = require('cheerio');
    var buildIt = [];
    //onsole.log("rows: ", rows.length);
    /* The return here creates the promise for the call to scrapeIt in app.post */
    return new Promise(function (resolve, reject)   {
        /* async iteration over the returned DB rows via Promise.map */
        new Promise.map(rows, function(item)  {
            var page = 'http://www.dwr.state.co.us/SurfaceWater/data/detail_graph.aspx?ID=' + item.abbrev + '&MTYPE=DISCHRG';
            /* left for debugging purposes */
            //console.log(item.abbrev);
            /* set up the request options for async scrapes */
            var options = {
                uri: page,
                transform: function(body)   {
                    return cheerio.load(body);
                }
            };
            /* async scraping pages, picking out desired IDs. Note the # inf front of
            the ID names */
            return request(options).then(function($)   {
                /* these 3 are pulled live from the state page */
                var station = $('#ctl00_ContentPlaceHolder1_stationname').text(); 
                var recent = $('#ctl00_ContentPlaceHolder1_recentvaluelabel').text();
                var height = $('#ctl00_ContentPlaceHolder1_gagehtlabel').text();
                /* these 2 are loaded from the database */
                var latitude = item.latitude;
                var longitude = item.longitude;
                /* build a JSON of data & concat it to a single block */
                //content = [{ 'station': station, 'page': page, 'recent': recent, 'height': height, 'latitude': latitude, 'longitude': longitude }];
                /* switching to manual HTML output over JSON */
                //console.log(parseFloat(height));
                if(!isNaN(parseFloat(height)))  {
                    if (parseInt(height) >= 2.1) {
                        var color = "red";
                    } else if (parseFloat(height) <= 0.75) {
                        var color = "black";
                    } else  {
                        var color = "green";
                    }
                    content = sprintf('<tr><td class="station"><a href="%s">%s</a></td><td class="recent" color="%s">%s</td><td class="height" color="%s">%s</td><td class="latitude">%s</td><td class="longitude">%s</td></tr>', [page, station, color, recent, color, height, latitude, longitude]);
                    buildIt = buildIt.concat(content);
                } else  {
                    content = sprintf('<tr><td class="station"><a href="%s">%s</a></td><td class="recent">%s</td><td class="height">%s</td><td class="latitude">%s</td><td class="longitude">%s</td></tr>', [page, station, recent, height, latitude, longitude]);
                    buildIt = buildIt.concat(content);
                }
                //console.log(buildIt.length);
                return buildIt;
            }).then(function()   {
                /* this block returns the final version of buildIt */
                return buildIt;
            }).catch(function (err) {
                /* catch 404s specifically, then other scrape errors */
                if (err.statusCode == 404)  {
                    console.log("Bad site: ", page)
                } else  {
                    console.log("Error was: ", err);
                }
            });
        }).then(function()  {
            /* debugging data to ensure we scraped every row */
            //console.log("outer: ", buildIt.length);
            buildIt = buildIt.concat(buildIt.length)
            /* resolve the main Promise and return to app.post */
            resolve(buildIt);
        });
    });
};
