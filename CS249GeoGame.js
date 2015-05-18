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
    Session.set('pauseTime', true);
    
    /******************************************************************************
    * BODY Template
    ******************************************************************************/
	Template.body.helpers({
        displayHome: function() {return Session.get('currentPage')=='home';},
        displayGame: function() {return Session.get('currentPage')=='game';},
    });
	
    /******************************************************************************
    * HOME Template
    ******************************************************************************/
	Template.home.events({
		"click #playGame": function() {
			Session.set('currentPage', 'game');
			Session.set('clickPlay', new Date());
            Session.set('picsTaken', 0);
            Session.set('pauseTime', false);
            
            if (!gameDone()) {
                Meteor.call("nextRandomPlace", Meteor.userId(), function(error, result) {
                    console.log("next random place result: " + result);
                    Session.set("currentPlace", result);	
                });
            }
		}
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
            if (Session.get("pauseTime")) return "---";
            
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
            var solved = Meteor.user().profile.solvedNames;
            if (solved) return solved.length;
            else return 0;
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
    * STATS Template
    ******************************************************************************/
	Template.stats.helpers({
        top10Players: function() {
            var sorted = Meteor.users.find({}, {sort: {"profile.score": -1}}).fetch();
            
            //array of top 10 players
            var top10 = [];
            
            //get user rank
            function getUserRank() {
                for (var i in sorted) {
                    if (sorted[i].username == Meteor.user().username) 
                        return parseInt(i)+1;
                }
                return -1;
            }

            //returns player of specified rank number
              function getPlayerNum(num) {
                  var sorted = Meteor.users.find({}, {sort: {"profile.score": -1}}).fetch();
                  var player = sorted[num-1];
                  return player;
              }

              //given array of solve times (in milliseconds), returns average solve time
              function getAvgTime(array) {
                  var sum = 0;
                  for (var i in array) { sum += array[i]; }
                  var avgMill = (sum / array.length);
                  var avgSec = avgMill/1000;
                  return Math.round( avgSec * 10) / 10; //rounded to 1 dec place
              }
            
            function createPlayer(p, rank) {
                var player;
                
                if (p && p.profile.solvedTimes) {
                    player = {
                        username: p.username,
                        rank: rank,
                        name: p.profile.firstName + " " + p.profile.lastName,
                        score: p.profile.score,
                        avgTime: getAvgTime(p.profile.solvedTimes)
                    }
                } else if (p) {
                    player = {
                        username: p.username,
                        rank: rank,
                        name: p.profile.firstName + " " + p.profile.lastName,
                        score: "---",
                        avgTime: "---"
                    } 
                } else {
                    player = {
                        username: undefined,
                        rank: rank,
                        name: "---",
                        score: "---",
                        avgTime: "---"
                    } 
                }
                return player;
            }
            
            function isUser(player) {
                return (player && Meteor.user().username==player.username);
            }
            
            if (getUserRank() > 10) {
                for (var i = 1; i <= 9 ; i++) { //get top 9
                    var p = getPlayerNum(i);   
                    var player = createPlayer(p, i);
                    
                    if (i <= 5) player.class = "info";
                    else player.class = "normalPlayer";
                    
                    top10.push(player);
                } 
                
                //add user
                var user = createPlayer(Meteor.user(), getUserRank());
                user.class = "warning";
                top10.push(user);    
            } else {
                for (var i = 1; i <= 10 ; i++) { //get top 10
                    var p = getPlayerNum(i);   
                    var player = createPlayer(p, i);
                    
                    if ( isUser(p) ) player.class = "warning";
                    else if (i <= 5) player.class = "info";
                    else player.class = "normalPlayer";
                    
                    top10.push(player);
                } 
            }
            
            return top10;
            
            
            
            
        }
//        name: function(num) {
//            var result = Meteor.users.find({}, {sort: {"profile.score": -1}}).fetch()[num-1];
//            if (!result) return "---";
//            return result.profile.firstName + " " + result.profile.lastName; 
//        },
//        score: function(num) {
//            var result = Meteor.users.find({}, {sort: {"profile.score": -1}}).fetch()[num-1];
//            if (!result || !result.profile.score) return "---";
//            return result.profile.score;
//        },
//        avgTime: function(num) {
//            function getAvgTime(array) {
//                var sum = 0;
//                for (var i in array) { sum += array[i]; }
//                var avgMill = (sum / array.length);
//                var avgSec = avgMill/1000;
//                return Math.round( avgSec * 10) / 10; //rounded to 1 dec place
//            }
//            
//            var result = Meteor.users.find({}, {sort: {"profile.score": -1}}).fetch()[num-1];
//            if (!result || !result.profile.solvedTimes) return "---";
//            
//            return getAvgTime(result.profile.solvedTimes);
//        }
    });
    
    Template.stats.events({
		"click #viewStats": function() {
            setTimeout(function(){createD3Visualization();}, 500);
        },
        "mouseover td": function() {
            if (this.username) { d3.select("#" + this.username).attr("r", 20); }      
        }, "mouseleave td": function() {
            if (this.username) { d3.select("#" + this.username).attr("r", 5); }      
        }
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
		},
        gameDone: function() {
            return gameDone(); 
        }
	});
    
    function gameDone() {
        var numSolved, numTotal;

        var solved = Meteor.user().profile.solvedNames;
        if (solved) numSolved = solved.length;
        else numSolved = 0;

        var total = Places.find({recommended: {$gte: 5}}).fetch()
        numTotal = total.length;

        return (numSolved >= numTotal);  
    }
	
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
            //if found under 10 seconds, award 10 points
            //for every extra 5 seconds, deduct 0.5 more point
            var mill = Session.get("solvedTime");
            var sec = Math.floor(mill/1000);
            var pts = 10 - (0.5* Math.floor(sec/5));
            Session.set("timePts", Math.max(pts,1));
            return Math.max(pts,1);
        },
        picPts: function() {
            var pics = Session.get("picsTaken");
            Session.set("picPts", Math.min(pics*0.5, 5));
            return Math.min(pics*0.5, 5);
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
              
            if (!gameDone()) {
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
            }
			
			Session.set("clickNext", new Date());
            Session.set('picsTaken', 0);
            Session.set('pauseTime', false);
		}
	}); 
    
    
    
    
    /******************************************************************************
    * D3 Template
    ******************************************************************************/
    
    
    function showScatterPlot(data) {
        $("#d3container").empty();
        
        // just to have some space around items. 
        var margins = {
            "left": 40,
                "right": 30,
                "top": 30,
                "bottom": 30
        };

        var width = (document.getElementById("d3container").offsetWidth)*(0.95); //500;
        var height = (document.getElementById("highScoreTable").offsetHeight) - 30; //300;

        // this will be our colour scale. An Ordinal scale.
        //var colors = d3.scale.category10();
        
        var colors = {
            "top5": "#5bc0de",
            "user": "#f0ad4e",
            "none": "#337ab7"
//            "HS": "#5bc0de",
//            "You": "#f0ad4e",
//            "Normal": "#337ab7"
        }

        // we add the SVG component to the scatter-load div
        var svg = d3.select("#d3container").append("svg").attr("width", width).attr("height", height).append("g")
            .attr("transform", "translate(" + margins.left + "," + margins.top + ")");

        // this sets the scale that we're using for the X axis. 
        // the domain define the min and max variables to show. In this case, it's the min and max scores of items.
        // this is made a compact piece of code due to d3.extent which gives back the max and min of the score variable within the dataset
        var scoreExtent = d3.extent(data, function (d) {return d.score;});
        var timeExtent = d3.extent(data, function (d) {return d.time;});
        
        var x = d3.scale.linear()
            .domain([ scoreExtent[0]-10 , scoreExtent[1]+10 ])

        
        // the range maps the domain to values from 0 to the width minus the left and right margins (used to space out the visualization)
            .range([0, width - margins.left - margins.right]);

        // this does the same as for the y axis but maps from the time variable to the height to 0. 
        var y = d3.scale.linear()
            .domain([ timeExtent[0]-5 , timeExtent[1]+5 ])
        // Note that height goes first due to the weird SVG coordinate system
        .range([height - margins.top - margins.bottom, 0]);

        // we add the axes SVG component. At this point, this is just a placeholder. The actual axis will be added in a bit
        svg.append("g").attr("class", "x axis").attr("transform", "translate(0," + y.range()[0] + ")");
        svg.append("g").attr("class", "y axis");

        // this is our X axis label. Nothing too special to see here.
        svg.append("text")
            .attr("fill", "#414241")
            .attr("text-anchor", "end")
            .attr("x", width - 65)
            .attr("y", height - 35)
            .text("Total score (pts)");
        
        svg.append("text")
            .attr("fill", "#414241")
            .attr("text-anchor", "end")
            .attr("transform", "rotate(-90)")
            .attr("x", 0) //width / 2)
            .attr("y", height/2 - 215) //height - 35)
            .text("Average solve time (sec)");


        // this is the actual definition of our x and y axes. The orientation refers to where the labels appear - for the x axis, 
        ///below or above the line, and for the y axis, left or right of the line. Tick padding refers to how much space between 
        //the tick and the label. There are other parameters too - see https://github.com/mbostock/d3/wiki/SVG-Axes for more information
        var xAxis = d3.svg.axis().scale(x).orient("bottom").tickPadding(2);
        var yAxis = d3.svg.axis().scale(y).orient("left").tickPadding(2);

        // this is where we select the axis we created a few lines earlier. See how we select the axis item. in our svg we appended 
        //a g element with a x/y and axis class. To pull that back up, we do this svg select, then 'call' the appropriate axis object 
        //for rendering.    
        svg.selectAll("g.y.axis").call(yAxis);
        svg.selectAll("g.x.axis").call(xAxis);
        
    
        // now, we can get down to the data part, and drawing stuff. We are telling D3 that all nodes (g elements with class node) 
        //will have data attached to them. The 'key' we use (to let D3 know the uniqueness of items) will be the name. Not usually 
        //a great key, but fine for this example.
        var players = svg.selectAll("g.node").data(data, function (d) {
            return d.name;
        });

        // we 'enter' the data, making the SVG group (to contain a circle and text) with a class node. This corresponds with 
        //what we told the data it should be above.

        var playersGroup = players.enter().append("g")
            //.attr("class", function(d) {return d.type + " node";})
        // this is how we set the position of the items. 
        //Translate is an incredibly useful function for rotating and positioning items 
            .attr('transform', function (d) {
                return "translate(" + x(d.score) + "," + y(d.time) + ")";
            });

        //BACKGROUND CIRCLE
        playersGroup.append("circle")
            .attr("r", 5)
            .attr("class", "dot")
            .attr("id", function(d) {return d.username;})
            .attr("opacity", 0.25)
            .style("fill", function (d) {
                // remember the ordinal scales? We use the colors scale to get a colour for our type. Now each node will be coloured
                // by who makes the players. 
                return colors[d.type]; //(d.type);
        });
        
        //ACTUAL CIRCLE
        playersGroup.append("circle")
            .attr("r", 5)
            .attr("class", "dot")
            .style("fill", function (d) {
                // remember the ordinal scales? We use the colors scale to get a colour for our type. Now each node will be coloured
                // by who makes the players. 
                return colors[d.type]; //(d.type);
        });

        // now we add some text, so we can see what each item is.
        playersGroup.append("text")
            .style("text-anchor", "middle")
            .attr("dy", -10)
            //.attr("class", function(d) {return d.type;})
            .text(function (d) {
                // this shouldn't be a surprising statement.
                if (d.type != "none") return d.name;
                else return "";
            });
    }    
    
    function createD3Visualization() {
        //array of player objects to be used for d3
          var players = [];

        //returns player of specified rank number
          function getPlayerNum(num) {
              var sorted = Meteor.users.find({}, {sort: {"profile.score": -1}}).fetch();
              var player = sorted[num-1];
              return player;
          }

          //given array of solve times (in milliseconds), returns average solve time
          function getAvgTime(array) {
              var sum = 0;
              for (var i in array) { sum += array[i]; }
              var avgMill = (sum / array.length);
              var avgSec = avgMill/1000;
              return Math.round( avgSec * 10) / 10; //rounded to 1 dec place
          }

          //takes in Meteor.user object and adds appropriate info to array for d3
          function addPlayer(player, type) {
              if (player && player.profile.solvedTimes) {
                  var prof = player.profile;
                  var d3player = {
                      username: player.username,
                      
                      name: prof.firstName + " " + prof.lastName,
                      type: type,
                      score: prof.score,
                      time: getAvgTime(prof.solvedTimes)
                  }
                  players.push(d3player);
              }
          }

          //populate first with current user
          addPlayer(Meteor.user(), "user");

          //populate with top 5 players
          for (var i = 1; i <=5; i++) {
              var p = getPlayerNum(i);
              addPlayer(p, "top5");
          }

          //populate with rest of players
          var allPlayers = Meteor.users.find().fetch();
          for (var i in allPlayers) {
              var p = allPlayers[i];
              addPlayer(p, "none");
          }

        showScatterPlot(players);
    }
    
    
  Template.d3.onRendered(function(){ 
      
      
      //setTimeout(function(){ showScatterPlot(players); }, 1000);
      $(window).resize(function(evt) {
          if ( $("#statsModal").hasClass("in") ) {
              createD3Visualization();
          }
      });
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
					if (distance < 0.0005 && zoom > 16) {
                        $('#nextModal').modal('show');
                        Session.set("distance", distance);
                        Session.set("solved", new Date());
                        Session.set("pauseTime", true);
                    }
					//else {console.log("still " + distance + " away");}
					
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
    
    Template.photoalbum.events({
       "click .deletePic": function() {
             Meteor.users.update(Meteor.userId(), {$pull: {"profile.pictures": this} });  
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
                //console.log("This is the value: " + value);
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