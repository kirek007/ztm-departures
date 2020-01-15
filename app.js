const util = require('util');
const fetch = require('node-fetch');
const fs = require('fs');
const moment = require('moment');

const bus_api = 'https://api.um.warszawa.pl/api/action/dbtimetable_get?apikey=%s&id=%s&%s';
const stops_api = 'https://api.um.warszawa.pl/api/action/dbstore_get?apikey=%s&id=%s';

const bus_stop_res_id = "b27f4c17-5c50-4a5b-89dd-236b282bc499";
const bus_lines_res_id = "88cd555f-6f31-43ca-9de4-66c479ad5942";
const bus_line_res_id = "e923fa0e-d96c-43f9-ae6e-60518c9f3238";

const stops_res_id = "ab75c33d-3a26-4342-b36a-6e5fef0a3ac3";

const bus_stop_params_template = "name=%s";
const bus_lines_params_template = "busstopId=%s&busstopNr=%s";
const bus_line_params_template = "busstopId=%s&busstopNr=%s&line=%s";

const api_key = process.env.ZTM_API_KEY || "";

const stops_api_url = util.format(stops_api, api_key, stops_res_id);

const cache_file = "cache.json";
const config_file = "config.json";

async function doReq(url) {
    let res = await fetch(url);
    let json = await res.json();

    let object = [];

    json.result.forEach(res => {
        let innerObject = {};
        res.values.forEach(obj => {
            innerObject[obj.key] = obj.value
        });
        object.push(innerObject)
    });
    return object;
}

async function main() {

    if (api_key === "") {
        console.error("ZTM_API_KEY not defined. get your key at https://api.um.warszawa.pl/. It's free.");
        return 1;
    }

    var args = process.argv.slice(2);

    switch (args[0]) {
        case 'groups':
            let groups = await doReq(stops_api_url);
            let uniq = new Set();
            let res = groups.map(i => uniq.add(i.zespol + " - " + i.nazwa_zespolu));
            uniq.forEach(i => console.log(i));
            return;
        case 'lines':
            let lines = await getLinesForBusStopNo(args[1], args[2]);
            console.log(JSON.stringify(lines));
            return;
    }

    let config;
    if (fs.existsSync(config_file)) {
        let rawdata = fs.readFileSync(config_file);
        config = JSON.parse(rawdata);
    } else {
        console.error("Can not find configuration file " + config_file);
        return 2
    }

    let bus_data = await downloadData(config);
    printTable(getNextDepartures(bus_data));
}

function readConfig() {

}

function fixTime(time) {
    h = time.substring(0, 2);
    h = h >= 24 ? h - 24 : h;
    return h + time.substring(2, time.length);
}

function printTable(bus_data) {

    for (const item of bus_data) {
        console.log(util.format("%s %s | %s -> %s za %s min", item.bus_stop_name, item.bus_stop_no, item.line_no, item.direction, item.departure_in));
    }
}

function getNextDepartures(bus_data) {
    let nextBuses = [];
    let now = moment();

    bus_data.forEach(bus_stop_group => {
        bus_stop_group.bus_stop_data.forEach(bus_stop => {
            bus_stop.lines.forEach(line => {
                line.departures.forEach(item => {
                    time = fixTime(item.time);
                    let diff = Math.floor((moment(time, 'HH:mm:ss') - now) / (1000 * 60));
                    if (diff < 15 && diff > 2) {
                        nextBuses.push({
                            bus_stop_name: bus_stop.bus_stop.nazwa_zespolu,
                            bus_stop_no: bus_stop.bus_stop.slupek,
                            line_no: line.line,
                            departire_at: time,
                            departure_in: diff,
                            direction: item.direction
                        });
                    }
                })
            })
        })
    });


    return nextBuses.sort((a, b) => a.departure_in < b.departure_in ? -1 : 1);
}

async function getBusStopGroupId(group_name) {
    let url = util.format(bus_api, api_key, bus_stop_res_id, util.format(bus_stop_params_template, group_name));
    let res = await doReq(url);
    return res.length > 1 ? res[res.length - 1].zespol : res[0].zespol;
}

async function getLinesForBusStopNo(group_id, bus_stop_no) {
    let url = util.format(bus_api, api_key, bus_lines_res_id, util.format(bus_lines_params_template, group_id, bus_stop_no));
    let res = await doReq(url);

    return res.reduce((previousValue, currentValue) => {
        previousValue.push(currentValue.linia);
        return previousValue
    }, []);
}

async function getDeparturesForBusLine(group_id, bus_stop_no, bus_line) {
    let url = util.format(bus_api, api_key, bus_line_res_id, util.format(bus_line_params_template, group_id, bus_stop_no, bus_line));
    let res = await doReq(url);

    return res.reduce((previousValue, currentValue) => {
        previousValue.push({'time': currentValue.czas, 'direction': currentValue.kierunek});
        return previousValue
    }, []);
}

function updateCache(data) {
    let cache = JSON.stringify(data);
    fs.writeFileSync(cache_file, cache, {flag: 'w+'});
}

async function downloadData(config) {

    let groups = await doReq(stops_api_url);
    let group_data = [];

    for (const filter of config) {
        let group_id = await getBusStopGroupId(filter.bus_stop_name);
        let filtered_group = groups.filter(group => group.zespol === group_id).filter(group => filter.bus_stop_numbers.includes(group.slupek));

        let bus_stop_data = [];
        for (const bus_stop of filtered_group) {
            let lines = await getLinesForBusStopNo(bus_stop.zespol, bus_stop.slupek);
            let filtered_lines = lines.filter(line => filter.bus_lines.includes(line));

            // console.log(util.format("%s (%s) -> %s (%s)", bus_stop.nazwa_zespolu, bus_stop.slupek, filtered_lines.join(","), lines.join(",")));

            let lines_data = [];

            for (const line of filtered_lines) {
                let departures = await getDeparturesForBusLine(bus_stop.zespol, bus_stop.slupek, line);
                lines_data.push({'line': line, 'departures': departures});
            }
            if (lines_data.length > 0)
                bus_stop_data.push({'bus_stop': bus_stop, 'lines': lines_data});
        }
        group_data.push({bus_stop_data});
    }

    updateCache(group_data);
    return group_data

}

main().then(r => console.log("Done."));