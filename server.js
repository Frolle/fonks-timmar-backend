//jshint esversion:6
const express = require('express');
const axios = require('axios')
const bodyParser = require('body-parser');
const fs=require('fs');
const endOfLine = require('os').EOL;
const app = express();

const port = 8080;
const hostname = '0.0.0.0';

var myArgs = process.argv;
if (myArgs.length < 3) {
    console.log("You forgot to provide Fonks Timer Slack API key.")
    return -1;
} if (!(myArgs[2].startsWith("https://hooks.slack.com/services/"))) {
    console.log("Doesn't look like a Slack API key to me?");
    return -1;
}

const slackKey = myArgs[2];

app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies


app.get("/", function(req, res){
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(calculateWorkHoursAndReturnAsObject()));
});

app.post("/", function(req, res){
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    var userId = req.body.user_id;
    var hoursLeft = calculateWorkHoursAndReturnAsObject();
    var message = randomizeUserResponse(userId, hoursLeft.fonkHours, 'resources/command-responses.txt');
    message = getSlackMessage(message);
    message.response_type = "in_channel";
    res.send(JSON.stringify(message));
});

app.listen(port, hostname, function(){
    console.log("server started on:" + port);
    randomlyPostToSlack("", slackKey);
});

function calculateWorkHoursAndReturnAsObject() {
    var countDownDate = new Date("Dec 18, 2020 17:00").getTime();
    today = new Date();
    if(today.getDay() == 0 || today.getDay() == 6 || (today.getDay() == 5 && today.getHours() >= 17 && today.getMinutes >= 1)){
        switch(today.getDay()) {
            case 0:
                today.setDate(today.getDate() - 2);
                break;
            case 6:
                today.setDate(today.getDate() - 1);
                break;
        }
        today.setHours(17);
        today.setMinutes(0);
    } // Ugly fix to avoid counting weekends as working hours if you're watching the site on the weekend.

    var now = today.getTime();

    // Find the distance between now and the count down date
    var distance = countDownDate - now;

    var weeks = Math.floor(distance/(1000*60*60*24*7)); // FLoor because we don't want to include the last weekend.

    var workDays = Math.ceil(distance/(1000*60*60*24)) - (weeks*2); // Exclude weekends from the work days.

    var workHours = workDays*8;

    var currentHour = today.getHours();

    if(currentHour >= 8 && currentHour < 17) {
        workHours = currentHour < 13 ? workHours - (currentHour - 8) : workHours - (currentHour - 9); // Assumption made that lunch happens somewhere before 13, so after 13 we add this lunch hour.
        if(today.getMinutes() >= 30) {
            if(workHours == 1) {
                workHours = "½";
            } else {
                workHours = (workHours - 1) + "½";
            }
        }
    }
    return {fonkHours: workHours + ""};
}

function randomlyPostToSlack(currentHours, slackKey) {
    var halfHourInMs = 18e5;
    var twoHoursInMs = 72e5;
    var rand = Math.floor(Math.random() * (twoHoursInMs - halfHourInMs) + halfHourInMs);
    var hoursLeft = calculateWorkHoursAndReturnAsObject();
    if (currentHours && hoursLeft.fonkHours === currentHours.fonkHours) {
        setTimeout(randomlyPostToSlack, rand, hoursLeft, slackKey);
        return;
    }
    var message = randomizeUserResponse("_", hoursLeft.fonkHours, 'resources/pop-in-responses.txt');
    var slackMessage = getSlackMessage(message);

    axios.post(slackKey, slackMessage)
        .catch(error => {
        console.error(error)
    });
    setTimeout(randomlyPostToSlack, rand, hoursLeft, slackKey);
};

function getSlackMessage(message) {
    var slackMessage = {
        "blocks": [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": message
                }
            }
        ]};
    return slackMessage;
};

function randomizeUserResponse(userId, fonkHours, fileName) {
  var lines = fs.readFileSync(fileName, 'utf8').split(endOfLine);
  var randomIndex = Math.floor(Math.random() * lines.length);
  return lines[randomIndex].replace("%USER%", `<@${userId}>`).replace("%HOURS%", `*${fonkHours}*`);
};
