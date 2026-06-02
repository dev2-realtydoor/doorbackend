const router = require('express').Router();
const ctrl = require('./users.controller');
const { authenticate } = require('../../middleware/auth');
const { requireUser } = require('../../middleware/requireRole');
const { requirePhone } = require('../../middleware/requirePhone');
const { userDocUploader } = require('../../lib/fileUpload');
const { otpLimiter } = require('../../middleware/rateLimiter');

router.use(authenticate, requireUser);

// Phone verification (lazy — only called when needed)
router.post('/verify-phone',     otpLimiter, ctrl.requestPhoneOtp);
router.post('/verify-phone/otp', otpLimiter, ctrl.verifyPhoneOtp);

// Inquiries tracker
router.get('/leads', ctrl.getMyLeads);

// Favorites (phone required — PRD §2.5)
router.post('/favorites', requirePhone, ctrl.toggleFavorite);

// Document vault
router.get('/documents', ctrl.getDocuments);
router.post('/documents', requirePhone, userDocUploader.single('file'), ctrl.uploadDocument);

// Service subscriptions
router.get('/subscriptions', ctrl.getSubscriptions);

// Tickets
router.post('/tickets', requirePhone, ctrl.raiseTicket);
router.patch('/tickets/:id/verify', ctrl.verifyTicket);

// Loan applications
router.post('/loan',     requirePhone, ctrl.createLoanApplication);
router.get('/loan',                   ctrl.getMyLoanApplications);
router.get('/loan/:id',               ctrl.getLoanApplicationById);

module.exports = router;
