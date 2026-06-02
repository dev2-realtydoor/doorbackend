const router = require('express').Router();
const ctrl = require('./locality.controller');
const { authenticate } = require('../../middleware/auth');
const { requireAdmin } = require('../../middleware/requireRole');

// Public — property detail page fetches this
router.get('/', ctrl.getLocality);

// Admin-only management
router.post('/',        authenticate, requireAdmin, ctrl.upsertLocality);
router.delete('/:id',  authenticate, requireAdmin, ctrl.deleteLocality);

module.exports = router;
