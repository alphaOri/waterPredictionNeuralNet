const mongodb = require('mongodb')
const brain = require('brainjs')
var fs = require('fs');

var file = fs.createWriteStream('trainingData.txt');
file.on('error', function(err) { console.error("Error working with file: trainingData.txt") });

//var mongoHostname = "127.0.0.1"
//var mongoPort = "27017"
//node --max-old-space-size=3000 my.js

var mongoHostname = "192.168.1.19"
var mongoPort = "27017"
var mongoDbName = "water"
var mongoDailyCollection = "daily"
var mongousername = "predictionalgorithm"
var mongopassword = "predictionpassword"

var url = "mongodb://"+mongousername+":"+mongopassword+"@"+mongoHostname+":"+mongoPort+"/"+mongoDbName
var dbHandle
var collectionHandle
mongodb.MongoClient.connect(url, {useNewUrlParser:true, useUnifiedTopology: true }, function(err, client) {
    if(err){
        console.error(err)
    } else {
        console.log("Connected to database.")
        dbHandle = client.db(mongoDbName)
        collectionHandle = dbHandle.collection(mongoDailyCollection)
        getData()
    }
})

var trainingData = []

var todayStart = new Date()
var todayEnd = new Date(todayStart)
todayStart.setHours(0,0,0,0)
todayEnd.setHours(24,0,0,0)
var whichDayStart = new Date(todayStart)
var whichDayEnd = new Date(todayEnd)
var millisecondsInADay = 86400000

var currentTimestampMs //randomize starting timestamp

function getData() {
	whichDayStart.setDate(whichDayStart.getDate()-1)
	whichDayEnd.setDate(whichDayEnd.getDate()-1)
	//console.log("start: "+whichDayStart+" end: "+whichDayEnd)

	collectionHandle.findOne({created: { $gt:whichDayStart, $lt:whichDayEnd }}, function(err, doc) {
	    	if(err){ console.error(err) } 
	    	else {
	    		if(doc){
	    			console.log("Got doc created: "+doc.created)
	    			console.log("Flow length: "+doc.flow.length)
	    			handleDailyDoc(doc)
	    			getData()
	    			console.log("Done")
	    		}else {
	    			console.log("End of docs")
	    			trainingData.forEach(function(v) {
	    				var objectStr = JSON.stringify(v)
	    				file.write(objectStr+', '+ '\n'); 
	    			});
	    			file.end();
	    		}
	    	}
	    }
	)
}

function handleDailyDoc(doc){
	currentTimestampMs = Math.floor(Math.random() * 1000)
	var gallonsSoFar = 0
	var prevFlowTimestamp = undefined
	for(let i=0; i<doc.flow.length; i++){
		var flowTimestamp = new Date(doc.flow[i].created)
		flowTimestamp = flowTimestamp.getTime() - whichDayStart.getTime()
		if(flowTimestamp < prevFlowTimestamp){
			console.log("previous: "+ doc.flow[i-1].created+" current: "+doc.flow[i].created)
		}
		while((Math.abs(flowTimestamp-currentTimestampMs)>2000)) { //while flow timestamp is more than 2 seconds away from current timestamp 
			addToTrainingData(gallonsSoFar, currentTimestampMs, doc.gallons)
			currentTimestampMs = currentTimestampMs+1000
		}
		gallonsSoFar = gallonsSoFar+clicksToGallons(doc.flow[i].clicks)
		currentTimestampMs = flowTimestamp
		addToTrainingData(gallonsSoFar, currentTimestampMs, doc.gallons)
		//console.log("FLOW: flowTimestamp: "+flowTimestamp+" currentTimestampMs: "+currentTimestampMs)
		prevFlowTimestamp = flowTimestamp
	}
	//from last flow data to midnight
	while(Math.abs(millisecondsInADay-currentTimestampMs)>2000){
		//console.log("millisecondsInADay: "+millisecondsInADay+" currentTimestampMs: "+currentTimestampMs)
		currentTimestampMs = currentTimestampMs+1000
		addToTrainingData(gallonsSoFar, currentTimestampMs, doc.gallons)
	}
}

function addToTrainingData(gallonsSoFar, timestamp, gallons) {
	var input = {gallonsSoFar: gallonsSoFar/1000, timestamp: timestamp/millisecondsInADay}
	var output = {gallons: gallons/1000}
	//var objectStr = JSON.stringify({input: input, output: output})
	//console.log({input: input, output: output})
	//file.write(objectStr+', '+'\n')
	trainingData.push({input: input, output: output})
}

function clicksToGallons(clicks) {return (0.000925824*clicks + 0.0015719)}

var net = new brain.NeuralNetwork();
 
net.train([{input: { r: 0.03, g: 0.7, b: 0.5 }, output: { black: 1 }},
           {input: { r: 0.16, g: 0.09, b: 0.2 }, output: { white: 1 }},
           {input: { r: 0.5, g: 0.5, b: 1.0 }, output: { white: 1 }}]);
 
var output = net.run({ r: 1, g: 0.4, b: 0 });  // { white: 0.99, black: 0.002 }
console.log(output)