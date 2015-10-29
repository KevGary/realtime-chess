var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var cookieSession = require('cookie-session');

var users = require('./routes/users');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(cookieSession({
  name: 'session',
  keys : [
    "tempKEY1",
    "tempKEY2",
    "tempKEY3"
  ]
}));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/users', users);

//---CODE---
var http = require('http').Server(app);
var io = require('socket.io')(http);
var bcrypt = require('bcrypt');

//db
var db = require('monk')('localhost/xpres-chess');
var Users = db.get('users');
var Games = db.get('games');

//routes 
app.get('/signup', function (req, res, next){
  res.render('signup', {title: "Xpres Chess", errors: [], body: ""});
});

app.post('/signup', function (req, res, next) {
  var errors = [];
  if(req.body.username != "" && req.body.password != ""){
    Users.findOne({username: req.body.username.trim().toLowerCase()})
      .then(function (user) {
        if(user){
          errors.push("User already exists");
          res.render('signup', {title: "Xpres Chess", errors: errors, body: req.body })
        } else {
          var hash = bcrypt.hashSync(req.body.password, 8);
          Users.insert({username: req.body.username.trim().toLowerCase(), password: hash, wins: 0, loses: 0})
            .then(function passingUser (user) {
              // req.session.username = user._id;
              // Games.find({user_ids: {$in: [user._id]}})
              Games.find({})
                .then(function findingAllGames (games) {
                  if(games.length == 0 || games[games.length-1].user_ids.length == 2){
                    Games.insert({user_ids: [user._id]})
                      .then(function renderNewGamePage (newGame) {
                        res.redirect('/' + newGame._id);
                      })
                  } else {
                    Games.update(
                      {_id: games[games.length-1]._id},
                      { $addToSet: { user_ids: user._id}}
                    )
                    res.redirect('/' + games[games.length-1]._id);
                  }
                  req.session.username = games[games.length-1]._id;
                })
            })
        }
      })
  } else {
    errors.push('Username/password cannot be blank');
    res.render('signup', {title: 'Xpres Chess', errors: errors, body: req.body});
  }
});

app.get('/login', function (req, res , next) {
  res.render('login', {title: "Xpres Chess", errors: [], body: ""});
})

app.post('/login', function (req, res, next) {
  var errors = [];
  if(req.body.username != "" && req.body.password != ""){
    Users.findOne({username: req.body.username.trim().toLowerCase()})
      .then(function (user) {
        if(bcrypt.compareSync(req.body.password, user.password) == true){
          return Games.insert({user_ids: [user._id]})
            .then(function passingGameData (gameData) {
              req.session.username = req.body.username.trim().toLowerCase();
              res.redirect('/' + String(gameData._id)); 
            })
        }else{
          errors.push('Username/password incorrect');
          res.render('login', {title: 'Xpress Chess', errors: errors, body: ""});
        }
        if(!user){
          errors.push('Username/password not found');
          res.render('login', {title: 'Xpres Chess', errors: errors, body: ""});
        }
      });
  } else {
    errors.push('Username/password cannot be blank');
    res.render('login', {title: 'Xpres Chess', errors: errors, body: req.body});
  }
});

app.get('/:id', function (req, res) {
  console.log(req.session.username)
  Games.find({_id: req.params.id})
    .then(function passingCurrGame (currGame) {
      res.render('index', {title: 'Xpres Chess', game: currGame});
    })
  io.on('connection', function (socket) {
    Games.find({})
      .then(function joinRoom (gameData) {
        socket.join(String(gameData[gameData.length - 1]));

        console.log(socket.room);
        console.log(String(req.session.username))

        socket.on('move made', function (newPosition) {
          // Games.insert({position: newPosition})
          io.to(String(req.session.username)).emit('move made', newPosition);
        });

        socket.on('chat message', function (msg) {
          io.to(req.session.username).emit('chat message', msg);
        });
      })

    console.log('a user connected');

    socket.on('disconnect', function () {
      console.log('user disconnected');
    });
  });
});


//socket

http.listen(4000, function () {
  console.log('listening on *:4000');
});

//---END CODE---



// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});


module.exports = app;
