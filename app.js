'use strict'
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


var sgTransport = require('nodemailer-sendgrid-transport');



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


app.use(passport.initialize());
app.use(passport.session());

// =========================================================================
// LOCAL SIGNUP ============================================================
// =========================================================================
// we are using named strategies since we have one for login and one for signup
// by default, if there was no name, it would just be called 'local'

passport.use(
	'local-signup',
	new LocalStrategy({
		// by default, local strategy uses username and password, we will override with email
		usernameField : 'email',
		passwordField : 'password',
		passReqToCallback : true // allows us to pass back the entire request to the callback
	},
	function(req, email, password, done) {
		// find a user whose email is the same as the forms email
		// we are checking to see if the user trying to login already exists
		connection.query('SELECT * FROM '+TABLE+' WHERE email = ?', [email],
		 function(err, results) {
			if (err)
				return done(err);
			if (results.length) {
				return done(null, false, req.flash('signupMessage', 'That email is already taken.'));
			} 
			else {
				// if there is no user with that username
				// create the user
				var usuario = new Usuario(); 
				var params = req.body;
				
				usuario.nombre = params.nombre;
				usuario.apellido = params.apellido;
				usuario.email = params.email;
				usuario.password = sha1(params.password);
				

				var insertQuery = "INSERT INTO usuarios (email,nombre,apellido,password) values (?,?,?,?)";
				console.log(insertQuery)
				connection.query(insertQuery,[usuario.email, usuario.nombre, usuario.apellido, usuario.password],function(err, results) {
					if (err) {
						return done(err);
					}
					usuario.idusuario = results.insertId;

					return done(null, usuario);
				});
			}
		});
	})
);
passport.use(
	'local-login',
	new LocalStrategy({
		// by default, local strategy uses username and password, we will override with email
		usernameField : 'email',
		passwordField : 'password',
		passReqToCallback : true // allows us to pass back the entire request to the callback
	},
		function(req,email,password, done){
  			connection.query('SELECT * FROM '+TABLE+' WHERE email = ?', [email], 
  				function(error, results, fields){
					  console.log(results[0]);
    				if (error) {
						return done(error);
						
					} 
					if (!results.length) {
						return done(null, false, req.flash('loginMessage', 'No user found.'));
					}
					// if the user is found but the password is wrong
					if (sha1(password) != (results[0].password)){
						return done(null, false, req.flash('loginMessage', 'Oops! Wrong password.')); // create the loginMessage and save it to session as flashdata						
					}
					// all is well, return successful user
					usuario = new Usuario(results[0].idusuario, results[0].nombre, results[0].apellido, results[0].email, results[0].password);
					return done(null, usuario);
					// console.log(usuario);
				  }
			);
		}
	)
);

passport.serializeUser(function(usuario, done) {
  done(null, usuario.idusuario);
});

passport.deserializeUser(function(id, done) {
	connection.query("SELECT * FROM usuarios WHERE idusuario = ? ",[id], function(err, rows){
		done(err, rows[0]);
	});
});



// Routes
app.get('/', function(req, res) {
  res.render('index', { 
	  title: 'Express', 
	  user: req.user });
});


app.get('/login',isLoggedIn, function(req,res){
  res.render('login', {
    user: req.usuario
  });
  
  
});
app.post('/login', 
  passport.authenticate('local-login', { 
	successRedirect : '/', // redirect to the secure profile section
	failureRedirect : '/login', // redirect back to the signup page if there is an error
	failureFlash : true // allow flash messages
   }),
  function(req, res) {
    console.log("hello");
	
				if (req.body.remember) {
				  req.session.cookie.maxAge = 1000 * 60 * 3;
				} else {
				  req.session.cookie.expires = false;
				}
			res.redirect('/');
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

app.get('/signup', isLoggedIn, function(req, res) {
  	res.render('signup', {
    user: req.usuario
  });
});

// process the signup form
app.post('/signup', passport.authenticate('local-signup', {
	successRedirect : '/', // redirect to the secure profile section
	failureRedirect : '/signup', // redirect back to the signup page if there is an error
	failureFlash : true // allow flash messages
}));


// app.post('/signup',function(req, res) {
//   var usuario = new Usuario(); 
// 	var params = req.body;

// 	usuario.nombre = params.nombre;
// 	usuario.apellido = params.apellido;
// 	usuario.email = params.email;
//   	usuario.password = sha1(params.password);
  
//   var query = connection.query('INSERT INTO '+DATABASE+'.'+TABLE+' SET ?', usuario, function(error, results, fields){
// 		if (error) throw error;
// 		else{
// 			res.status(200).send({ usuario : usuario});
// 		}
// 	});
// });
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
	// console.log(req.body.email);
	var email = req.body.email;
		
  	async.waterfall([
    		function(done) {
      	crypto.randomBytes(20, function(err, buf) {
        	var token = buf.toString('hex');
        	done(err, token);
	  	});
	},
	function(token, done) {
		console.log(token.length);
		//buscar al usuario por email
		connection.query('SELECT * FROM '+TABLE+' WHERE email = ?', [email], (error, results)=>{
			if(error){
				return done(err);
			}
			if(!results.length){
				return done(null, false, req.flash('signupMessage', 'Este correo no existe.'));
			}
			else{
				var user = new Usuario(results[0].idusuario, results[0].nombre, results[0].apellido, results[0].email, results[0].password);
				var expires = Date.now()+3600000;
				connection.query('UPDATE '+TABLE+' SET resetPasswordToken = ?, resetPasswordExpires = ? WHERE idusuario = ?',[token,expires, results[0].idusuario],(error, results, fields)=>{
					var result = JSON.stringify(results);
					
					if (error){
						console.log("ERROR"+error);
						return done(null, false, req.flash('MysqlError', "Error al ejecutar query"));
					}
					if(!result.length){
						return done(null, false, req.flash('ResponseNull', "Resultado nulo en la respuesta"));
					}
					else{
						return done( error, token, user);
						next();
					}
				});
			}
		} );
	},
	function (token,user,done){
		// user=JSON.stringify(user);
		
		var smtpTransport = nodemailer.createTransport({
			service: 'SendGrid',
			auth: {
				user: 'ivanrojo07',
				pass: 'Qwerty123'
			}
		});

		// var options = {
		// 	auth: {
		// 		api_key: 'Qwerty123'
		// 	}
		// }
		 
		// // or 
		 
		// // username + password 
		// var options = {
		// 	auth: {
		// 		api_user: 'ivanrojo07',
		// 		api_key: 'Qwerty123'
		// 	}
		// }
			
		// var smtpTransport = nodemailer.createTransport(sgTransport(options));
		

	
		

		var mailOptions = {
			to: user.email,
			from: 'irojo@byw-si.com.mx',
			subject: 'Node.js Password Reset',
			text: 'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
				'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
				'http://' + req.headers.host + '/reset/' + token + '\n\n' +
				'If you did not request this, please ignore this email and your password will remain unchanged.\n'
		};
		smtpTransport.sendMail(mailOptions, function(err) {
			req.flash('info', 'An e-mail has been sent to ' + user.email + ' with further instructions.');
			if(err){
				console.log(err);
			}
			done(err, 'done');
		});
	}
], function(err) {
	if (err) return next(err);
	res.redirect('/forgot');
});
});

function isLoggedIn(req, res, next) {
	
		// if user is authenticated in the session, carry on
		if (!req.isAuthenticated())
			return next();
	
		// if they aren't redirect them to the home page
		res.redirect('/');
	}
	

app.listen(app.get('port'), function() {
  console.log('Express server listening on port ' + app.get('port'));
});