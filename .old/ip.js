/* Filename: am3.js
Author: Priscilla Lee
Date: Feb 27, 2015
Goal: Javascript code for implementing an app that works with the Google Maps API, the 
Static Maps API, and the Street View API.

Honor Code Statement:
On this task I collaborated with Ella Chao and Audrey Elkus. Ella showed me how to
use the cool slideUp() and slideDown() methods. Eni helped me figure out how to
get around the geocoding limit.
*/

//hide the hints bar right away
$("#hints").slideUp();
	
//google map variables
var map, geocoder, bounds;

//retrieving all the divs for later use
var mapdiv = document.querySelector("#map-canvas");
var staticdiv = document.querySelector("#static-maps");

//array of place names
var placeNames = ["Sydney Opera House", "Stanford University", "Statue of Liberty New York",
	"Taj Mahal", "The Colosseum", "Stonehenge", "The Golden Gate Bridge", "The Eiffel Tower, Paris France",
	"St. Basil’s Cathedral in Moscow, Russia", "The Pyramids of Giza in Egypt", "Machu Picchu in Peru", 
	"Big Ben in London", "Tower of Pisa, Italy", "Loch Ness in Scotland", "Mont St. Michel in France", 
	"Agia Sophia in Istanbul, Turkey", "Brandenburg Gate in Berlin, Germany", "Acropolis of Athens, Greece", 
	"Mount Fuji in Japan", "Capitol Hill in Washington DC",  "The Grand Canyon in Arizona", 
	"Trevi Fountain in Rome, Italy", "Chichen Itza in Mexico", "Forbidden City in Beijing", 
	"Millau Bridge in France", "Hollywood Sign in Los Angeles"];
var index = 0; //keeps track of which location we're currently at
var street = false; //boolean to toggle for street view vs static map image
var numSolved = 0;

//this will contain multiple Place objects
var places = [];
for (var i = 0; i < placeNames.length; i++) {
	var onePlace = new Place(placeNames[i], false);
	places.push(onePlace);
}

//constructor for Place object
function Place(name, solved) {
	this.name = name;
	this.solved = solved;
}

//This function initializes everything: map, geocoder, and bounds.
function initialize() {
	var mapOptions = {
		center: {lat:0, lng:0},
		zoom: 1,
		mapTypeId: google.maps.MapTypeId.SATELLITE
	};
	map = new google.maps.Map(mapdiv, mapOptions);
    geocoder = new google.maps.Geocoder();
	bounds = new google.maps.LatLngBounds();
	for (var i = 0; i < places.length; i++)
		createPlaceWithDelay(places[i], i);
	
	//waits a little before displaying the first place
	setTimeout(function(){displayStaticMap();}, 2000);
	
	$("#current").html("<p>Current: 1/"+places.length+"</p>");
	$("#solved").html("<p>Solved: 0/"+places.length+"</p>");
}

/* This line of code is very important! */
google.maps.event.addDomListener(window, 'load', initialize);

/* We need to delay to avoid reaching google's geocoding limit of 10 requests per second */
function createPlaceWithDelay(place, delay) {
	setTimeout(function(){createPlaceByName(place);}, delay*1000);
}

/*
This function geocodes the given place and adds more properties to the
correct Place object (latlng, addressComponents, staticURL, streetView, marker, answerOverlay, hintsIndex)
*/
function createPlaceByName(place){
	geocoder.geocode( { 'address': place.name}, function(results, status) {
	  if (status == google.maps.GeocoderStatus.OK) {
		var result = results[0];
		place.latlng = result.geometry.location; 
		place.addressComponents = result.address_components; 
		place.hintsIndex = place.addressComponents.length-1;
		createAnswerOverlay(place);
		createStaticURL(place);
		createStreetView(place);
		addMarker(place);
	  }
	});
}

//This function creates an answer overlay div for the given Place object.
function createAnswerOverlay(place) {
	var answerOverlay = document.createElement("div");
	answerOverlay.className = "answerOverlay";
	answerOverlay.innerHTML = "Solved: " + place.name;
	place.answerOverlay = answerOverlay;
}

//This function creates a marker and adds it to the Place object given. It also extends bounds.
function addMarker(place) {
	var marker = new google.maps.Marker({
		position: place.latlng,
		map: map,
		icon: "marker-icons/red.png"
	});
	place.marker = marker;
	bounds.extend(place.latlng);
}


//This function adds the staticURL property to the given Place object.
function createStaticURL(place) {
	var baseURL = "https://maps.googleapis.com/maps/api/staticmap?zoom=18&size=640x400&maptype=satellite&center=";
	baseURL += place.latlng.lat() + "," + place.latlng.lng();
	place.staticURL = baseURL;
}

//This function adds the streetView property to the given Place object.
function createStreetView(place) {
	var streetViewDiv = document.createElement("div");
	streetViewDiv.className = "street-view";
	var streetViewOptions = {position: {lat: place.latlng.lat(), lng: place.latlng.lng()}};
	var streetView = new google.maps.StreetViewPanorama(streetViewDiv, streetViewOptions);
	place.streetViewDiv = streetViewDiv;
	place.streetView = streetView;
}

//When the next button is clicked, display the next location and "reset" everything.
nextB.onclick = function() {
	if (numSolved!=places.length)
		$("#hints").slideUp();
	if (index < places.length-1) {
		map.fitBounds(bounds);
		index++;
		places[index].hintsIndex = places[index].addressComponents.length-1; //reset hints index
		displayStaticMap();
		$("#current").html("<p>Current: "+(index+1)+"/"+places.length+"</p>");
	} else console.log("You can't go forward any further!");
}

//When the back button is clicked, display the previous location and "reset" everything.
backB.onclick = function() {
	if (numSolved!=places.length)
		$("#hints").slideUp();
	if (index > 0) {
		map.fitBounds(bounds);
		index--;
		places[index].hintsIndex = places[index].addressComponents.length-1;
		displayStaticMap();
		$("#current").html("<p>Current: "+(index+1)+"/"+places.length+"</p>");
	} else console.log("You can't go back any further!");
}

//When the check button is clicked, check if player is close enough and respond accordingly
checkB.onclick = function() {
	if (numSolved!=places.length)
		$("#hints").slideUp();
	if (index >= 0 && index < places.length) {
		var correctPlace = places[index];		
		if (!correctPlace.solved) {//if not already solved		
			var player = map.getCenter();
			var answer = correctPlace.latlng;
			var distance = getDistance(player, answer);
			if (distance.lat < 0.001 && distance.lng < 0.001) {
				numSolved++;
				$("#status").css("background-color", "rgba(0,255,0,0.5)");
				$("#status").html("<p>Awesome! <br>You rock!</p>");
				correctPlace.marker.setIcon("marker-icons/green.png");
				$("#solved").html("<p>Solved: "+numSolved+"/"+places.length+"</p>");
				correctPlace.solved = true;
				$("#static-maps").append(correctPlace.answerOverlay);
				
				//end game if player has solved all locs
				if (numSolved==places.length) {
					console.log("you won");
					$("#hints").slideDown();
					$("#hints").html("<p>Congratulations! You've found all the places!</p>");
				}	
			} else {
				$("#status").css("background-color", "rgba(255,0,0,0.5)");
				$("#status").html("<p>lat: " + distance.lat.toFixed(3) + " away <br>"
									+ "lng: " + distance.lng.toFixed(3) + " away</p>");
			}
		}
	}
}

//This function returns true if the two latlng objects are close enough
function getDistance(a, b) {
	var alat = a.lat();
	var alng = a.lng();
	var blat = b.lat();
	var blng = b.lng();
	
	//make sure these numbers are not negative
	while (alat < 0) alat += 360;
	while (alng < 0) alng += 360;
	while (blat < 0) blat += 360;
	while (blng < 0) blng += 360;
	
	//make sure these numbers are below 360
	alat = alat%360; alng = alng%360; blat = blat%360; blng = blng%360;
	
	//these coordinates should all now be between 0 and 360
	var distance = {
		lat: Math.abs(alat - blat),
		lng: Math.abs(alng - blng)
	}; return distance;
}

//When the street button is clicked, display either the static map or the street view.
streetToggleB.onclick = function() {
	if (numSolved!=places.length)
		$("#hints").slideUp();
	if (street) displayStaticMap();
	else displayStreetView();
	//street = !street; //toggle
}

//When the hint button is clicked, display a hint.
hintB.onclick = function() {
	if (numSolved==places.length)
		return;
	var place = places[index];
	var hint;
	do {
		if (place.hintsIndex < 1) {
			hint = "No more hints left";
			$("#hints").html("<p>Hint: " + hint + "</p>");
			$("#hints").slideDown();
			return;
		}
		hint = place.addressComponents[place.hintsIndex].long_name;
		place.hintsIndex--;
	} while (!isNaN(hint.charAt(0))) //don't use any hints that contain numbers...
	$("#hints").html("<p>Hint: " + hint + "</p>");
	$("#hints").slideDown();
}

//This function displays the static map
function displayStaticMap() {
	if (index >= 0 && index < places.length) {
		street = false;
		$("#status").css("background-color", "rgba(255,255,255,0.5)");
		$("#status").html("<p></p>");

		//clear the static div
		while (staticdiv.childNodes.length > 0)
			staticdiv.removeChild(staticdiv.lastChild);
			
		var place = places[index];
		var url = place.staticURL;
		$("#static-maps").css("background-image", "url("+url+")");  
		if (place.solved)
			$("#static-maps").append(place.answerOverlay);
	}
}

//This function displays street view
function displayStreetView() {
	if (index >= 0 && index < places.length) {
		street = true;
		$("#status").css("background-color", "rgba(255,255,255,0.5)");
		$("#status").html("<p></p>");
		
		//clear the static div
		while (staticdiv.childNodes.length > 0)
			staticdiv.removeChild(staticdiv.lastChild);
			
		var place = places[index];
		staticdiv.appendChild(place.streetViewDiv);
		
		//trigger resize event so that StreetViewPanorama loads
		google.maps.event.trigger(place.streetView, 'resize'); 
	}
}