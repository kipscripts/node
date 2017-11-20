The default csv file from [the Colorado Data site](https://data.colorado.gov/) was not exactly friendly for a database load. Some counties contained spaces (ie. El Paso) and the space needed to be translated to an underscore to match valid ID naming conventions in HTML. Also, some station names contained commas within the text, making for inconsistent results using the comma as the intended field separator. And finally, the lat/long coordinates were also wrapped in quotes and parentheses.

To clean up DWR_Surface_Water_Stations.csv, I just passed the file through awk for an ETL.

```bash
awk -F ',' ' { if ($3 ~ / /) { split($3, parts, " "); county=parts[1]"_"parts[2]; } else  
{ county=$3 } if ($5 ~ /"/) { split($0, a, "\""); station=a[2]; split(a[3], b, ",");  
abbrev=b[2]; usgsid=b[3]; } else { station=$5; abbrev=$6; usgsid=$7; } lat=substr($(NF-1), 3);  
long=substr($NF, 1, length($NF)-2); if (abbrev=="") { next; } else { printf "%d|%d|%s|%s|%s|%s|%d|%f|%f\n",  
$1, $2, county, $4, station, abbrev, usgsid, lat, long } } ' DWR_Surface_Water_Stations.csv > useful.txt
```

*Explained:*  
**awk -F ','** - Use the comma as the field separator as expected for a .csv  
**if ($3 ~ / /)** - Check to see if the county name contains a space using ~ to match the expression in / /, a single space  
**{ split($3, parts, " "); ... }** - If so, split into array parts and recombine joined by an underscore.  If not, set county as $3

**if ($5 ~ /"/)** - Another match looking for a double quote in the Station Name field  
**{ split($0, a, "\""); ... }** - If so, split the entire line ($0) into array a on each double quote. Set the station name to a[2] as a[1] holds the fields prior to the first double quote. a[3] would hold all the fields to the next quote, so we split that on the comma again into array b. At this point, we consistently have the abbreviation in b[2] and the usgsid in b[3]. And of course, should this line not contain a double quote in the name, just set our expected fields from the .csv.

**lat=substr($(NF-1), 3);** - Split on commas, the latitude is the next to the last field $(NF-1). Since the string starts with a double quote and paren, we use substring to start at the 3rd character.

**long=substr($NF, 1, length($NF)-2);** - Finally, the longitude is the final field $NF. Since the string ends with a paren and double quote, we substring from the first character up til 2 short of the string length.

**if (abbrev=="") { next; }** - If the abbreviation field is empty, skip this line.  
**else { printf "%d|%d|%s|%s|%s|%s|%d|%f|%f\n", ... }** - Otherwise print the fields delimited by | using digit (%d), string (%s) and float (%f) placeholders as a sanity check to ensure we had the proper data.  
**DWR_Surface_Water_Stations.csv > useful.txt** - Read the .csv file and direct the print output to useful.txt

At that point, simply copy the useful.txt file to the DB server and use  
```LOAD DATA INFILE '/file/location/useful.txt' INTO TABLE tablename FIELDS TERMINATED BY '|';```
