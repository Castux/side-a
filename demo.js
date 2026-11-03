// Sample albums for ?demo, so the app can be tried without a Tidal login.
// title | artist | year
const RAW = `Kind of Blue|Miles Davis|1959|Jazz
In a Silent Way|Miles Davis|1969
A Love Supreme|John Coltrane|1965
Blue Train|John Coltrane|1958
Moanin’|Art Blakey & the Jazz Messengers|1959
Waltz for Debby|Bill Evans Trio|1962
Journey in Satchidananda|Alice Coltrane|1971
Getz/Gilberto|Stan Getz & João Gilberto|1964
Promises|Floating Points, Pharoah Sanders & LSO|2021
Kid A|Radiohead|2000
In Rainbows|Radiohead|2007
OK Computer|Radiohead|1997
Spirit of Eden|Talk Talk|1988
Boxer|The National|2007
Funeral|Arcade Fire|2004
Ágætis byrjun|Sigur Rós|1999
Blue|Joni Mitchell|1971
Pink Moon|Nick Drake|1972
Carrie & Lowell|Sufjan Stevens|2015
For Emma, Forever Ago|Bon Iver|2007
Fleet Foxes|Fleet Foxes|2008
Dragon New Warm Mountain I Believe in You|Big Thief|2022
Discovery|Daft Punk|2001
Random Access Memories|Daft Punk|2013
Music Has the Right to Children|Boards of Canada|1998
Selected Ambient Works 85–92|Aphex Twin|1992
Immunity|Jon Hopkins|2013
Since I Left You|The Avalanches|2000
Sound of Silver|LCD Soundsystem|2007
Swim|Caribou|2010
Untrue|Burial|2007
Rounds|Four Tet|2003
Black Sands|Bonobo|2010
Moon Safari|Air|1998
Rumours|Fleetwood Mac|1977
Abbey Road|The Beatles|1969
Pet Sounds|The Beach Boys|1966
Remain in Light|Talking Heads|1980
Unknown Pleasures|Joy Division|1979
Disintegration|The Cure|1989
Loveless|My Bloody Valentine|1991
Heaven or Las Vegas|Cocteau Twins|1990
Teen Dream|Beach House|2010
Currents|Tame Impala|2015
Con Todo El Mundo|Khruangbin|2018
Mezzanine|Massive Attack|1998
Dummy|Portishead|1994
What’s Going On|Marvin Gaye|1971
Songs in the Key of Life|Stevie Wonder|1976
Voodoo|D’Angelo|2000
Blonde|Frank Ocean|2016
Pastel Blues|Nina Simone|1965
To Pimp a Butterfly|Kendrick Lamar|2015
Madvillainy|Madvillain|2004
The Low End Theory|A Tribe Called Quest|1991
Donuts|J Dilla|2006
Music for Airports|Brian Eno|1978
Tabula Rasa|Arvo Pärt|1984
The Blue Notebooks|Max Richter|2004
Spaces|Nils Frahm|2013
Glassworks|Philip Glass|1982
Goldberg Variations (1981)|Glenn Gould|1982
Buena Vista Social Club|Buena Vista Social Club|1997
In the Heart of the Moon|Ali Farka Touré & Toumani Diabaté|2005
Éthiopiques Vol. 4|Mulatu Astatke|1998
Expensive Shit|Fela Kuti|1975`;

export const demoAlbums = () => RAW.split('\n').map((line, i) => {
  const [title, artist, year] = line.split('|');
  return { id: 'demo' + i, title, artist, year: Number(year), cover: null };
});
