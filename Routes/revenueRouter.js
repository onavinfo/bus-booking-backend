const express = require("express");

const revenueRouter = express.Router();

const revenueController = require("../Controllers/revenueController");

revenueRouter.get('/dashboard', revenueController.getRevenueDashboard);

exports.revenueRouter = revenueRouter;