const { success, created } = require('../../utils/ApiResponse');
const service = require('./users.service');

async function requestPhoneOtp(req, res, next) {
  try {
    const { phone } = req.body;
    const result = await service.requestPhoneOtp(req.user.id, phone);
    success(res, result);
  } catch (err) { next(err); }
}

async function verifyPhoneOtp(req, res, next) {
  try {
    const result = await service.verifyPhoneOtp(req.user.id, req.body.otp);
    success(res, result, 'Phone number verified');
  } catch (err) { next(err); }
}

async function getMyLeads(req, res, next) {
  try {
    const leads = await service.getMyLeads(req.user.id);
    success(res, leads);
  } catch (err) { next(err); }
}

async function toggleFavorite(req, res, next) {
  try {
    const result = await service.toggleFavorite(req.user.id, req.body.propertyId);
    success(res, result);
  } catch (err) { next(err); }
}

async function getDocuments(req, res, next) {
  try {
    const docs = await service.getDocuments(req.user.id);
    success(res, docs);
  } catch (err) { next(err); }
}

async function uploadDocument(req, res, next) {
  try {
    const { documentType } = req.body;
    const doc = await service.uploadDocument(req.user.id, documentType, req.file.path, req.file.originalname);
    created(res, doc, 'Document uploaded');
  } catch (err) { next(err); }
}

async function getSubscriptions(req, res, next) {
  try {
    const subs = await service.getSubscriptions(req.user.id);
    success(res, subs);
  } catch (err) { next(err); }
}

async function raiseTicket(req, res, next) {
  try {
    const ticket = await service.raiseTicket(req.user.id, req.body.subscriptionId, req.body);
    created(res, ticket, 'Ticket raised');
  } catch (err) { next(err); }
}

async function verifyTicket(req, res, next) {
  try {
    const ticket = await service.verifyTicket(req.user.id, req.params.id);
    success(res, ticket, 'Ticket verified and closed');
  } catch (err) { next(err); }
}

async function createLoanApplication(req, res, next) {
  try {
    const loan = await service.createLoanApplication(req.user.id, req.body);
    created(res, loan, 'Loan application submitted');
  } catch (err) { next(err); }
}

async function getMyLoanApplications(req, res, next) {
  try {
    const loans = await service.getMyLoanApplications(req.user.id);
    success(res, loans);
  } catch (err) { next(err); }
}

async function getLoanApplicationById(req, res, next) {
  try {
    const loan = await service.getLoanApplicationById(req.user.id, req.params.id);
    success(res, loan);
  } catch (err) { next(err); }
}

module.exports = { requestPhoneOtp, verifyPhoneOtp, getMyLeads, toggleFavorite, getDocuments, uploadDocument, getSubscriptions, raiseTicket, verifyTicket, createLoanApplication, getMyLoanApplications, getLoanApplicationById };
