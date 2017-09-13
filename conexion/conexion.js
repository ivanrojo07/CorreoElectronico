'use strict'

var mysql = require('mysql');


var connection = mysql.createConnection({
	host	 : 'localhost',
	port	 : '3307',
	user	 : 'root',
	password : 'toor',
	database : 'login' 
});

module.exports = connection;