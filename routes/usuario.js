'use strict'

var express = require('express');
var hogan = require('hogan-express');

var app = express();
var UsuarioController = require('../controllers/usuario');

var api = express.Router();

api.get('/prueba/:nombre?', UsuarioController.prueba);
api.post('/login', UsuarioController.loginUsuario);
api.get('/usuarios', UsuarioController.getUsuarios);
api.get('/usuario/:id', UsuarioController.getUsuario);
api.post('/usuario', UsuarioController.saveUsuario);
api.put('/usuario/:id', UsuarioController.updateUsuario);
api.delete('/usuario/:id', UsuarioController.deleteUsuario);
module.exports = api;