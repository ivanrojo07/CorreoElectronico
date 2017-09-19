'use strict'

var Usuario = require('../models/usuario');
var connection = require('../conexion/conexion');
var DATABASE = 'login';
var TABLE = 'usuarios';
var sha1 = require('sha1');

function prueba (req, res){
	if (req.params.nombre) {
		var nombre = req.params.nombre;
	}
	else{
		var nombre = 'mundo';
	}
	res.status(200).send({
		message: "Hola "+nombre
	});
}

function loginUsuario(req, res) {
	var email = req.body.email;
    var password = sha1(req.body.password);
        
	connection.query('SELECT * FROM '+TABLE+' WHERE email = ? AND password = ?', [email, password], function(error, results, fields){
		if (error) {
			res.status(400).send({ failed : "Error con el servidor"});

		} 
		if (results == "") {
			res.status(200).send({ failed : "El usuario o la contraseña son incorrectas" });
		}
		else {
			res.status(200).send({ success : "Usuario logeado" });
		}
	})
}

function getUsuarios (req, res){

	var query = connection.query(`SELECT ${TABLE}.nombre, ${TABLE}.apellido, ${TABLE}.email FROM ${DATABASE}.${TABLE} ORDER BY idusuario DESC;`, 
		function(error, results, fields){
		if(error){
			res.status(500).send({message: "Error en la consulta"});
			throw error;
		}
		else{
			res.status(200).send({usuarios:results});
		}
	});
}

function getUsuario(req, res) {
	var usuarioId = req.params.id;

	var query = connection.query(`SELECT ${TABLE}.nombre, ${TABLE}.apellido, ${TABLE}.email FROM ${DATABASE}.${TABLE} WHERE idusuario =${usuarioId}`, function(error, result, field){
		if (error) {
			res.status(500).send({message: "Error en la consulta"});
		} 
		else {

            var usuario = new Usuario(result[0].idusuario,result[0].nombre, result[0].apellido, result[0].email, result[0].password);
      		res.status(200).send({ usuario : usuario });
		}
	});
}

function saveUsuario(req, res) {
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
}

function updateUsuario(req, res) {
	var usuarioId = req.params.id;
	var update = req.body;
	var sql = `UPDATE ${TABLE} SET`;
	if (update.nombre) {
		sql += ` nombre = '${update.nombre}',`;
	} 
	if (update.apellido) {
		sql += ` apellido = '${update.apellido}',`;
	}
	if (update.email) {
		sql += ` email = '${update.email}',`;
	}
	if (update.password) {
		sql += ` password = '${sha1(update.password)}' `;
	}
	sql = sql.substring(0, sql.length-1);
	sql += ` WHERE idusuario = ${usuarioId};`;
	var query = connection.query(sql, function(error, result, field){
		if (error) {
			res.status(400).send({ message: "Error de conexión"});
		} 
		else {
			connection.query(`SELECT ${TABLE}.nombre, ${TABLE}.apellido, ${TABLE}.email FROM ${DATABASE}.${TABLE} WHERE idusuario =${usuarioId}`, function(error, result, field){
				if (error) {
					res.status(500).send({message: "Error en la consulta"});
				} 
				else {
                    var usuario = new Usuario(result[0].idusuario,result[0].nombre, result[0].apellido, result[0].email, result[0].password);
      				res.status(200).send({ usuario : usuario });
				}
			});
		}
	});
}

function deleteUsuario(req, res) {
	var usuarioId = req.params.id;
	connection.query('DELETE FROM '+TABLE+' WHERE idusuario = ?', [usuarioId], function(error, result, field){
		if (error) {
			res.status(500).send({ message: "Error de conexión"});
		}
		if(result['affectedRows'] == 0) {
			res.status(400).send({ message: "No existe dato del usuario"});
		} 
		else {
			console.log(result);
			res.status(200).send({ message: "Usuario eliminado correctamente" });
		}
	});
}

module.exports = {
	prueba,
	loginUsuario,
	getUsuarios,
	getUsuario,
	saveUsuario,
	updateUsuario,
	deleteUsuario,
};