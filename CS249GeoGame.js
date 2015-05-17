//zoom to fov formula taken from google forum
//https://groups.google.com/forum/#!topic/google-maps-js-api-v3/uqKfg0ZBhWc

Places = new Mongo.Collection('places');
var markers = {};

if (Meteor.isClient) {
	$('#nextModal').modal({ show: false});
	
    /******************************************************************************
    * Session variables
    ******************************************************************************/
	Session.set('currentPage', 'home');
    Session.set("currentPlace", null);
	Session.set('currentView', 'static');
	Session.set('clickPlay', new Date());
	Session.set('clickNext', new Date());
	Session.set('solved', new Date());
    Session.set('picsTaken', 0);
    Meteor.setInterval(function() {Session.set('now', new Date());}, 100);
    
    /******************************************************************************
    * BODY Template
    ******************************************************************************/
	Template.body.helpers({
        displayHome: function() {return Session.get('currentPage')=='home';},
        displayGame: function() {return Session.get('currentPage')=='game';},
        displayStats: function() {return Session.get('currentPage')=='stats';},
		displayList: function() {return Session.get('currentPage')=='list';},
		displayInstructions: function() {return Session.get('currentPage')=='instructions';}
    });
	
    /******************************************************************************
    * HOME Template
    ******************************************************************************/
	Template.home.events({
		"click #playGame": function() {
			Session.set('currentPage', 'game');
			Session.set('clickPlay', new Date());
            Session.set('picsTaken', 0);
            
            Meteor.call("nextRandomPlace", Meteor.userId(), function(error, result) {
                console.log("next random place result: " + result);
                Session.set("currentPlace", result);	
            });
		},
		"click #viewStats": function() {Session.set('currentPage', 'stats');},
		"click #viewList": function() {Session.set('currentPage', 'list');},
		"click #viewInstructions": function() {Session.set('currentPage', 'instructions');}
    });
    
    /******************************************************************************
    * GAME BUTTONS Template
    ******************************************************************************/
	Template.gameButtons.helpers({
		userscore: function() {
            var score = Meteor.user().profile.score;
            if (!score) {
                Meteor.users.update(Meteor.userId(), {$set: {"profile.score": 0}});
                return 0; 
            }
            return score;
		},
        time: function() {
            var play = Session.get("clickPlay").getTime();
			var next = Session.get("clickNext").getTime();
            var now = Session.get("now").getTime();

            var mill = Math.min( now-play, now-next );	
            var sec = Math.floor(mill/1000);
            var min = Math.floor(sec/60);
            
            var seconds = sec%60;
            if (seconds < 10) { seconds = "0" + seconds; }
            
            return (min + ":" + seconds);
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
			
			setTimeout(function(){ 
				var sv = GoogleMaps.maps.streetView.instance;
				place = Places.findOne({name:Session.get('currentPlace')});
				sv.setPosition({lat: place.geocode.latitude, lng: place.geocode.longitude});
				google.maps.event.trigger(sv, 'resize'); 
			}, 500);
		
		}, 
		"click .userScore": function() {
			$('#listModal').modal('show');
		}
    });
	
    /******************************************************************************
    * LIST Template
    ******************************************************************************/
	Template.list.helpers({
		places: function() {
			return Places.find({recommended: {$gte: 5}}).fetch();
		},
		usersolved: function() {
            var solved = Meteor.user().profile.solvedNames;
            return (solved && solved.indexOf(this.name)!=-1);
		},
        numSolved: function() {
            return Meteor.user().profile.solvedNames.length;
        },
        numTotal: function() {
            return Places.find({recommended: {$gte: 5}}).fetch().length;
        },
        time: function() {
            var place = this.name;
            var solved = Meteor.user().profile.solved;
            for (var i in solved) {
                if (solved[i].name==place) return solved[i].timeString;   
            }
        }
	});
    
    /******************************************************************************
    * LIST Template
    ******************************************************************************/
	Template.stats.helpers({
        name1: function() {return "name1";},
        name2: function() {return "name2";},
        name3: function() {return "name3";},
        name4: function() {return "name4";},
        name5: function() {return "name5";},
        score1: function() {return "score1";},
        score2: function() {return "score2";},
        score3: function() {return "score3";},
        score4: function() {return "score4";},
        score5: function() {return "score5";}
    });
	
    /******************************************************************************
    * RECOMMEND Template
    ******************************************************************************/
	Template.recommend.helpers({
		places: function() {
			return Places.find({recommended: {$lt: 5}}, {sort: {recommended: -1}}).fetch();
		},
		canDelete: function() {
			return (this.by==Meteor.userId());
		},
        thumbedUp: function() {
            var rec = Meteor.user().profile.recommend;
            if ( !rec || rec.indexOf(this.name)==-1) { return false; }
            else { return true; }
        }
	});
	
	Template.recommend.events({
        "keypress input": function(e) {
          if (e.which == 13) {
            var placeName = e.target.value;
            Meteor.call("recommendPlace", placeName, Meteor.userId(), function(error, result) {
                if (!result) {alert("That's not a real place, is it? Please try again.");}
            });
            e.target.value = ""; //clear form
          }
        },
		"click .recPlace": function(e) {
			var placeName = document.getElementById("placeRec").value;
			Meteor.call("recommendPlace", placeName, Meteor.userId(), function(error, result) {
				if (!result) {alert("That's not a real place, is it? Please try again.");}
			});
            document.getElementById("placeRec").value= ""; //clear form 
		},
		"click .deleteRec": function() {
			Places.remove({"_id": this._id});
		},
		"click .thumbsUp": function() {
            var rec = Meteor.user().profile.recommend;
            if ( !rec || rec.indexOf(this.name)==-1) {
                Places.update(this._id, {$inc: {recommended: 1}});
                Meteor.users.update(Meteor.userId(), {$push: {"profile.recommend": this.name}});
            } else {
                Places.update(this._id, {$inc: {recommended: -1}});
                Meteor.users.update(Meteor.userId(), {$pull: {"profile.recommend": this.name}});
            }
		}
    });
	
    /******************************************************************************
    * GAME Template
    ******************************************************************************/
	Template.game.helpers({
		staticmap: function() {
			var name = Session.get('currentPlace');
			var place = Places.findOne({name:name});
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
	
    /******************************************************************************
    * NEXT Template
    ******************************************************************************/
	Template.next.helpers({
		placeName: function() {
            return Session.get('currentPlace');
        },
		milliseconds: function() {
			var play = Session.get("clickPlay").getTime();
			var next = Session.get("clickNext").getTime();
			var solved = Session.get("solved").getTime();
			
			var mill = Math.min( solved-play, solved-next );  
            var sec = Math.floor(mill/1000);
            var min = Math.floor(sec/60);
            
            var seconds = sec%60;
            if (seconds < 10) { seconds = "0" + seconds; }
            
            Session.set("solvedTime", mill);
            Session.set("solvedTimeString", (min + ":" + seconds));
            return (min + ":" + seconds);
		},
        picsTaken: function() {
            return Session.get("picsTaken");   
        },
        timePts: function() {
            //if found under 5 seconds, award 10 points
            //for every extra 5 seconds, deduct 1 more point
            var mill = Session.get("solvedTime");
            var sec = Math.floor(mill/1000);
            var pts = 10 - Math.floor(sec/5);
            Session.set("timePts", pts);
            return pts;
        },
        picPts: function() {
            var pics = Session.get("picsTaken");
            Session.set("picPts", pics*0.5);
            return pics*0.5;
        }, 
        totPts: function() {
            var timePts = Session.get("timePts");
            var picPts = Session.get("picPts");
            Session.set("totPts", timePts+picPts);
            return (timePts+picPts);
        }
	});
	
	Template.next.events({
		"click #nextlevel": function() {
			$('#nextModal').modal('hide');

			//change color of marker
			var p = Places.findOne({name: Session.get("currentPlace")});
			markers[ p._id ].setIcon("https://storage.googleapis.com/support-kms-prod/SNP_2752129_en_v0");
								
			//add to solved
            Meteor.users.update(Meteor.userId(), {$addToSet: {"profile.solvedNames": Session.get('currentPlace')}});
            Meteor.users.update(Meteor.userId(), {$addToSet: {"profile.solvedTimes": Session.get('solvedTime')}});
            Meteor.users.update(Meteor.userId(), {$addToSet: {"profile.solved": {
                name: Session.get('currentPlace'),
                time: Session.get('solvedTime'),
                timeString: Session.get('solvedTimeString'),
                picsTaken: Session.get('picsTaken')
            }}});
            
            //update score
            var score = Session.get("totPts");
            Meteor.users.update(Meteor.userId(), {$inc: {"profile.score": score}});
                                            
			//next place
			Meteor.call("nextRandomPlace", Meteor.userId(), function(error, result) {
				Session.set("currentPlace", result);
        
				//set new street view
				var sv = GoogleMaps.maps.streetView.instance;
				place = Places.findOne({name:Session.get('currentPlace')})
				sv.setPosition({lat: place.geocode.latitude, lng: place.geocode.longitude});
				google.maps.event.trigger(sv, 'resize'); 
				
				//reset zoom level 
				var map = GoogleMaps.maps.map.instance;
				map.setZoom(1);
			});
			
			Session.set("clickNext", new Date());
            Session.set('picsTaken', 0);
		}
	});
	

    /******************************************************************************
    * GOOGLE MAPS Template
    ******************************************************************************/
	Template.map.onCreated(function() {
		GoogleMaps.ready('map', function(map) {
			google.maps.event.addListener(map.instance, 'center_changed', function(event) {
				var answer = Places.findOne({name:Session.get('currentPlace')}).geocode;
				var player = map.instance.center;
				
				Meteor.call("checkCenter", answer, player, function(error, result) {
					var distance = result;	
					var zoom = GoogleMaps.maps.map.instance.getZoom();
					if (distance < 0.0005 && zoom > 16) {$('#nextModal').modal('show');}
					//else {console.log("still " + distance + " away");}
					Session.set("distance", distance);
					Session.set("solved", new Date());
				});
			});
			
			Places.find().observe({
				added: function (document) {
                    if (document.recommended >= 5 ) {		
                      var marker = new google.maps.Marker({
                        animation: google.maps.Animation.DROP,
                        position: new google.maps.LatLng(document.lat, document.lng),
                        map: map.instance,
                        id: document._id,
                        icon: "https://storage.googleapis.com/support-kms-prod/SNP_2752125_en_v0"
                      });
                        
                        google.maps.event.addListener(marker, "dblclick", function(e) {
                            var map = GoogleMaps.maps.map.instance;
                            map.setZoom(14);
                            map.setCenter(marker.position);
                        });

                    if (Meteor.user()) {
                        var solved = Meteor.user().profile.solvedNames;
                          if (solved && solved.indexOf(document.name)!=-1 ) {
                              //document.solvedBy.indexOf(Meteor.userId())!=-1) {
                            marker.setIcon("https://storage.googleapis.com/support-kms-prod/SNP_2752129_en_v0");
                          }
                    }

                      markers[document._id] = marker;
                    }
				}
			});
		});
	  });

      
    /******************************************************************************
    * GOOGLE MAPS Loading
    ******************************************************************************/
	  Meteor.startup(function() {
		GoogleMaps.load();
	  });

    /******************************************************************************
    * GOOGLE MAPS Options
    ******************************************************************************/
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
	
    /******************************************************************************
    * STREET VIEW Template
    ******************************************************************************/
	Template.streetView.events({
		"click #picBtn": function() {
			var sv = GoogleMaps.maps.streetView.instance;	
			var URL = "https://maps.googleapis.com/maps/api/streetview?size=600x400";
			URL += "&pano=" + sv.pano;
			URL += "&heading=" + sv.pov.heading;
			URL += "&pitch=" + sv.pov.pitch;
			
			//calculating fov
			var zoom = sv.pov.zoom;
			var fov = 3.9018*Math.pow(zoom,2) - 42.432*zoom + 123; //took this formula from google forum
			if (fov < 10) {fov = 10;} //fov range from 10 to 120
			if (fov > 120) {fov = 120;}			
			URL += "&fov=" + fov;

			Session.set("pic", URL);
			$('#picModal').modal('show');
			
            Meteor.users.update(Meteor.userId(), {$push: {"profile.pictures": {
                name: Session.get("currentPlace"),
                pic: URL
            }}});
        
            Session.set('picsTaken', Session.get('picsTaken')+1);
		}
	});
	
    /******************************************************************************
    * PIC Template
    ******************************************************************************/
	Template.pic.helpers({
		svPic: function() {
			return Session.get("pic");
		}
	});
	
    /******************************************************************************
    * PHOTO ALBUM Template
    ******************************************************************************/
	Template.photoalbum.helpers({
		userPics: function() {
            return Meteor.user().profile.pictures;
		}
	});
	
	/******************************************************************************
    * ACCOUNTS Configuration
    ******************************************************************************/
	Accounts.ui.config({
		passwordSignupFields: 'USERNAME_ONLY',
		requestPermissions: {},
        // Allows users to give first name and Last name 
		extraSignupFields: [{
			fieldName: 'firstName',
			fieldLabel: 'First name',
			inputType: 'text',
			visible: true,
			validate: function(value, errorFunction) {
			  if (!value) {
                //console.log("Ths is the value: " + value);
				errorFunction("Please write your first name");
				return false;
			  } else {
				return true;
			  }
			}
		}, {
			fieldName: 'lastName',
			fieldLabel: 'Last name',
			inputType: 'text',
			visible: true,
		} ]
	});  
	
}

if (Meteor.isServer) {
	var geo = new GeoCoder();
	
	var placeNames = ["Sydney Opera House", "Stanford University", "Statue of Liberty New York", "Taj Mahal", 
		"The Colosseum", "Stonehenge", "The Golden Gate Bridge", "The Eiffel Tower, Paris France",
		"Machu Picchu in Peru", "Big Ben in London", "Tower of Pisa, Italy"];

	var baseURL = "https://maps.googleapis.com/maps/api/staticmap?zoom=18&maptype=satellite&center=";
	
	if (Places.find().fetch().length==0) {
		for (var i in placeNames) {
			var name = placeNames[i];
			var result = geo.geocode(name)[0];
			
			var staticMap = baseURL + result.latitude + "," + result.longitude + "&size=600x600";
			var thumbnail = baseURL + result.latitude + "," + result.longitude + "&size=600x200";

			Places.insert({
				name: name, 
				geocode: result, 
				staticMap: staticMap,
				thumbnail: thumbnail,
				recommended: 5,
				by: "Priscilla Lee",
                lat: result.latitude,
                lng: result.longitude,
			});
		}
	}
	
	Meteor.methods({
		'recommendPlace': function(name, user) {
			var result = geo.geocode(name)[0];
			if (result==undefined) {
				return false;
			} else {
				var staticMap = baseURL + result.latitude + "," + result.longitude + "&size=600x600";
				var thumbnail = baseURL + result.latitude + "," + result.longitude + "&size=600x200";

				Places.insert({
					name: name, 
					geocode: result, 
					staticMap: staticMap,
					thumbnail: thumbnail,
					recommended: 1,
					by: user,
                    lat: result.latitude,
                    lng: result.longitude
				});
				
				return true;
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
			var all = Places.find({recommended: {$gte: 5}}).fetch();
			var unsolved = all.filter(function(i) {
                var solved = Meteor.user().profile.solvedNames;
                return (!solved || solved.indexOf(i.name)==-1);
			});
			
			var range = unsolved.length;
			//random num from 0 to range
			var random = Math.floor(Math.random()*(range));
			return unsolved[random].name;
		}
	});
}