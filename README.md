# ZTM-DEPARTURES

Nodejs application for listing departures from bus stops in Warsaw. 

### Requirements

Get API key from https://api.um.warszawa.pl/

### Usage

0. Clone repo
0. npm install
0. export ZTM_API_KEY=<VALUE>
0. Copy config.json.sample to config.json (to use example config)
0. `node app` (or `watch -n 60 node app`) 

### How it looks like

```bash
$ node app
Stare Miasto 02 | 190 -> os.Górczewska za 4 min
Stare Miasto 02 | 26 -> Koło za 4 min
Stare Miasto 02 | 20 -> Boernerowo za 6 min
Stare Miasto 02 | 23 -> Nowe Bemowo za 8 min
Stare Miasto 02 | 13 -> Cm.Wolski za 9 min
Stare Miasto 02 | 190 -> os.Górczewska za 12 min
Stare Miasto 02 | 26 -> Koło za 12 min
Stare Miasto 02 | 20 -> Boernerowo za 14 min
Done.
```
