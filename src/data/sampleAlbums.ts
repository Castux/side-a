import { hashStr, mulberry32, DAY } from '../core/math';
import type { Album, MoodVector } from '../core/types';

// title | artist | year | genre | energy | brightness | organic | density   (hand-tagged by Claude, not measured)
const RAW = `Kind of Blue|Miles Davis|1959|Jazz|.30|.45|.90|.40
In a Silent Way|Miles Davis|1969|Jazz|.35|.40|.60|.50
A Love Supreme|John Coltrane|1965|Jazz|.60|.50|.90|.75
Blue Train|John Coltrane|1958|Jazz|.60|.60|.90|.60
Moanin’|Art Blakey & the Jazz Messengers|1959|Jazz|.70|.70|.90|.60
Waltz for Debby|Bill Evans Trio|1962|Jazz|.25|.55|.95|.35
Journey in Satchidananda|Alice Coltrane|1971|Jazz|.35|.50|.85|.60
Getz/Gilberto|Stan Getz & João Gilberto|1964|Jazz|.25|.80|.95|.30
Promises|Floating Points, Pharoah Sanders & LSO|2021|Jazz|.20|.45|.75|.50
Kid A|Radiohead|2000|Alternative|.45|.25|.30|.70
In Rainbows|Radiohead|2007|Alternative|.50|.50|.55|.60
OK Computer|Radiohead|1997|Alternative|.60|.30|.50|.75
Spirit of Eden|Talk Talk|1988|Alternative|.30|.35|.70|.50
Boxer|The National|2007|Alternative|.45|.25|.65|.60
Funeral|Arcade Fire|2004|Alternative|.75|.55|.75|.80
Ágætis byrjun|Sigur Rós|1999|Alternative|.35|.50|.55|.75
Blue|Joni Mitchell|1971|Folk|.25|.45|.95|.30
Pink Moon|Nick Drake|1972|Folk|.15|.35|1|.15
Carrie & Lowell|Sufjan Stevens|2015|Folk|.15|.25|.90|.25
For Emma, Forever Ago|Bon Iver|2007|Folk|.20|.30|.85|.30
Fleet Foxes|Fleet Foxes|2008|Folk|.45|.70|.95|.60
Dragon New Warm Mountain I Believe in You|Big Thief|2022|Folk|.45|.55|.85|.50
Discovery|Daft Punk|2001|Electronic|.85|.90|.10|.65
Random Access Memories|Daft Punk|2013|Electronic|.65|.80|.50|.70
Music Has the Right to Children|Boards of Canada|1998|Electronic|.35|.45|.15|.50
Selected Ambient Works 85–92|Aphex Twin|1992|Electronic|.45|.50|.10|.45
Immunity|Jon Hopkins|2013|Electronic|.65|.50|.15|.70
Since I Left You|The Avalanches|2000|Electronic|.75|.90|.40|.85
Sound of Silver|LCD Soundsystem|2007|Electronic|.80|.60|.25|.70
Swim|Caribou|2010|Electronic|.70|.65|.15|.65
Untrue|Burial|2007|Electronic|.50|.10|.05|.60
Rounds|Four Tet|2003|Electronic|.50|.65|.45|.60
Black Sands|Bonobo|2010|Electronic|.50|.60|.45|.55
Moon Safari|Air|1998|Electronic|.35|.75|.30|.45
Rumours|Fleetwood Mac|1977|Rock|.60|.65|.70|.55
Abbey Road|The Beatles|1969|Rock|.60|.70|.75|.60
Pet Sounds|The Beach Boys|1966|Rock|.50|.75|.75|.80
Remain in Light|Talking Heads|1980|Rock|.85|.65|.45|.85
Unknown Pleasures|Joy Division|1979|Rock|.70|.10|.40|.50
Disintegration|The Cure|1989|Rock|.50|.15|.35|.85
Loveless|My Bloody Valentine|1991|Rock|.70|.40|.30|1
Heaven or Las Vegas|Cocteau Twins|1990|Rock|.50|.70|.30|.80
Teen Dream|Beach House|2010|Rock|.40|.55|.40|.70
Currents|Tame Impala|2015|Rock|.60|.65|.25|.75
Con Todo El Mundo|Khruangbin|2018|Rock|.50|.70|.85|.40
Mezzanine|Massive Attack|1998|Trip-hop|.50|.10|.25|.70
Dummy|Portishead|1994|Trip-hop|.35|.15|.35|.55
What’s Going On|Marvin Gaye|1971|Soul|.50|.60|.80|.65
Songs in the Key of Life|Stevie Wonder|1976|Soul|.70|.85|.70|.80
Voodoo|D’Angelo|2000|Soul|.45|.50|.75|.65
Blonde|Frank Ocean|2016|Soul|.30|.40|.50|.45
Pastel Blues|Nina Simone|1965|Soul|.40|.30|.90|.40
To Pimp a Butterfly|Kendrick Lamar|2015|Hip-hop|.75|.45|.60|.95
Madvillainy|Madvillain|2004|Hip-hop|.60|.45|.45|.75
The Low End Theory|A Tribe Called Quest|1991|Hip-hop|.60|.65|.60|.50
Donuts|J Dilla|2006|Hip-hop|.60|.60|.50|.70
Music for Airports|Brian Eno|1978|Ambient|.05|.50|.40|.15
Tabula Rasa|Arvo Pärt|1984|Classical|.10|.30|.90|.30
The Blue Notebooks|Max Richter|2004|Classical|.20|.25|.75|.35
Spaces|Nils Frahm|2013|Classical|.40|.50|.60|.50
Glassworks|Philip Glass|1982|Classical|.50|.50|.70|.60
Goldberg Variations (1981)|Glenn Gould|1982|Classical|.40|.60|1|.50
Buena Vista Social Club|Buena Vista Social Club|1997|World|.50|.80|1|.50
In the Heart of the Moon|Ali Farka Touré & Toumani Diabaté|2005|World|.35|.65|1|.40
Éthiopiques Vol. 4|Mulatu Astatke|1998|World|.55|.60|.90|.55
Expensive Shit|Fela Kuti|1975|World|.90|.70|.85|.75`;

export function sampleAlbums(now = Date.now()): Album[] {
  return RAW.trim().split('\n').map((line) => {
    const p = line.split('|');
    const [title = '', artist = '', year = '0', genre = ''] = p;
    const id = 'a' + hashStr(artist + '/' + title).toString(36);
    const rng = mulberry32(hashStr(id));
    return {
      id, title, artist, genre,
      year: Number(year),
      f: p.slice(4, 8).map(Number) as MoodVector,
      confidence: [1, 1, 1, 1] as MoodVector,
      sources: ['Hand-tagged sample'],
      addedAt: now - Math.floor(rng() * 1200) * DAY,
      tidalId: null,
      coverUrl: null,
    };
  });
}
