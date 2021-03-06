/**
 * EventController
 *
 * @module      :: Controller
 * @description	:: A set of functions called `actions`.
 *
 *                 Actions contain code telling Sails how to respond to a certain type of request.
 *                 (i.e. do stuff, then send some JSON, show an HTML page, or redirect to another URL)
 *
 *                 You can configure the blueprint URLs which trigger these actions (`config/controllers.js`)
 *                 and/or override them with custom routes (`config/routes.js`)
 *
 *                 NOTE: The code you write here supports both HTTP and Socket.io automatically.
 *
 * @docs        :: http://sailsjs.org/#!documentation/controllers
 */

module.exports = {
    
  


  /**
   * Overrides for the settings in `config/controllers.js`
   * (specific to EventController)
   */
  _config: {

    pluralize: true,
    blueprints: {
      rest: true
    }

  },


  findEvents: function(req, res) {

    var q = req.param('artist');

    Artist.findOne({ RAname: q }).done(function(error, artist) {

      if(error) {
        res.json({ success: false, message: error }, 500);
      }

      if(artist) {
        var eventsIDs = artist.events;
        var upcomingEvents = [];
        var pastEvents = [];
        Event.findByEventIDIn(eventsIDs).sort('eventStartDate ASC').done(function(err, events) {

          if(err) {
            res.json({ success: false, message: err }, 500);
          }

          var now = new Date();
          for(var i in events) {
            var event = events[i];
            var evntDate = new Date(event.eventStartDate);
            if(evntDate < now) {
              pastEvents.push(event);
            } else {
              upcomingEvents.push(event);
            }
          }

          res.json({ success: true, artist: artist, data: { upcoming: upcomingEvents, past: pastEvents } });

        });
      } else {
        res.json({ success: false, message: 'Artist not found' }, 404);
      }

    });

  },

  mineEvents: function(req, res) {

    var artist = req.param('artist');
    var request = require('request');
    var cheerio = require('cheerio');
    var raEventsUrl = 'http://www.residentadvisor.net/dj/'+artist+'/dates';

    var requestArgs = {
      url: raEventsUrl,
      followRedirect: true
    }
    request(requestArgs, function(err, resp, html) {

      if(err) {
        res.json({ success: false, message: err }, 500);
      }

      var upcomingEvents = [];

      if(resp.request._redirectsFollowed) {
        res.json({ success: false, message: 'Unable to find artist' }, 404);
      } else {
        var $ = cheerio.load(html)('div, li');

        $.map(function(i, divElm) {

          var minedEvent = {};

          // Getting the first of upcoming events
          /*
          if(cheerio(divElm).hasClass('im-list')) {
            var firstUpcomingDiv = cheerio(divElm).next('div');
            var urlTag = cheerio(firstUpcomingDiv).find('a[itemprop="url"]');
            var eventUrl = urlTag.attr('href');
            var eventID = eventUrl.split('?')[1];
            var eventName = urlTag.text();
            var eventNameSplitted = eventName.split(' at ');
            var eventLocation = eventNameSplitted[eventNameSplitted.length-1];
            eventNameSplitted.pop();
            eventName = eventNameSplitted.join(' at ');
            var startDate = cheerio(firstUpcomingDiv).find('time[itemprop="startDate"]').attr('datetime').split('T')[0];
            var endDate = cheerio(firstUpcomingDiv).find('time[itemprop="endDate"]').attr('datetime');
            if(endDate != undefined)
              endDate = endDate.split('T')[0];
            minedEvent = {
              eventID: eventID,
              eventName: eventName,
              location: {
                name: eventLocation,
                address: null
              },
              startDate: startDate,
              endDate: endDate || null,
              eventUrl: 'http://www.residentadvisor.net'+eventUrl
            };
          }
          */

          // Getting the remaining upcoming events
          if(cheerio(divElm).attr('itemtype') == 'http://data-vocabulary.org/Event') {
            var aLinks = cheerio(divElm).find('a[itemprop="url"], a[itemprop="url summary"]');
            var eventUrl = cheerio(aLinks).attr('href');
            var evntID = eventUrl.split('?')[1];
            var evntName = cheerio(aLinks).text();
            var evntLocation = cheerio(divElm).find('span[itemprop="name"] > a').text() || cheerio(divElm).find('span[itemprop="name"]').text() ||
              (cheerio(divElm).find('h1[itemprop="summary"] > span a:nth-child(2)').text() != '' ? cheerio(divElm).find('h1[itemprop="summary"] > span a:nth-child(1)').text() : cheerio(divElm).find('h1[itemprop="summary"] > span').text());
            var evntAddress = cheerio(divElm).find('span[itemprop="location"] span[itemprop="address"] a').text() ||
              cheerio(divElm).find('h1[itemprop="summary"] > span a:nth-child(2)').text() ||
              cheerio(divElm).find('h1[itemprop="summary"] > span a:nth-child(1)').text();
            var startDate = cheerio(divElm).find('time[itemprop="startDate"]')
              .attr('datetime').split('T')[0];
            var endDate = cheerio(divElm).find('time[itemprop="endDate"]')
              .attr('datetime');
            if(endDate != undefined)
              endDate = endDate.split('T')[0];
            minedEvent = {
              eventID: evntID,
              eventName: evntName,
              location: {
                name: evntLocation,
                address: evntAddress
              },
              startDate: startDate,
              endDate: endDate || null,
              eventUrl: 'http://www.residentadvisor.net'+eventUrl
            };
          }

          if(minedEvent.eventID) {
            upcomingEvents.push(minedEvent);
          }

        });

        Artist.findOne({ RAname: artist }).done(function(err, artist) {
          if(!err && artist) {
            res.json({ success: true, artist: artist, data: upcomingEvents });
          } else {
            res.json({ success: true, artist: null, data: upcomingEvents });
          }
        });
      }

    });

  },

  addEvent: function(req, res) {

    var eventData = req.body;
    var newEvent = {
      eventID: eventData.eventID,
      eventName: eventData.eventName,
      eventLocation: eventData.location.name,
      eventAddress: eventData.location.address,
      eventStartDate: eventData.startDate,
      eventEndDate: eventData.endDate,
      eventUrl: eventData.eventUrl
    };
    Event.create(newEvent).done(function(err, newEvent) {
      if(err) {
        res.json({ success: false, message: err }, 400);
      } else {
        res.json({ success: true, data: newEvent });
      }
    });

  },

  updateEvent: function(req, res) {

    var eventID = req.param('eventID');
    var eventData = req.body;
    Event.findOne({ eventID: eventID }).done(function(err, foundEvent) {
      if(foundEvent) {
        foundEvent.eventName = eventData.eventName;
        foundEvent.eventLocation = eventData.location.name;
        foundEvent.eventAddress = eventData.location.address;
        foundEvent.eventStartDate = eventData.startDate;
        foundEvent.eventEndDate = eventData.endDate;
        foundEvent.save(function(err) {
          if(err) {
            res.json({ success: false, message: err }, 400);
          } else {
            res.json({ success: true, data: foundEvent });
          }
        });
      } else {
        res.json({ success: false, message: 'Event not found' }, 404);
      }
    });

  },

  destroyEvent: function(res, req) {

    var eventID = req.param('eventID');
    Event.findOne({ eventID: eventID }).done(function(err, event){
      if(event) {
        event.destroy(function(err) {
          if(err) {
            res.json({ success: false, message: err }, 400);
          } else {
            res.json({ success: true, data: event });
          }
        })
      } else {
        res.json({ success:false, message: 'Event not found' }, 404);
      }
    });

  }

  
};
