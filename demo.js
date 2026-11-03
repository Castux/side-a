// Sample albums for ?demo, so the app can be tried without a Tidal login.
// title | artist | year | genre
const RAW = `Kind of Blue|Miles Davis|1959|Jazz
In a Silent Way|Miles Davis|1969|Jazz
A Love Supreme|John Coltrane|1965|Jazz
Blue Train|John Coltrane|1958|Jazz
Moanin’|Art Blakey & the Jazz Messengers|1959|Jazz
Waltz for Debby|Bill Evans Trio|1962|Jazz
Journey in Satchidananda|Alice Coltrane|1971|Jazz
Getz/Gilberto|Stan Getz & João Gilberto|1964|Jazz
Promises|Floating Points, Pharoah Sanders & LSO|2021|Jazz
Kid A|Radiohead|2000|Alternative
In Rainbows|Radiohead|2007|Alternative
OK Computer|Radiohead|1997|Alternative
Spirit of Eden|Talk Talk|1988|Alternative
Boxer|The National|2007|Alternative
Funeral|Arcade Fire|2004|Alternative
Ágætis byrjun|Sigur Rós|1999|Alternative
Blue|Joni Mitchell|1971|Folk
Pink Moon|Nick Drake|1972|Folk
Carrie & Lowell|Sufjan Stevens|2015|Folk
For Emma, Forever Ago|Bon Iver|2007|Folk
Fleet Foxes|Fleet Foxes|2008|Folk
Dragon New Warm Mountain I Believe in You|Big Thief|2022|Folk
Discovery|Daft Punk|2001|Electronic
Random Access Memories|Daft Punk|2013|Electronic
Music Has the Right to Children|Boards of Canada|1998|Electronic
Selected Ambient Works 85–92|Aphex Twin|1992|Electronic
Immunity|Jon Hopkins|2013|Electronic
Since I Left You|The Avalanches|2000|Electronic
Sound of Silver|LCD Soundsystem|2007|Electronic
Swim|Caribou|2010|Electronic
Untrue|Burial|2007|Electronic
Rounds|Four Tet|2003|Electronic
Black Sands|Bonobo|2010|Electronic
Moon Safari|Air|1998|Electronic
Rumours|Fleetwood Mac|1977|Rock
Abbey Road|The Beatles|1969|Rock
Pet Sounds|The Beach Boys|1966|Rock
Remain in Light|Talking Heads|1980|Rock
Unknown Pleasures|Joy Division|1979|Rock
Disintegration|The Cure|1989|Rock
Loveless|My Bloody Valentine|1991|Rock
Heaven or Las Vegas|Cocteau Twins|1990|Rock
Teen Dream|Beach House|2010|Rock
Currents|Tame Impala|2015|Rock
Con Todo El Mundo|Khruangbin|2018|Rock
Mezzanine|Massive Attack|1998|Trip-hop
Dummy|Portishead|1994|Trip-hop
What’s Going On|Marvin Gaye|1971|Soul
Songs in the Key of Life|Stevie Wonder|1976|Soul
Voodoo|D’Angelo|2000|Soul
Blonde|Frank Ocean|2016|Soul
Pastel Blues|Nina Simone|1965|Soul
To Pimp a Butterfly|Kendrick Lamar|2015|Hip-hop
Madvillainy|Madvillain|2004|Hip-hop
The Low End Theory|A Tribe Called Quest|1991|Hip-hop
Donuts|J Dilla|2006|Hip-hop
Music for Airports|Brian Eno|1978|Ambient
Tabula Rasa|Arvo Pärt|1984|Classical
The Blue Notebooks|Max Richter|2004|Classical
Spaces|Nils Frahm|2013|Classical
Glassworks|Philip Glass|1982|Classical
Goldberg Variations (1981)|Glenn Gould|1982|Classical
Buena Vista Social Club|Buena Vista Social Club|1997|World
In the Heart of the Moon|Ali Farka Touré & Toumani Diabaté|2005|World
Éthiopiques Vol. 4|Mulatu Astatke|1998|World
Expensive Shit|Fela Kuti|1975|World`;

export const demoAlbums = () => RAW.split('\n').map((line, i) => {
  const [title, artist, year, genre] = line.split('|');
  return { id: 'demo' + i, title, artist, year: Number(year), genres: [genre], cover: null };
});
