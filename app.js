var express = require('express');
var path = require('path');
var favicon = require('static-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var Usuario = require('./models/usuario');
var connection = require('./conexion/conexion');
var DATABASE = 'login';
var TABLE = 'usuarios';
var sha1 = require('sha1');

var session = require('express-session')
var mysql = require('mysql');
var nodemailer = require('nodemailer');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
// var bcrypt = require('bcrypt-nodejs');
var async = require('async');
var crypto = require('crypto');
var flash = require('express-flash');


var app = express();

// Middleware
app.set('port', process.env.PORT || 3700);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(favicon());
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use(cookieParser());
app.use(session({ secret: 'session secret key' }));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

app.use(express.static(path.join(__dirname, 'public')));
var usuario = Usuario;
if (typeof usuario === 'undefined' || usuario === Usuario ) {
  usuario = "";

}
app.use(passport.initialize());
app.use(passport.session());


passport.serializeUser(function(usuario, done) {
  done(null, usuario.idusuario);
});

passport.deserializeUser(function(usuario, done) {
  done(null, usuario);
});

passport.use(new LocalStrategy(function(email,password, done){
  connection.query('SELECT * FROM '+TABLE+' WHERE email = ? AND password = ?', [email, password], 
  function(error, results, fields){
    if (error) {
			return done(err);
		} 
		if (results == "") {
      return done(null,false,{ message: 'contraseña o correo incorrecto. vuelve a intentarlo'});
		}
		else {
      usuario = new Usuario(results[0].idusuario, results[0].nombre, results[0].apellido, results[0].email, results[0].password);
      return done(null,usuario);
		}
  });
}));

// Routes
app.get('/', function(req, res) {
  res.render('index', { title: 'Express', usuario: req.usuario });
  console.log(usuario);
});


app.get('/login', function(req,res){
  res.render('login', {
    usuario: req.usuario
  });
  console.log(usuario)
  
});
app.post('/login', function(req,res, next){
  var email = req.body.email;
	var password = sha1(req.body.password);
  var conn =connection.query('SELECT * FROM '+TABLE+' WHERE email = ? AND password = ?', [email, password], 
  function(error, results, fields){
		if (error) {
			res.status(400).send({ failed : "Error con el servidor"});
      console.log(error);
		} 
		if (results == "") {
      res.status(200).send({ failed : "El usuario o la contraseña son incorrectas" });
      console.log(results);
		}
		else {
      usuario = new Usuario(results[0].idusuario, results[0].nombre, results[0].apellido, results[0].email, results[0].password);
      res.status(200).send({ usuario : usuario });
    }
    
  });
  passport.authenticate('local', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/');
  }
});

//   passport.authenticate('local', function(err,usuario,info){
//     if(err) return next(err)
//     if(!usuario){
//       return res.redirect('/login');
//     }
//     req.logIn(usuario,function(err){
//       if(err) return next (err);
//       else{
//         return res.redirect('/');
//       }
//     });
//   })(req, res, next);

app.get('/signup', function(req, res) {
  res.render('signup', {
    usuario: req.usuario
  });
  console.log(usuario);
});

app.post('/signup',function(req, res) {
  var usuario = new Usuario(); 
	var params = req.body;

	usuario.nombre = params.nombre;
	usuario.apellido = params.apellido;
	usuario.email = params.email;
  usuario.password = sha1(params.password);
  
  var query = connection.query('INSERT INTO '+DATABASE+'.'+TABLE+' SET ?', usuario, function(error, results, fields){
		if (error) throw error;
		else{
			res.status(200).send({ usuario : usuario});
		}
	});
});
app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
});

app.get('/forgot', function(req, res) {
  res.render('forgot', {
    usuario: req.usuario
  });
});

app.post('/forgot', function(req, res, next) {
  async.waterfall([
    function(done) {
      crypto.randomBytes(20, function(err, buf) {
        var token = buf.toString('hex');
        done(err, token);
      });
    },
    function(token, done) {
      User.findOne({ email: req.body.email }, function(err, user) {
        if (!user) {
          req.flash('error', 'No account with that email address exists.');
          return res.redirect('/forgot');
        }

        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

        user.save(function(err) {
          done(err, token, user);
        });
      });
    },
    function(token, user, done) {
      var smtpTransport = nodemailer.createTransport('SMTP', {
        service: 'SendGrid',
        auth: {
          user: '!!! YOUR SENDGRID USERNAME !!!',
          pass: '!!! YOUR SENDGRID PASSWORD !!!'
        }
      });
      var mailOptions = {
        to: user.email,
        from: 'passwordreset@demo.com',
        subject: 'Node.js Password Reset',
        text: 'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
          'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
          'http://' + req.headers.host + '/reset/' + token + '\n\n' +
          'If you did not request this, please ignore this email and your password will remain unchanged.\n'
      };
      smtpTransport.sendMail(mailOptions, function(err) {
        req.flash('info', 'An e-mail has been sent to ' + user.email + ' with further instructions.');
        done(err, 'done');
      });
    }
  ], function(err) {
    if (err) return next(err);
    res.redirect('/forgot');
  });
});

app.listen(app.get('port'), function() {
  console.log('Express server listening on port ' + app.get('port'));
});
