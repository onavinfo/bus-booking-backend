const express = require('express');

const bookRouter = express.Router();

const bookController = require('../Controllers/bookingController');
const { isAuthenticated } = require('../Middlewares/auth');
//const { isAuthenticated } = require('../Middlewares/auth');

bookRouter.post('/book-seats', bookController.bookSeats);

bookRouter.post('/unlockSeats', bookController.unlockSeats);

bookRouter.get('/book-seats/:busId', bookController.getBookedSeats);

bookRouter.get('/bookings', bookController.allBookings);

bookRouter.delete('/bookings/:bookId', bookController.cancelBooking);

bookRouter.post('/lockSeats', bookController.lockSeats);

bookRouter.get('/lockSeats', bookController.getLockedSeats);

bookRouter.get('/bookings/:bookId', bookController.bookingById);

bookRouter.put('/bookings/:bookId/pay',isAuthenticated,bookController.markAsPaid);

exports.bookRouter = bookRouter;