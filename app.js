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
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(path.join(__dirname, 'public')));

if (typeof usuario === "undefined") {
  usuario = null;

}

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
  console.log(usuario);
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
});

app.listen(app.get('port'), function() {
  console.log('Express server listening on port ' + app.get('port'));
});

function getUsuario(req, res){

  res.status(200).send({success: "funcion obtener usuario"});
}