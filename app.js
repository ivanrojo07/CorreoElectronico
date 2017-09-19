'use strict'
var hogan = require('hogan-express');
var api = require('./routes/usuario');

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
var async = require('async');
var crypto = require('crypto');
var flash = require('express-flash');

var app = express();

// Middleware
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(favicon());
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use((req,res,next)=>{
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Headers', 'X-API-KEY, Origin, X-Requested-With, Content-Type, Accept, Access-Control-Request-Method');
	res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS,PUT,DELETE');

	next();
});
app.use(cookieParser());
app.use(session({ secret: 'session secret key' }));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

app.use(express.static(path.join(__dirname, 'public')));


app.use(passport.initialize());
app.use(passport.session());

passport.use(
	'local-signup',
	new LocalStrategy({
		usernameField : 'email',
		passwordField : 'password',
		passReqToCallback : true // allows us to pass back the entire request to the callback
	},
	function(req, email, password, done) {
		connection.query('SELECT * FROM '+TABLE+' WHERE email = ?', [email],
		 function(err, results) {
			if (err)
				return done(err);
			if (results.length) {
				return done(null, false, req.flash('signupMessage', 'That email is already taken.'));
			} 
			else {
				var usuario = new Usuario(); 
				var params = req.body;
				
				usuario.nombre = params.nombre;
				usuario.apellido = params.apellido;
				usuario.email = params.email;
				usuario.password = sha1(params.password);
				

				var insertQuery = "INSERT INTO usuarios (email,nombre,apellido,password) values (?,?,?,?)";
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
		usernameField : 'email',
		passwordField : 'password',
		passReqToCallback : true // allows us to pass back the entire request to the callback
	},
		function(req,email,password, done){
  			connection.query('SELECT * FROM '+TABLE+' WHERE email = ?', [email], 
  				function(error, results, fields){
    				if (error) {
						return done(error);
						
					} 
					if (!results.length) {
						return done(null, false, req.flash('loginMessage', 'No user found.'));
					}
					if (sha1(password) != (results[0].password)){
						return done(null, false, req.flash('loginMessage', 'Oops! Wrong password.')); // create the loginMessage and save it to session as flashdata						
					}
					var usuario = new Usuario(results[0].idusuario, results[0].nombre, results[0].apellido, results[0].email, results[0].password);
					return done(null, usuario);
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
				if (req.body.remember) {
				  req.session.cookie.maxAge = 1000 * 60 * 3;
				} else {
				  req.session.cookie.expires = false;
				}
			res.redirect('/');
  });


app.get('/signup', isLoggedIn, function(req, res) {
  	res.render('signup', {
    user: req.usuario
  });
});

app.post('/signup', passport.authenticate('local-signup', {
	successRedirect : '/', // redirect to the secure profile section
	failureRedirect : '/signup', // redirect back to the signup page if there is an error
	failureFlash : true // allow flash messages
}));

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
	var email = req.body.email;
		
  	async.waterfall([
    		function(done) {
      	crypto.randomBytes(20, function(err, buf) {
        	var token = buf.toString('hex');
        	done(err, token);
	  	});
	},
	function(token, done) {
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
						console.log("ERROR "+error);
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
		
		var smtpTransport = nodemailer.createTransport({
			service: 'gmail',
			auth: {
				user: 'pruebasolvidacontrasena1',
				pass: 'Qwerty123@'
			},
			tls: {
				rejectUnauthorized: false
			}
		});

		var mailOptions = {
			to: user.email,
			subject: 'Cambio de contraseña',
			text: 	'Recibio este correo porque usted (o alguien más) solicito que se reestableciera su contraseña de su cuenta.\n\n'+
					'Por favor da click en el siguiente link, o copialo y pegalo en tu navegador para completar el proceso:\n\n'+
					'http://'+req.headers.host+'/reset/'+token+'\n\n'+
					'Si usted no realizo esta petición, por favor ignore este correo y su contraseña permanecera sin cambios.\n'
			
		};
		smtpTransport.sendMail(mailOptions, function(err) {
			req.flash('info', 'An e-mail has been sent to ' + user.email + ' with further instructions.');
			if(err){
				console.log('Puede ver un Error '+err);
			}
			done(err, 'done');
		});
	}
], function(err) {
	if (err) return next(err);
	res.redirect('/forgot');
});
});

app.get('/reset/:token', function(req, res) {

	connection.query('SELECT * FROM usuarios WHERE resetPasswordToken = ?', [req.params.token], (err,rows)=>{
		if(err){
			console.log("hay error "+err);
		}
		if(rows[0] == undefined){
			res.render('index');
			req.flash('info', 'Password reset token is invalid or has expired.');
		}
		else{
			if(rows[0].resetPasswordExpires <= Date.now()) {
				req.flash('info','El token para reestablecer esta contraseña ha caducado');
				alert('El token para reestablecer esta contraseña ha caducado');
			}
			else{
				res.render('reset',{
					user: req.usuario
				});
			}
			
		}
	});
});

app.post('/reset/:token', function(req, res) {
	async.waterfall([
	  function(done) {
		connection.query('SELECT * FROM usuarios WHERE resetPasswordToken = ?', [req.params.token], (error, results)=>{
			if(error){
				return done(err);
			}
			if(!results.length){
				req.flash('error', 'Password reset token is invalid or has expired.');
				return res.redirect('back');
			}
			else{
				var user = new Usuario(results[0].idusuario, results[0].nombre, results[0].apellido, results[0].email, results[0].password);
  
				user.password = req.body.password;
				user.resetPasswordToken = undefined;
				user.resetPasswordExpires = undefined;

				connection.query('UPDATE '+TABLE+' SET password = ? , resetPasswordToken = ? , resetPasswordExpires = ? WHERE idusuario = ?',[sha1(user.password), user.resetPasswordToken, user.resetPasswordExpires, user.idusuario], (error, result)=>{
					if(error){
						console.log('Error '+error);
					}
					else{
						return done( error, user);
						next();
					}
				});  
		}
	});
	},
	  function(user, done) {
		var smtpTransport = nodemailer.createTransport({
			service: 'gmail',
			auth: {
				user: 'pruebasolvidacontrasena1',
				pass: 'Qwerty123@'
			},
			tls: {
				rejectUnauthorized: false
			}
		});

		var mailOptions = {
		  to: user.email,
		  from: 'passwordreset@demo.com',
		  subject: 'Tu contraseña fue reestablecida correctamente',
		  text: 	'Hola,\n\n'+
		  			'Este es una confirmación de que tu contraseña de tu cuenta '+user.email+' fue recientemente cambiada.\n'
		 
		};
		smtpTransport.sendMail(mailOptions, function(err) {
		  req.flash('success', 'Success! Your password has been changed.');
		  done(err);
		});
	  }
	], function(err) {
	  res.redirect('/');
	});
});

function isLoggedIn(req, res, next) {
	
		if (!req.isAuthenticated()){
			return next();
		}
		res.redirect('/');
	}
	
app.use('/api', api);

app.listen(app.get('port'), function() {
  console.log('Express server listening on port ' + app.get('port'));
});