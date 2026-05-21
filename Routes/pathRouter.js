const express = require('express');

const pathRouter = express.Router();

const pathController = require('../Controllers/pathController');

const {isAuthenticated} = require('../Middlewares/auth');
//const { checkBusOwnership } = require('../Middlewares/checkOwnership');

pathRouter.post('/paths',isAuthenticated,pathController.createPath);

pathRouter.get('/paths',isAuthenticated,pathController.getPath);

pathRouter.get('/paths/:pathId',isAuthenticated,pathController.pathById);

pathRouter.put('/paths/:pathId',isAuthenticated,pathController.updatePath);

pathRouter.delete('/paths/:pathId',isAuthenticated,pathController.deletePath);

 exports.pathRouter = pathRouter;