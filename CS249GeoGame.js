Markers = new Mongo.Collection('markers');
Places = new Mongo.Collection('places');
var markers = {};

if (Meteor.isClient) {
	$('#nextModal').modal({ show: false})
	
	Session.set('currentPage', 'home');
	Meteor.call("nextRandomPlace", Meteor.userId(), function(error, result) {
		Session.set("currentPlace", result);	
	});
	Session.set('currentView', 'static');
	
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
	
	Template.gameButtons.helpers({
		userscore: function() {
			return Places.find({solvedBy: {$in: [Meteor.userId()]}}).fetch().length;
		}
	});
	
	Template.gameButtons.events({
		"click .goHome": function() {
			Session.set('currentPage', 'home');
		},
		"click .streetView": function() {
			if (Session.get("currentView")=="static") {
				Session.set("currentView", "street");
			} else {
				Session.set("currentView", "static");
			}
		}, 
		"click .userScore": function() {
			$('#listModal').modal('show');
		}
    });
	
	Template.list.helpers({
		places: function() {
			return Places.find({recommended: {$gt: 3}}).fetch();
		},
		usersolved: function() {
			if (Places.findOne({solvedBy: {$in: [Meteor.userId()]}, name: this.name})) {
				return true;
			} else {
				return false;
			}
		}
	});
	
	Template.recommend.helpers({
		places: function() {
			return Places.find({recommended: {$gt: 3}}).fetch();
		}
	});
	
	Template.recommend.events({
		"click .recPlace": function() {
			var placeName = document.getElementById("placeRec").value;
			Meteor.call("recommendPlace", placeName);
		}
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
		},
		displaySM: function() {
			if (Session.get("currentView")=="static") {return "block";}
			else {return "none";}
		},
		displaySV: function() {
			if (Session.get("currentView")=="street") {return "block";}
			else {return "none";}	
		}
	});
	
	Template.next.helpers({
		placeName: function() {return Session.get('currentPlace');}
	});
	
	Template.next.events({
		"click #nextlevel": function() {
			$('#nextModal').modal('hide');

			//change color of marker
			var m = Markers.findOne({place: Session.get("currentPlace")});
			markers[m._id].setIcon('http://maps.google.com/mapfiles/ms/icons/green-dot.png')
								
			//add to solved
			var place = Places.findOne({name:Session.get('currentPlace')});
			Places.update(place._id, {$push: {solvedBy: Meteor.userId()}});
			Markers.update(m._id, {$push: {solvedBy: Meteor.userId()}});
			
			//next place
			Meteor.call("nextRandomPlace", Meteor.userId(), function(error, result) {
				Session.set("currentPlace", result);
			});
						
			//set new street view
			var sv = GoogleMaps.maps.streetView.instance;
			place = Places.findOne({name:Session.get('currentPlace')})
			sv.setPosition({lat: place.geocode.latitude, lng: place.geocode.longitude});
			google.maps.event.trigger(sv, 'resize'); 
			
			//reset zoom level 
			var map = GoogleMaps.maps.map.instance;
			map.setZoom(1);
			
		}
	});
	

	Template.map.onCreated(function() {
		GoogleMaps.ready('map', function(map) {
			google.maps.event.addListener(map.instance, 'center_changed', function(event) {
				var answer = Places.findOne({name:Session.get('currentPlace')}).geocode;
				var player = map.instance.center;
				
				Meteor.call("checkCenter", answer, player, function(error, result) {
					var distance = result;	
					var zoom = GoogleMaps.maps.map.instance.getZoom();
					if (distance < 0.0005 && zoom > 16) {$('#nextModal').modal('show');}
					else {console.log("still " + distance + " away");}
				});
			});
			
			Markers.find().observe({
				added: function (document) {
					
					// var marker = new google.maps.Circle({
						// strokeColor: "#FF0000",
						// strokeOpacity: 0.8,
						// strokeWeight: 2,
						// fillColor: '#FF0000',
						// fillOpacity: 0.35,
						// map: map.instance,
						// center: new google.maps.LatLng(document.lat, document.lng),
						// radius: 100,
						// id: document._id
					// });
					
				  var marker = new google.maps.Marker({
					animation: google.maps.Animation.DROP,
					position: new google.maps.LatLng(document.lat, document.lng),
					map: map.instance,
					id: document._id,
					icon: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png'
				  });
				  
				  if (document.solvedBy.indexOf(Meteor.userId())!=-1) {
					marker.setIcon('http://maps.google.com/mapfiles/ms/icons/green-dot.png')
				  }

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
	
		
	var placeNames = ["Sydney Opera House", "Stanford University", "Statue of Liberty New York", "Taj Mahal", 
		"The Colosseum", "Stonehenge", "The Golden Gate Bridge", "The Eiffel Tower, Paris France",
		"Machu Picchu in Peru", "Big Ben in London", "Tower of Pisa, Italy"];

	var baseURL = "https://maps.googleapis.com/maps/api/staticmap?zoom=18&size=600x600&maptype=satellite&center=";
	

	if (Places.find().fetch().length==0) {
		for (var i in placeNames) {
			var name = placeNames[i];
			var result = geo.geocode(name)[0];
			
			var staticMap = baseURL + result.latitude + "," + result.longitude;

			Places.insert({
				name: name, 
				geocode: result, 
				staticMap: staticMap,
				recommended: 5,
				solvedBy: []
			});
			
			Markers.insert({ 
				lat: result.latitude, 
				lng: result.longitude,
				place: name,
				solvedBy: []
			});
		}
	}
	
	Meteor.methods({
		'recommendPlace': function(name) {
			var result = geo.geocode(name)[0];
			if (result==undefined) {
				alert("That's not a real place, is it?");
			} else {
				var staticMap = baseURL + result.latitude + "," + result.longitude;
				
				Places.insert({
					name: name, 
					geocode: result, 
					staticMap: staticMap,
					recommended: 1,
					solvedBy: []
				});
			}
		},
		'checkCenter': function(answer, player) {
			var alat = answer.latitude;
			var alng = answer.longitude;
			var plat = player.A;
			var plng = player.F;

			//make sure these numbers are not negative
			while (alat < 0) alat += 360;
			while (alng < 0) alng += 360;
			while (plat < 0) plat += 360;
			while (plng < 0) plng += 360;
			
			//make sure these numbers are below 360
			alat = alat%360; alng = alng%360; plat = plat%360; plng = plng%360;

			//these coordinates should all now be between 0 and 360
			var distance = {
				lat: Math.abs(alat - plat),
				lng: Math.abs(alng - plng)
			}; 
			
			return (distance.lat + distance.lng);
		},
		"nextRandomPlace": function(userId) {
			var all = Places.find().fetch();
			var unsolved = all.filter(function(i) {
				return Places.findOne({solvedBy: {$in: [userId]}, name: i.name})==undefined;
			});
			
			var range = unsolved.length;
			//random num from 0 to range
			var random = Math.floor(Math.random()*(range));
			return unsolved[random].name;
			
		}
	});
}