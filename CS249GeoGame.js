Markers = new Mongo.Collection('markers');
Places = new Mongo.Collection('places');
var index = 0;

var placeNames = ["Sydney Opera House", "Stanford University", "Statue of Liberty New York", "Taj Mahal", 
	"The Colosseum", "Stonehenge", "The Golden Gate Bridge", "The Eiffel Tower, Paris France",
	"Machu Picchu in Peru", "Big Ben in London", "Tower of Pisa, Italy"];

var baseURL = "https://maps.googleapis.com/maps/api/staticmap?zoom=18&size=600x600&maptype=satellite&center=";
	
if (Meteor.isClient) {
	$('#nextModal').modal({ show: false})
	
	Session.set('currentPage', 'home');
	Session.set('currentPlace', placeNames[index++]); //'Sydney Opera House');
	
	Template.body.helpers({
        displayHome: function() {return Session.get('currentPage')=='home';},
        displayGame: function() {return Session.get('currentPage')=='game';},
        displayStats: function() {return Session.get('currentPage')=='stats';},
		displayList: function() {return Session.get('currentPage')=='list';},
		displayInstructions: function() {return Session.get('currentPage')=='instructions';}
    });
	
	Template.home.events({
		"click #playGame": function() {Session.set('currentPage', 'game');},
		"click #viewStats": function() {Session.set('currentPage', 'stats');},
		"click #viewList": function() {Session.set('currentPage', 'list');},
		"click #viewInstructions": function() {Session.set('currentPage', 'instructions');}
    });
	
	Template.game.events({
		"click .goHome": function() {Session.set('currentPage', 'home');}
    });
	
	Template.stats.events({
		"click .goHome": function() {Session.set('currentPage', 'home');}
    });
	
	Template.list.events({
		"click .goHome": function() {Session.set('currentPage', 'home');}
    });
	
	Template.instructions.events({
		"click .goHome": function() {Session.set('currentPage', 'home');}
    });
	
	Template.game.helpers({
		staticmap: function() {
			var name = Session.get('currentPlace');
			var place = Places.findOne({name:name});
			console.log(place);
			return place.staticMap;
		},
		streetview: function() {
			var name = Session.get('currentPlace');
			var place = Places.findOne({name:name});
			return place.streetView;
		}
	});
	
	Template.next.helpers({
		placeName: function() {return Session.get('currentPlace');}
	});
	
	Template.next.events({
		"click #nextlevel": function() {
			$('#nextModal').modal('hide');
			Session.set("currentPlace", placeNames[index++]);
		}
	});
	

	Template.map.onCreated(function() {
		GoogleMaps.ready('map', function(map) {
			console.log("I'm ready!");
		  google.maps.event.addListener(map.instance, 'click', function(event) {
			Markers.insert({ lat: event.latLng.lat(), lng: event.latLng.lng() });
			$('#nextModal').modal('show');
		  });

		  var markers = {};

		  Markers.find().observe({
			added: function (document) {
			  var marker = new google.maps.Marker({
				draggable: true,
				animation: google.maps.Animation.DROP,
				position: new google.maps.LatLng(document.lat, document.lng),
				map: map.instance,
				id: document._id
			  });

			  google.maps.event.addListener(marker, 'dragend', function(event) {
				Markers.update(marker.id, { $set: { lat: event.latLng.lat(), lng: event.latLng.lng() }});
			  });

			  markers[document._id] = marker;
			},
			changed: function (newDocument, oldDocument) {
			  markers[newDocument._id].setPosition({ lat: newDocument.lat, lng: newDocument.lng });
			},
			removed: function (oldDocument) {
			  markers[oldDocument._id].setMap(null);
			  google.maps.event.clearInstanceListeners(markers[oldDocument._id]);
			  delete markers[oldDocument._id];
			}
		  });
		});
	  });

	  Meteor.startup(function() {
		GoogleMaps.load();
	  });

	  Template.map.helpers({
		mapOptions: function() {
		  if (GoogleMaps.loaded()) {
			return {
			  center: {lat:0, lng:0},
		      zoom: 1,
			  mapTypeId: google.maps.MapTypeId.SATELLITE
			};
		  }
		}
	  });

	Template.streetView.helpers({
		mapOptions: function() {
			if (GoogleMaps.loaded()) {
				var name = Session.get('currentPlace');
				var place = Places.findOne({name:name});
				return {
					position: {lat: place.geocode.latitude, lng: place.geocode.longitude}
				};
			}
		}
	});  
}

if (Meteor.isServer) {
	var geo = new GeoCoder();

	if (Places.find().fetch().length==0) {
		for (var i in placeNames) {
			var name = placeNames[i];
			var result = geo.geocode(name)[0];
			
			var staticMap = baseURL + result.latitude + "," + result.longitude;
			
			console.log(staticMap);
			
			// var streetViewDiv = document.createElement("div");
			// streetViewDiv.className = "street-view";
			// var streetViewOptions = {position: {lat: result.latitude, lng: result.longitude}};
			// var streetView = new google.maps.StreetViewPanorama(streetViewDiv, streetViewOptions);
				
			Places.insert({
				name: name, 
				geocode: result, 
				staticMap: staticMap
				// streetView: streetViewDiv
			});
		}	
	}

	/*
	// Reverse
	var geo = new GeoCoder({
	  geocoderProvider: "mapquest",
	  httpAdapter: "https",
	  apiKey: 'YOUR_API_KEY'
	});
	var result = geo.reverse(45.767, 4.833);
	*/
}
