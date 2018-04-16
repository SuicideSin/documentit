const electron = require('electron');
const remote = electron.remote;
const desktopCapturer = electron.desktopCapturer;
const electronScreen = electron.screen;
const shell = electron.shell;
const dialog = remote.dialog;

const fs = require('fs');
const os = require('os');
const path = require('path');

const screenshot = document.getElementById('screen-shot');
const screenshotMsg = document.getElementById('screenshot-path');
const pathButton = document.getElementById('path-button');
const casenameField = document.getElementById('casename');
const socialmediaField = document.getElementById('socialmedia');
const incidentdescriptionField = document.getElementById('incidentdescription');


var directoryPath = '';
var caseName = '';
var socialMedia = '';
var incidentDescription = '';

pathButton.addEventListener('click', function(event) {
    dialog.showOpenDialog({
            title: 'Choose a folder for DocumentIt to save in',
            buttonLabel: 'Select Path',
            properties: [
                'openDirectory',
                'createDirectory',
            ]
        },
        function(paths) {
            if (paths === undefined || paths.length === 0) {
                return;
            }
            directoryPath = paths[0]; // paths is an array, get the first (only) one
            screenshotMsg.textContent = "Path: "+directoryPath;
        });
});

screenshot.addEventListener('click', function(event) {
    screenshotMsg.textContent = 'Gathering screenshot...';
    const thumbSize = determineScreenShot();
    let options = { types: ['screen'], thumbnailSize: thumbSize };

    desktopCapturer.getSources(options, function(error, sources) {
        if (error) return displayError(error.message);

        sources.forEach(function(source) {
            if (source.name === 'Entire Screen' || source.name === 'Entire screen' || source.name === 'Screen 1') {

                // get values from form
                caseName = casenameField.value;
                socialMedia = socialmediaField.value;
                incidentDescription = incidentdescriptionField.value;

                if (directoryPath === '') return displayError("Please Select a Path to save the screenshot to.");

                timestamp = new Date().getTime();
                screenshotFilename = caseName + '-' + timestamp + '.png';
                screenshotPath = path.join(directoryPath, screenshotFilename);

                fs.writeFile(screenshotPath, source.thumbnail.toPng(), function(error) {
                    if (error) return displayError(error.message);

                    shell.openExternal('file://' + screenshotPath);
                    screenshotMsg.textContent = 'Saved screenshot to: ' + screenshotPath;

                    // if file was written, save to db as well
                    updateDatabase(directoryPath, screenshotFilename, caseName, socialMedia, incidentDescription);
                })
            }
        });
    });
});

function updateDatabase(directoryPath, screenshotFilename, caseName, socialMedia, incidentDescription) {
    // open/read db
    dbPath = path.join(directoryPath, "documentit-data.json");
    try {
        dbContents = fs.readFileSync(dbPath, {encoding: "utf8"});
    } catch (err) {
        console.log(err);
        console.log("Unable to open database, starting new db.");
        dbContents = "{}"; // file doesn't exist, create blank JSON
    }
    var database = JSON.parse(dbContents);

    // init db if not init'd
    // "cases" parent object
    if (!database.hasOwnProperty('cases')) database.cases = {};
    // each case is indexed by name (TODO: help users avoid typo'd case names)
    if (!database.cases.hasOwnProperty(caseName)) database.cases[caseName] = {};

    now = new Date(); // screenshots are indexed by unix timestamp
    database.cases[caseName][now.getTime()] = {
        'date': now.toLocaleString(), // human-readable duplicate of index time
        'socialMedia': socialMedia,
        'incidentDescription': incidentDescription,
        'screenshotFilename': screenshotFilename
    };

    // write db. stringify with two spaces for human-readability
    fs.writeFileSync(dbPath, JSON.stringify(database, null, '  '));
}

function displayError(message) {
    screenshotMsg.textContent = "ERROR: "+message;
    return console.log(message);
}

function determineScreenShot() {
    const screenSize = electronScreen.getPrimaryDisplay().workAreaSize;
    const maxDimension = Math.max(screenSize.width, screenSize.height);
    return {
        width: maxDimension * window.devicePixelRatio,
        height: maxDimension * window.devicePixelRatio
    };
}