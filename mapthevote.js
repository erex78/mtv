$(document).ready(function() {
  //
  // Creates and returns the basic mapbox Map object.
  //
  var map; 
  function setup_map(context) {
    mapboxgl.accessToken = 'pk.eyJ1IjoiZWdub3IiLCJhIjoiY2pqbHozaHlvMmIyZzNxcXNtNDZpenFkdSJ9._cdVd9xmZjZe0eQl5jUHSA';

    map = context.map = new mapboxgl.Map({
      container: document.getElementById('main'),
      style: 'mapbox://styles/mapbox/dark-v9',
      hash: true,
      center: [-97.573, 31.015],
      zoom: 7
    });

    context.map.on('load', function() {
      context.map.addSource('mapthevote_tiles', {
        type: 'vector',
        url: 'mapbox://egnor.cqxyiqw6'
      });

      context.map.addSource('mapthevote_updates', {
        type: 'geojson',
        data: {type: 'FeatureCollection', features: []}
      });

      context.map.addLayer({
        id: 'update_circles',
        type: 'circle',
        source: 'mapthevote_updates',
        paint: {
          'circle-color': ["get", "color"],
          'circle-radius': 6
        }
      });

      context.map.addLayer({
        id: 'prospect_circles',
        type: 'circle',
        source: 'mapthevote_tiles',
        'source-layer': 'hdbscan_labels',
        paint: {
          'circle-color': '#ff4444',
          'circle-radius': 5
        }
      }, 'road-path-bg');

      context.map.addLayer({
        id: 'voter_dots',
        type: 'circle',
        source: 'mapthevote_tiles',
        'source-layer': 'voters_join',
        paint: {
          'circle-color': '#00aaff',
          'circle-radius': 4
        }
      }, 'prospect_circles');

      context.map.addLayer({
        id: 'address_dots',
        type: 'circle',
        source: 'mapthevote_tiles',
        'source-layer': 'all_addresses',
        paint: {
          'circle-color': '#aaaaaa',
          'circle-radius': 3
        }
      }, 'voter_dots');
    });
  }

  //
  // Sets up the address box geocoder and other map widgets.
  //
  function setup_map_controls(context) {
    var mapbox_geocoder = new MapboxGeocoder({
      accessToken: mapboxgl.accessToken,
      placeholder: 'Enter address',
      trackProximity: true,
      flyTo: false,
    });

    // Workaround for https://github.com/mapbox/mapbox-gl-js/issues/4041
    mapbox_geocoder.on('result', function(event) {
      if (event.result.bbox) {
        bb = event.result.bbox;
        context.map.fitBounds([[bb[0], bb[1]], [bb[2], bb[3]]], {duration: 0});
      } else {
        context.map.flyTo({center: event.result.center, zoom: 16, duration: 0});
      }
      context.map.getCanvas().focus();  // Revert focus after entering.
    });

    context.map.addControl(mapbox_geocoder);

    // Make pressing ESC unfocus the address box.
    var input_element = mapbox_geocoder._inputEl;
    input_element.addEventListener('keydown', function(event) {
      if (event.keyCode == 27) context.map.getCanvas().focus();
    });

    // Make focusing the address box select-all for replacement.
    // https://stackoverflow.com/a/24589806 -- TODO(egnor): Improve on mobile?
    input_element.addEventListener('focus', function(event) {
      var select = function(event) {
        input_element.select();
        input_element.removeEventListener('click', select);
        input_element.removeEventListener('keyup', select);
      }
      input_element.addEventListener('click', select);
      input_element.addEventListener('keyup', select);
    });

    // Basic map navigation and location-tracking controls.
    context.map.addControl(new mapboxgl.NavigationControl());
    context.map.addControl(new mapboxgl.GeolocateControl({
      positionOptions: {enableHighAccuracy: true},
      trackUserLocation: true
    }));
  }

  //
  // Adds handlers for clicking on map items.
  //
  function setup_map_popups(context) {
    context.map.on('click', function (event) {
      // Of all the nearby points, take the closest.
      var ep = event.point;
      var box = [[ep.x - 10, ep.y + 10], [ep.x + 10, ep.y - 10]]
      var features = context.map.queryRenderedFeatures(box, {
        layers: ['prospect_circles']
      });
      var nearest = null, nearest_distance2 = 1e6;
      for (var i = 0; i < features.length; ++i) {
        var fp = context.map.project(features[i].geometry.coordinates);
        var fd2 = (fp.x - ep.x) ** 2 + (fp.y - ep.y) ** 2;
        if (fd2 < nearest_distance2) {
          nearest = features[i];
          nearest_distance2 = fd2;
        }
      }

      if (nearest) {
        var popup = new mapboxgl.Popup()
        popup.setLngLat(nearest.geometry.coordinates)
        popup.setDOMContent(make_popup_content(context, nearest));
        popup.addTo(context.map);
        context.last_popup = popup;
        context.last_popup_feature = nearest;
      }
    });
        //boxzoom interaction
    map.on('boxzoomend', function(event){
    

      if (map.getZoom()<12){return;}

      var ne_point = map.project(event.boxZoomBounds._ne);
      var sw_point = map.project(event.boxZoomBounds._sw);
      var box = [ne_point, sw_point];

      var features = map.queryRenderedFeatures(box, {
        layers: ['prospect_circles']
      });
      var fLength = features.length;
      if (fLength == 0){
        return;
      }

      var overlay = document.getElementById('map-overlay');
      overlay.style.zIndex = 10; 
      overlay.innerHTML = "<img id='close-button' src='x-symbol.svg'> <div id='overlayRows'>";
      overlay.innerHTML += "<button id='copy-button'>Copy</button>";
      var closeButton = document.getElementById("close-button")
      closeButton.addEventListener("click", function(event){
        overlay.style.zIndex = -10; 
        overlay.innerHTML = ""
      })
      var button = document.getElementById("copy-button");
      var overlayRows = document.getElementById('overlayRows')
    
      button.addEventListener("click", function (event) {
         navigator.clipboard.writeText(overlayRows.innerText)
      });
      

      var addresses = []; 
      for (var i=0; i<fLength; i++){
        addresses[i] = features[i].properties.address;
        overlayRows.innerHTML += ' <a href="https://www.google.com/maps/search/?api=1&map_action=pano&query=' + (addresses[i].split(" ").join("+")).toString() + '" target="_blank">' + addresses[i] +
        '</a></br>'
      }
      console.log(addresses); 
    });

    context.map.on('mouseenter', 'map-the-vote', function() {
      context.map.getCanvas().style.cursor = 'pointer';
    });

    context.map.on('mouseleave', 'map-the-vote', function() {
      context.map.getCanvas().style.cursor = '';
    });
  }

  //
  // Creates and returns popup contents (DOM element) for a location.
  //
  function make_popup_content(context, feature) {
    last_update = context.address_to_update[feature.properties.address];
    if (!last_update) last_update = {action: "none"};

    var action_html = {
      none: "No contact recorded yet.",
      filled: "☑️ Filled out the form!",
      nothome: "🏚️ Nobody was home...",
      already: "🤷 Already registered.",
      refused: "🤐 Refused to talk.",
    };

    var action_button_order = ["filled", "nothome", "already", "refused"];

    var last_update_time = "";
    if (last_update.time) {
      var d = new Date(last_update.time * 1000);
      last_update_time = "[" + d.toLocaleString(undefined, 
         {month: "numeric", day: "numeric", hour: "numeric", minute: "numeric"})
             .replace(" AM", "am").replace(" PM", "pm").replace(",", "") + "] ";
    }

    var content = $("<div class='popup'/>").append(
        $("<div class='popup-title'/>").text(feature.properties.address),
        $("<a class='popup-register' href='https://register2vote.org/'" +
          " target='_blank'><img src='register2vote.png'/></a>"),
        $("<span class='popup-last-update popup-last-update-time'/>")
            .text(last_update_time),
        $("<span class='popup-last-update'/>")
            .addClass("popup-last-update-" + last_update.action)
            .text(action_html[last_update.action]));

    function on_action_click(event) {
      $(event.target).addClass('popup-action-selected');
      $.post('mapthevote_data', JSON.stringify(event.data))
    }

    for (var i = 0; i < action_button_order.length; ++i) {
      var action = action_button_order[i];
      content.append($("<div class='popup-action'/>")
          .append(action_html[action])
          .click({
            action: action,
            geometry: feature.geometry,
            properties: feature.properties
          }, on_action_click));
    }

    content.append($("<div class='popup-footnote'/>")
        .text(feature.properties.county + ' - precinct ' +
              feature.properties.precinct));

    return content[0];
  }

  //
  // Start listening for contact update notifications from the server.
  //
  function setup_update_listener(context) {
    function update_map() {
      if (!context.map.loaded()) {
        setTimeout(update_map, 100);  // (Ugh...)
        return;
      }

      var action_color = {
        filled: '#00cc00',
        nothome: '#880000',
        already: '#ff00ff',
        refused: '#000000',
      };

      new_features = [];
      for (var key in context.address_to_update) {
        var update = context.address_to_update[key];
        new_features.push({
          type: 'Feature',
          geometry: update.geometry,
          properties: {color: action_color[update.action]}
        });
      }

      context.map_update_pending = false;
      context.map.getSource('mapthevote_updates').setData(
          {type: 'FeatureCollection', features: new_features});
    }

    function on_message(event) {
      var update_data = JSON.parse(event.data);
      context.address_to_update[update_data.properties.address] = update_data;

      if (context.last_popup_feature && context.last_popup &&
          context.last_popup_feature.properties.address ==
              update_data.properties.address) {
        context.last_popup.setDOMContent(make_popup_content(
            context, context.last_popup_feature));
      }

      if (!context.map_update_pending) {
        setTimeout(update_map, 100);  // Defer/batch updating for efficiency.
        context.map_update_pending = true;
      }
    }

    function on_error(event) {
      // Chrome won't reconnect if the server gives a 5xx :-(.
      if (event.target.readyState == EventSource.CLOSED)
        setTimeout(setup_event_source, 2000);
    }

    function setup_event_source() {
      if (context.event_source) context.event_source.close();
      context.event_source = new EventSource('mapthevote_data');
      context.event_source.onmessage = on_message;
      context.event_source.onerror = on_error;
    }

    setup_event_source();
  }

  function setup() {
    var context = {
      map: null,
      event_source: null,
      address_to_update: {},
      map_update_pending: false,
      last_popup: null,
      last_popup_feature: null,
    }

    setup_map(context);
    setup_map_controls(context);
    setup_map_popups(context);
    setup_update_listener(context);
  }

  setup();
})
