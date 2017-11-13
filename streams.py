#!/usr/bin/env python34

# Author: Kip Turk
# Last Modified: Oct/05/2017
# Purpose: Take webpage input, query a database, scrape relevant websites and return
#          useful output to the web
# To-do: Some code clean-up would be nice, but I have determined that the synchronous
#        method of scraping websites makes this version slower than I would like. For 
#        now, I am calling this version finalized and moving to Node.js for asynch
#        scrapes. Otherwise, notes are marked TO-DO throughout.

import flask
import requests
from bs4 import BeautifulSoup as soup
import pandas as frame
import mysql.connector as sql
import urllib.request
import re
from dbsec import mysql as cfg

app = flask.Flask(__name__)

''' Simple flask setup to pull county meter nodes and scrape the state site '''
@app.route('/stream_data', methods=['GET', 'POST'])
def index():
    def inner():
        ''' Initialize some basic variables '''
        header = '<html><title>Colorado Stream Data</title><body><h4>Stream Flow Data</hr>'
        footer = '</body></html>'
        content = ''
        black = "color: black;"
        ''' Pull the county value from the form and clean quotes up if necessary '''
        mycty = flask.request.args['county']
        mycty = urllib.request.unquote(mycty)
        try:
            ''' Make the db connection and set up the cursor '''
            cnx = sql.MySQLConnection(user=cfg['user'], password=cfg['pass'], 
                                      host=cfg['host'], database=cfg['db'])
            cursor = cnx.cursor()
            ''' Drop the _County portion of mycty, convert to all upper and swap _ to space '''
            mycty = cnx.converter.escape(mycty)[:-7].upper()
            mycty.replace("_", " ")
            #print(mycty)            
            ''' Build and execute the query on mycty. Note no quotes on %s and execute expects a tuple of values '''
            query = ('''select county, state, station, abbrev, usgsid, latitude, longitude 
                from stations where county = %s''')
            cursor.execute(query, (mycty, ))
            rows = cursor.fetchall()
            ''' Next 2 prints are very useful for debugging if results aren't as expected '''
            #print(cursor.statement)
            #print(rows)
            ''' some counties actually have no records to pull since I focused on specific meter types/sources when I populated the database. Provide some output anyway. '''
            if not rows:
                content = "<br \>No results found for %s county." % mycty
            ''' iterate over the results of the cursor.fetchall '''
            for (county, state, station, abbrev, usgsid, latitude, longitude) in rows:
                ''' good is a simple toggle to determine whether to append valid data or ignore useless results '''
                good = 1
                ''' the Colorado state water graph site to scrape'''
                site = 'http://www.dwr.state.co.us/SurfaceWater/data/detail_graph.aspx?ID=' + abbrev + '&MTYPE=DISCHRG'
                ''' useful print for debugging if you need to access the site manually for validation of results '''
                #print(site)
                ''' Scrape the site and parse the results '''
                page = requests.get(site)
                html = soup(page.content, 'html.parser')
                ''' not sure if this try is needed but whatevs '''
                # TO-DO: validate and clean this up
                try:
                    ''' recent and height are the 2 values we're interested in from the page, handily found by specific id '''
                    recent = html.find(id='ctl00_ContentPlaceHolder1_recentvaluelabel').get_text()
                    height = html.find(id='ctl00_ContentPlaceHolder1_gagehtlabel').get_text()
                    ''' This is pretty ugly and should be cleaned up if I stick with the python version. Tests to validate the results of height and recent, then add some style changes or skip concating the results to content if useless. '''
                    # TO-DO: clean this up
                    if height is None or not height or height.isalpha() or height == "N/A":
                        style = "color: grey;"
                        height = "No data found"
                        good = 0
                    elif float(height.split()[0]) < 0.75:
                        style = "color: black;"
                    elif float(height.split()[0]) > 2.5:
                        style = "color: red;"
                    else:
                        style = "color: green;"
                    if recent is None or not recent:
                        style = "color: grey;"
                        recent = "No data found"
                        good = 0
                    ''' If we liked the results, concat our values into an HTML formated string.  This code should be made more legible for posterity. '''
                    # TO-DO: format this better so the coder can follow it
                    if good == 1:
                        content += "<div style=\"%s\">%s<br \><a href=\"%s\">%s</a> - %s, %s<br \>%s, %s</div>" % (black, station.title(), site, abbrev, county, state, latitude, longitude)
                        content += "<div style=\"%s\">%s<br \>Gauge Height: %s<br \><br \></div>" % (style, recent, height)
                except AttributeError as e:
                    ''' Yeah, that try up there doesn't actually get anything done in the exception.  Tacky attempt at a workaround that should be cleaned up. '''
                    continue
            ''' Tack an EOR on content. In case we didn't find any good options, this provides an indication that processing is complete and not just hung up. '''
            content += "<div style='color: grey'>End of results</div>"                  
            output = header + content + footer
            ''' Fold our content into HTML header and footer strings, then return and close our connection '''
            return output
            cursor.close()
            cnx.close()
        except sql.Error as err:
            print("Could not access the database. - ", err)

    return flask.Response(inner(), mimetype='text/html')

app.run(debug=True, port=8000, host='0.0.0.0')
