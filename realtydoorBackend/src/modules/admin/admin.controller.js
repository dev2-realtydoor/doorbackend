const { success } = require('../../utils/ApiResponse');
const { parsePagination, paginate } = require('../../utils/pagination');
const service = require('./admin.service');
const prisma = require('../../lib/prisma');

async function getLeads(req, res, next) {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const { data, total } = await service.getAllLeads(req.query, skip, limit);
    success(res, paginate(data, total, page, limit));
  } catch (err) { next(err); }
}

async function assignLead(req, res, next) {
  try {
    const { partnerId } = req.body;
    const lead = await service.assignLead(req.params.id, partnerId, req.user.id, req.ip);
    success(res, lead, 'Lead assigned');
  } catch (err) { next(err); }
}

async function getPendingProperties(req, res, next) {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const { data, total } = await service.getPendingProperties(skip, limit);
    success(res, paginate(data, total, page, limit));
  } catch (err) { next(err); }
}

async function approveProperty(req, res, next) {
  try {
    const property = await service.approveProperty(req.params.id, req.user.id, req.ip);
    success(res, property, 'Property approved');
  } catch (err) { next(err); }
}

async function rejectProperty(req, res, next) {
  try {
    const { note } = req.body;
    const property = await service.rejectProperty(req.params.id, note, req.user.id, req.ip);
    success(res, property, 'Property rejected');
  } catch (err) { next(err); }
}

async function getPendingKyc(req, res, next) {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const { data, total } = await service.getPendingKyc(skip, limit);
    success(res, paginate(data, total, page, limit));
  } catch (err) { next(err); }
}

async function verifyKyc(req, res, next) {
  try {
    const { action, note } = req.body; // action: 'APPROVE' | 'REJECT'
    await service.verifyKyc(req.params.userId, action, note, req.user.id, req.ip);
    success(res, null, `KYC ${action === 'APPROVE' ? 'approved' : 'rejected'}`);
  } catch (err) { next(err); }
}

async function getRevenue(req, res, next) {
  try {
    const summary = await service.getRevenueSummary();
    success(res, summary);
  } catch (err) { next(err); }
}

async function getAuditLogs(req, res, next) {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({ skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.auditLog.count(),
    ]);
    success(res, paginate(data, total, page, limit));
  } catch (err) { next(err); }
}

async function getPartnerMetrics(req, res, next) {
  try {
    const partners = await prisma.user.findMany({
      where: { role: 'PARTNER', kycStatus: 'VERIFIED' },
      select: {
        id: true, name: true, email: true, companyName: true, partnerSubType: true,
        assignedLeads: { select: { status: true } },
        properties: { select: { publishStatus: true } },
      },
    });
    const metrics = partners.map((p) => ({
      id: p.id, name: p.name, companyName: p.companyName, partnerSubType: p.partnerSubType,
      totalLeads: p.assignedLeads.length,
      closedLeads: p.assignedLeads.filter((l) => l.status === 'CLOSED').length,
      totalListings: p.properties.length,
      activeListings: p.properties.filter((l) => l.publishStatus === 'APPROVED').length,
    }));
    success(res, metrics);
  } catch (err) { next(err); }
}

async function getUsers(req, res, next) {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const { data, total } = await service.getAllUsers(req.query, skip, limit);
    success(res, paginate(data, total, page, limit));
  } catch (err) { next(err); }
}

async function changeUserRole(req, res, next) {
  try {
    const { role } = req.body;
    const updated = await service.changeUserRole(req.params.id, role, req.user.id, req.ip);
    success(res, updated, `Role updated to ${role}`);
  } catch (err) { next(err); }
}

async function editProperty(req, res, next) {
  try {
    const property = await service.editProperty(
      req.params.id, req.body, req.user.id, req.user.name, req.ip,
    );
    success(res, property, 'Property updated');
  } catch (err) { next(err); }
}

async function getLoans(req, res, next) {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const { data, total } = await service.getAllLoans(req.query, skip, limit);
    success(res, paginate(data, total, page, limit));
  } catch (err) { next(err); }
}

async function updateLoanStatus(req, res, next) {
  try {
    const { status, adminNote } = req.body;
    const loan = await service.updateLoanStatus(req.params.id, status, adminNote, req.user.id);
    success(res, loan, 'Loan status updated');
  } catch (err) { next(err); }
}

module.exports = {
  getLeads, assignLead,
  getPendingProperties, approveProperty, rejectProperty, editProperty,
  getPendingKyc, verifyKyc,
  getRevenue, getAuditLogs, getPartnerMetrics,
  getLoans, updateLoanStatus,
  getUsers, changeUserRole,
};
