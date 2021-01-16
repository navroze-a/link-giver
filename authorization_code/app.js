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
var generateRandomString = function(length) {
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

app.get('/login', function(req, res) {

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

app.get('/callback', function(req, res) {

  // your application requests refresh and access tokens
  // after checking the state parameter

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

    request.post(authOptions, function(error, response, body) {
      if (!error && response.statusCode === 200) {

        access_token = body.access_token;
        var refresh_token = body.refresh_token;

        var options = {
          url: 'https://api.spotify.com/v1/me',
          headers: { 'Authorization': 'Bearer ' + access_token },
          json: true
        };

        // use the access token to access the Spotify Web API
        request.get(options, function(error, response, body) {
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

app.get('/refresh_token', function(req, res) {

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

  request.post(authOptions, function(error, response, body) {
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

app.post('/search', async(req, res) => {
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
        headers: { 'Content-Type': 'application/json' , 'Authorization' : 'Bearer ' + access_token},
    })

  const topTrackJson = await topTrack.json();
  console.log("id: " + topTrackJson.tracks.items[0].id);
  console.log("name:" + topTrackJson.tracks.items[0].name);
  let id = topTrackJson.tracks.items[0].id;
  metrics(id, access_token);
});


async function metrics(id, access_token){
  let url = new URL('https://api.spotify.com/v1/audio-features/' + id);

  const attributes = await fetch(url.href, {
    method: 'get',
    headers: { 'Content-Type': 'application/json' , 'Authorization' : 'Bearer ' + access_token},
})

const attributesJson = await attributes.json();
console.log(attributesJson);

}

async function produceLinkVector(attributes_json_format) {
  let danceability = attributes_json_format.danceability;
  let energy = attributes_json_format.energy;
  let mode = attributes_json_format.mode;
  let tempo = attributes_json_format.tempo;
  let valence = attributes_json_format.valence;

  // make vectors here!

}


console.log('Listening on 8888');
app.listen(8888);
