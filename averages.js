const mongodb = require('mongodb')
const brain = require('brainjs')
var fs = require('fs');

var file = fs.createWriteStream('averageData.txt');
file.on('error', function(err) { console.error("Error working with file: averageData.txt") });

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
		console.log("Getting all records prior to today...")
        getData()
    }
})

var todayStart = new Date()
var todayEnd = new Date(todayStart)
todayStart.setHours(0,0,0,0)
todayEnd.setHours(24,0,0,0)
var whichDayStart = new Date(todayStart)
var whichDayEnd = new Date(todayEnd)
var millisecondsInADay = 86400000
const secondsInADay = 86400

var averageData = { 
	numAvg: 0,
	averageDay: []
}
for (let second=0; second<secondsInADay; second++){
	averageData.averageDay.push(0)
}
var docs = []



var currentTimestampMs //randomize starting timestamp

function getData() {
	whichDayStart.setDate(whichDayStart.getDate()-1)
	whichDayEnd.setDate(whichDayEnd.getDate()-1)
	//console.log("start: "+whichDayStart+" end: "+whichDayEnd)

	collectionHandle.findOne({created: { $gt:whichDayStart, $lt:whichDayEnd }}, function(err, doc) {
	    	if(err){ console.error(err) } 
	    	else {
	    		if(doc){
	    			console.log("Got record created: "+doc.created)
	    			//console.log("Flow length: "+doc.flow.length)
	    			handleDoc(doc)
	    			getData()
	    		}else {
	    			console.log("Creating average data...")
	    			console.log(new Date())
					addDocsToData()
					console.log(new Date())
	    			console.log("Saving to File...")
	    			averageData.averageDay.forEach(function(v) {
	    				var objectStr = JSON.stringify(v)
	    				file.write(objectStr+', '+ '\n')
	    			})
	    			file.end()
	    			file.close()
	    			console.log("Done")
	    		}
	    	}
	    }
	)
}

function handleDoc(doc){
	var tempData=[]
	var gallonsSoFar = 0
	var prevFlowTimestamp = undefined
	for(let i=0; i<doc.flow.length; i++){
		var flowTimestamp = new Date(doc.flow[i].created)
		flowTimestamp = flowTimestamp.getTime() - whichDayStart.getTime()
		if(flowTimestamp < prevFlowTimestamp){
			console.warn("WARNING: flow data out of order! "+"previous: "+ doc.flow[i-1].created+" current: "+doc.flow[i].created)
		}
		gallonsSoFar += clicksToGallons(doc.flow[i].clicks)
		tempData.push({ gallonsSoFar: gallonsSoFar, timestamp: flowTimestamp })
		//console.log("FLOW: flowTimestamp: "+flowTimestamp)
		prevFlowTimestamp = flowTimestamp
	}
	docs.push({
		currentIndex: 0,
		data: tempData
	})
}

function addDocsToData() {
	var currentSlice = []
	for(let docNum=0; docNum<docs.length; docNum++){
		currentSlice.push(0)
	}
	//for every second in a day
	for(let second=0; second < 86400; second++){
		var foundOne = true
		//until no more entries found less then second timestamp
		while(foundOne == true){
			foundOne = false
			//for each doc
			for(let i=0; i<docs.length; i++){
				//check index < length of array
				if(docs[i].currentIndex<docs[i].data.length){
					//console.log("doc number: "+i+" data length: "+docs[i].data.length+" currentIndex: "+docs[i].currentIndex)
					//check next index if time < then current second timestamp
					//console.log("second: "+second+" doc timestamp: "+ docs[i].data[docs[i].currentIndex].timestamp)
					if(second*1000 > docs[i].data[docs[i].currentIndex].timestamp){
						currentSlice[i] = docs[i].data[docs[i].currentIndex].gallonsSoFar
						// and set foundOne
						foundOne = true
						// increment index
						docs[i].currentIndex++
					}
				}
			}
		}
		//all entries for current second have been found.  Now average them.
		var average = 0
		for(let docNum=0; docNum<docs.length; docNum++){
			average += currentSlice[docNum]
		} 
		average += averageData.averageDay[second]*averageData.numAvg
		averageData.averageDay[second] = average/(averageData.numAvg+docs.length)
	}
}

function clicksToGallons(clicks) {return (0.000925824*clicks + 0.0015719)}


