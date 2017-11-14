# node
Use Node.JS and SVG graphics to select a Colorado county then scrape state sites for water levels

This project started with the python version, but I found it too slow since Python was sequentially scraping the .gov sites. As it was my introduction to Node.JS and asynchronous calls, I found that promises were simpler to process than callbacks.  This is a fullstack project built on the AWS Amazon AMI with nginx handling SSL and proxying to the Express app managed as a service by pm2.  The local MySQL database of relevant sites was culled from the [DWR Surface Water Stations dataset](https://data.colorado.gov/Water/DWR-Surface-Water-Stations/ceb5-u3hr).  Main SVG taken from [Wiki Commons](https://commons.wikimedia.org/wiki/File:Map_of_Colorado_counties,_blank.svg) with an open copyright. Minor modifications made like removing spaces from id names and tweaking fill properties.  No changes were made to the map data. Current stats are pulled from [The Colorado Division of Water Resources](http://www.dwr.state.co.us/).  Returned data is displayed with a link to the relevant sites since DWR doesn't always provide results if provided by external sources.

TODO: I was wanting to scale the polygon on :hover, but the polygon path orders inconsistently led to image clipping so I need to do a thorough revamp of the colorado.svg to ensure consistent action.

TODO: Dependent on the ability to scale, I've toyed with the idea to mark the returned sites on the map since I have the lat/long.

TODO: Use the lat/long to scrape a weather site for the 5-day forecast.
