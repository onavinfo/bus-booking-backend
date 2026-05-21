const express = require('express');

const scheduleRouter = express.Router();

const scheduleController = require('../Controllers/scheduleController');

scheduleRouter.post('/schedules',scheduleController.createSchedule);

scheduleRouter.get('/schedules',scheduleController.allSchedules);

scheduleRouter.get('/schedules/:scheduleId',scheduleController.scheduleById);

scheduleRouter.put('/schedules/:scheduleId',scheduleController.updateSchedule);

scheduleRouter.delete('/schedules/:scheduleId',scheduleController.deleteSchedule);

scheduleRouter.get('/owner-schedules',scheduleController.allOwnerSchedules);

scheduleRouter.delete('/owner-schedules/:scheduleId',scheduleController.deleteOwnerSchedule);

exports.scheduleRouter = scheduleRouter;