const express = require('express');

const busRouter =  express.Router();

const busController = require('../Controllers/busController');

//const {isAuthenticated, authorizeRoles} = require('../Middlewares/auth');
//const { checkBusOwnership } = require('../Middlewares/checkOwnership');

busRouter.post('/buses',busController.pre,busController.createBus);

busRouter.get('/buses',busController.allBus);

busRouter.get('/buses/:busId',busController.busById);

busRouter.put('/buses/:busId',busController.pre,busController.updateBus);

busRouter.delete('/buses/:busId',busController.deleteBus);

busRouter.post('/searchBus', busController.searchBus);

busRouter.get('/details/:busId',busController.busById);

exports.busRouter = busRouter;