/**
 * This is an example of a basic node.js script that performs
 * the Authorization Code oAuth2 flow to authenticate against
 * the Spotify Accounts.
 *
 * For more information, read
 * https://developer.spotify.com/web-api/authorization-guide/#authorization_code_flow
 */

const fetch = require('node-fetch');
var express = require('express'); // Express web server framework
var request = require('request'); // "Request" library
var cors = require('cors');
var querystring = require('querystring');
var cookieParser = require('cookie-parser');

var client_id = 'f50ac1b8605544a6894cdbb4eb45c8f3'; // Your client id
var client_secret = 'd2cc59d25baf49ac94e939cbf23cb24a'; // Your secret
var redirect_uri = 'http://localhost:8888/callback'; // Your redirect uri

var access_token;


/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
var generateRandomString = function (length) {
  var text = '';
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

var stateKey = 'spotify_auth_state';

var app = express();

app.use(express.static(__dirname + '/public'))
  .use(cors())
  .use(cookieParser());

app.get('/login', function (req, res) {
  console.log('success');
  var state = generateRandomString(16);
  res.cookie(stateKey, state);

  // your application requests authorization
  var scope = 'user-read-private user-read-email';
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: client_id,
      scope: scope,
      redirect_uri: redirect_uri,
      state: state
    }));
});

app.get('/callback', function (req, res) {

  // your application requests refresh and access tokens
  // after checking the state parameter
  console.log('successCallback');
  var code = req.query.code || null;
  var state = req.query.state || null;
  var storedState = req.cookies ? req.cookies[stateKey] : null;

  if (state === null || state !== storedState) {
    res.redirect('/#' +
      querystring.stringify({
        error: 'state_mismatch'
      }));
  } else {
    res.clearCookie(stateKey);
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code'
      },
      headers: {
        'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
      },
      json: true
    };

    request.post(authOptions, function (error, response, body) {
      if (!error && response.statusCode === 200) {

        access_token = body.access_token;
        var refresh_token = body.refresh_token;

        var options = {
          url: 'https://api.spotify.com/v1/me',
          headers: { 'Authorization': 'Bearer ' + access_token },
          json: true
        };

        // use the access token to access the Spotify Web API
        request.get(options, function (error, response, body) {
          console.log(body);
        });

        // we can also pass the token to the browser to make requests from there
        res.redirect('/#' +
          querystring.stringify({
            access_token: access_token,
            refresh_token: refresh_token
          }));
      } else {
        res.redirect('/#' +
          querystring.stringify({
            error: 'invalid_token'
          }));
      }
    });
  }
});

app.get('/refresh_token', function (req, res) {

  // requesting access token from refresh token
  var refresh_token = req.query.refresh_token;
  var authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: { 'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64')) },
    form: {
      grant_type: 'refresh_token',
      refresh_token: refresh_token
    },
    json: true
  };

  request.post(authOptions, function (error, response, body) {
    if (!error && response.statusCode === 200) {
      var access_token = body.access_token;
      res.send({
        'access_token': access_token
      });
    }
  });
});

var bodyParser = require("body-parser");
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.post('/search', async (req, res) => {
  //console.log(req);
  console.log("initiating a search");
  console.log(`access_token : ${access_token}`);
  console.log(req.body.search);

  let url = new URL("https://api.spotify.com/v1/search")
  url.searchParams.append('q', req.body.search);
  url.searchParams.append('type', 'track');
  url.searchParams.append('limit', 1);

  const topTrack = await fetch(url.href, {
    method: 'get',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + access_token },
  })

  const topTrackJson = await topTrack.json();
  console.log("id: " + topTrackJson.tracks.items[0].id);
  console.log("name:" + topTrackJson.tracks.items[0].name);
  let id = topTrackJson.tracks.items[0].id;

  let happy = await metrics(id, access_token, "happiness");
  let speed = await metrics(id, access_token, "speed");

  happy = Math.round(happy * 10);
  speed = Math.round(speed * 10);

  console.log("Happiness factor (0-1): " + await metrics(id, access_token, "happiness"));
  console.log("Speed factor (0-1): " + await metrics(id, access_token, "any"));
  console.log("Happiness factor (0-10): " + happy);
  console.log("Speed factor (0-10): " + speed);

  let link = getLinkFromDict(happy, speed);
  console.log(link);

  setTimeout(res.redirect(link), 2000);
});


async function metrics(id, access_token, type) {
  let url = new URL('https://api.spotify.com/v1/audio-features/' + id);

  const attributes = await fetch(url.href, {
    method: 'get',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + access_token },
  })

  const attributesJson = await attributes.json();

  if (type === "happiness") {
    return await attributesJson.valence;
  } else {
    return await ((attributesJson.danceability + attributesJson.energy) / 2);
  }
}

function getLinkFromDict(happy, speed) {
  if (speed >= 8) {
    if (happy >= 10) {
      return ('https://www.youtube.com/watch?v=dQw4w9WgXcQ&ab_channel=RickAstleyVEVO');
    } else if (happy >= 9) {
      return ('https://www.youtube.com/watch?v=4DcGBE-F9hk');
    } else if (happy >= 8) {
      return ('https://www.youtube.com/watch?v=4DcGBE-F9hk');
    } else if (happy >= 7) {
      return ('http://experiencecornelius.com/');
    } else if (happy >= 6) {
      return ('http://www.theonion.com/');
    } else if (happy >= 5) {
      return ('https://www.coolmathgames.com/0-worlds-hardest-game');
    } else if (happy >= 4) {
      return ('https://www.youtube.com/watch?v=h8ctkfSx6R0');
    } else if (happy >= 3) {
      return ('https://zoomquilt.org/');
    } else if (happy >= 2) {
      return ('https://www.youtube.com/watch?v=8arOzjb9aFQ');
    } else if (happy >= 1) {
      return ('http://www.intotime.com/');
    } else {
      return ('https://screamintothevoid.com/');
    }
  } else if (speed >= 6) {
    if (happy >= 10) {
      return ('https://www.staggeringbeauty.com/');
    } else if (happy >= 9) {
      return ('https://www.youtube.com/watch?v=cpBrAS168Jo');
    } else if (happy >= 8) {
      return ('https://quickdraw.withgoogle.com/');
    } else if (happy >= 7) {
      return ('http://www.republiquedesmangues.fr/');
    } else if (happy >= 6) {
      return ('http://www.slither.io/');
    } else if (happy >= 5) {
      return ('https://en.wikipedia.org/wiki/List_of_conspiracy_theories');
    } else if (happy >= 4) {
      return ('https://www.coolmathgames.com/0-run');
    } else if (happy >= 3) {
      return ('https://thisissand.com/');
    } else if (happy >= 2) {
      return ('https://freerice.com/');
    } else if (happy >= 1) {
      return ('https://www.google.com/doodles/john-venns-180th-birthday');
    } else {
      return ('http://dontevenreply.com/');
    }
  } else if (speed >= 4) {
    if (happy >= 10) {
      return ('http://theofficestaremachine.com/');
    } else if (happy >= 9) {
      return ('http://www.rrrgggbbb.com/');
    } else if (happy >= 8) {
      return ('http://littlealchemy.com/');
    } else if (happy >= 7) {
      return ('https://www.pointerpointer.com/');
    } else if (happy >= 6) {
      return ('http://www.incredibox.com/');
    } else if (happy >= 5) {
      return ('https://www.boredbutton.com/');
    } else if (happy >= 4) {
      return ('https://uselessfacts.net/');
    } else if (happy >= 3) {
      return ('https://www.poptropica.com/');
    } else if (happy >= 2) {
      return ('https://food.unl.edu/newsletters/images/assorted-dry-beans.png');
    } else if (happy >= 1) {
      return ('https://www.youtube.com/watch?v=8RZfZ3qpAMk');
    } else {
      return ('http://111111111111111111111111111111111111111111111111111111111111.com/');
    }

  } else if (speed >= 2) {
    if (happy >= 10) {
      return ('http://www.electricboogiewoogie.com/');
    } else if (happy >= 9) {
      return ('https://en.akinator.com/');
    } else if (happy >= 8) {
      return ('http://www.kanyezone.com/');
    } else if (happy >= 7) {
      return ('https://isitchristmas.com/');
    } else if (happy >= 6) {
      return ('http://hackertyper.com/');
    } else if (happy >= 5) {
      return ('https://www.music-map.com/');
    } else if (happy >= 4) {
      return ('https://www.astrology-zodiac-signs.com/');
    } else if (happy >= 3) {
      return ('http://flashbynight.com/drench/');
    } else if (happy >= 2) {
      return ('http://www.laughfactory.com/jokes/latest-jokes');
    } else if (happy >= 1) {
      return ('http://1000.chromeexperiments.com/#/experiment/canopy');
    } else {
      return ('http://beesbeesbees.com/');
    }

  } else {
    if (happy >= 10) {
      return ('http://stars.chromeexperiments.com/');
    } else if (happy >= 9) {
      return ('https://explore.org/livecams/cats/kitten-rescue-cam');
    } else if (happy >= 8) {
      return ('https://www.buzzfeed.com/marthaharrietlewis/pick-some-pantone-colours-and-well-guess-your-aes-7gem36xaby');
    } else if (happy >= 7) {
      return ('https://www.howmanypeopleareinspacerightnow.com/');
    } else if (happy >= 6) {
      return ('https://coolors.co/');
    } else if (happy >= 5) {
      return ('https://asoftmurmur.com/');
    } else if (happy >= 4) {
      return ('https://www.onemotion.com/fold-cut-paper/');
    } else if (happy >= 3) {
      return ('https://www.howstuffworks.com/');
    } else if (happy >= 2) {
      return ('http://www.donothingfor2minutes.com/');
    } else if (happy >= 1) {
      return ('https://www.developgoodhabits.com/uplifting-quotes/');
    } else {
      return ('https://blahtherapy.com/');
    }
  }
}


console.log('Listening on 8888');
app.listen(8888);
