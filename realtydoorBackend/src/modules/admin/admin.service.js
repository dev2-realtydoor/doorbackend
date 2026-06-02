const prisma = require('../../lib/prisma');
const ApiError = require('../../utils/ApiError');
const { createNotification } = require('../../lib/notifications');
const { createAuditLog } = require('../../lib/auditLog');
const { sendPropertyApproved, sendPropertyRejected, sendKycVerified } = require('../../lib/email');
const { sendLeadAssignedNotice } = require('../../lib/wati');
const { setUserRole } = require('../../lib/clerkAdmin');
const logger = require('../../lib/logger');

// ─── LEAD MANAGEMENT ─────────────────────────────────────────────────────────

async function getAllLeads(filters, skip, limit) {
  const where = {};
  if (filters.status) where.status = filters.status;
  if (filters.partnerId) where.assignedPartnerId = filters.partnerId;

  const [data, total] = await Promise.all([
    prisma.lead.findMany({
      where, skip, take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        property: { select: { title: true, slug: true, city: true } },
        assignedPartner: { select: { name: true, email: true } },
      },
    }),
    prisma.lead.count({ where }),
  ]);

  return { data, total };
}

async function assignLead(leadId, partnerId, adminId, ip) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new ApiError(404, 'Lead not found');

  const partner = await prisma.user.findFirst({ where: { id: partnerId, role: 'PARTNER', kycStatus: 'VERIFIED' } });
  if (!partner) throw new ApiError(400, 'Partner not found or not KYC verified');

  const updated = await prisma.lead.update({
    where: { id: leadId },
    data: { assignedPartnerId: partnerId, status: 'ASSIGNED', assignedAt: new Date() },
  });

  await createNotification({
    userId: partnerId,
    title: 'New Lead Assigned',
    message: `A new buyer lead has been assigned to you.`,
    type: 'LEAD_ASSIGNED',
    linkUrl: `/partner/leads/${leadId}`,
  });

  await createAuditLog({
    adminId, action: 'LEAD_ASSIGNED', targetType: 'Lead', targetId: leadId,
    before: { status: lead.status }, after: { status: 'ASSIGNED', assignedPartnerId: partnerId },
    ipAddress: ip,
  });

  // WhatsApp notice to partner (best-effort)
  sendLeadAssignedNotice(partner.phone, partner.name).catch(() => {});

  return updated;
}

// ─── PROPERTY APPROVAL ───────────────────────────────────────────────────────

async function getPendingProperties(skip, limit) {
  const [data, total] = await Promise.all([
    prisma.property.findMany({
      where: { publishStatus: 'PENDING_APPROVAL' },
      skip, take: limit,
      include: { partner: { select: { name: true, email: true, companyName: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.property.count({ where: { publishStatus: 'PENDING_APPROVAL' } }),
  ]);
  return { data, total };
}

async function approveProperty(propertyId, adminId, ip) {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    include: { partner: { select: { email: true } } },
  });
  if (!property) throw new ApiError(404, 'Property not found');

  const updated = await prisma.property.update({
    where: { id: propertyId },
    data: { publishStatus: 'APPROVED', rejectionNote: null },
  });

  await createNotification({
    userId: property.partnerId,
    title: 'Listing Approved!',
    message: `Your listing "${property.title}" is now live.`,
    type: 'PROPERTY_APPROVED',
    linkUrl: `/properties/${property.slug}`,
  });

  await createAuditLog({
    adminId, action: 'PROPERTY_APPROVED', targetType: 'Property', targetId: propertyId,
    before: { publishStatus: 'PENDING_APPROVAL' }, after: { publishStatus: 'APPROVED' },
    ipAddress: ip,
  });

  sendPropertyApproved(property.partner.email, property.title).catch(() => {});
  return updated;
}

async function rejectProperty(propertyId, note, adminId, ip) {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    include: { partner: { select: { email: true } } },
  });
  if (!property) throw new ApiError(404, 'Property not found');

  const updated = await prisma.property.update({
    where: { id: propertyId },
    data: { publishStatus: 'REJECTED', rejectionNote: note },
  });

  await createNotification({
    userId: property.partnerId,
    title: 'Listing Needs Changes',
    message: `Your listing "${property.title}" was not approved. Reason: ${note}`,
    type: 'PROPERTY_REJECTED',
    linkUrl: `/partner/listings/${propertyId}`,
  });

  await createAuditLog({
    adminId, action: 'PROPERTY_REJECTED', targetType: 'Property', targetId: propertyId,
    after: { publishStatus: 'REJECTED', note },
    ipAddress: ip,
  });

  sendPropertyRejected(property.partner.email, property.title, note).catch(() => {});
  return updated;
}

// ─── KYC MANAGEMENT ──────────────────────────────────────────────────────────

async function getPendingKyc(skip, limit) {
  const [data, total] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'PARTNER', kycStatus: 'PENDING_REVIEW' },
      skip, take: limit,
      select: { id: true, name: true, email: true, companyName: true, partnerSubType: true, kycDocumentUrls: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.user.count({ where: { role: 'PARTNER', kycStatus: 'PENDING_REVIEW' } }),
  ]);
  return { data, total };
}

async function verifyKyc(userId, action, note, adminId, ip) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ApiError(404, 'User not found');

  const kycStatus = action === 'APPROVE' ? 'VERIFIED' : 'REJECTED';

  await prisma.user.update({
    where: { id: userId },
    data: {
      kycStatus,
      kycVerifiedAt: action === 'APPROVE' ? new Date() : null,
      kycRejectionNote: note || null,
    },
  });

  await createNotification({
    userId,
    title: action === 'APPROVE' ? 'Account Verified!' : 'KYC Needs Attention',
    message: action === 'APPROVE'
      ? 'Your KYC has been verified. You can now list properties and receive leads.'
      : `Your KYC was rejected. Reason: ${note}`,
    type: 'KYC_UPDATE',
    linkUrl: '/partner/profile',
  });

  await createAuditLog({
    adminId, action: `KYC_${action}`, targetType: 'User', targetId: userId,
    after: { kycStatus }, ipAddress: ip,
  });

  if (action === 'APPROVE') sendKycVerified(user.email).catch(() => {});
}

// ─── REVENUE DASHBOARD ───────────────────────────────────────────────────────

async function getRevenueSummary() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [escrowHeld, escrowReleased, servicesRevenue, closedLeads, totalLeads] = await Promise.all([
    prisma.escrowTransaction.aggregate({ where: { status: 'HELD' }, _sum: { amount: true }, _count: true }),
    prisma.escrowTransaction.aggregate({
      where: { status: 'RELEASED', releasedAt: { gte: startOfMonth } },
      _sum: { amount: true }, _count: true,
    }),
    prisma.userSubscription.aggregate({
      where: { paymentStatus: 'SUCCESS', startDate: { gte: startOfMonth } },
      _sum: { amountPaid: true }, _count: true,
    }),
    prisma.lead.count({ where: { status: 'CLOSED', updatedAt: { gte: startOfMonth } } }),
    prisma.lead.count(),
  ]);

  return {
    escrowHeld:       { amount: escrowHeld._sum.amount || 0,          count: escrowHeld._count },
    escrowReleasedMTD:{ amount: escrowReleased._sum.amount || 0,       count: escrowReleased._count },
    serviceRevenueMTD:{ amount: servicesRevenue._sum.amountPaid || 0,  count: servicesRevenue._count },
    closedLeadsMTD: closedLeads,
    totalLeads,
  };
}

// ─── PROPERTY EDIT (Admin) ───────────────────────────────────────────────────

async function editProperty(propertyId, data, adminId, adminName, ip) {
  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property) throw new ApiError(404, 'Property not found');

  const FORBIDDEN = ['partnerId', 'slug'];
  FORBIDDEN.forEach((f) => delete data[f]);

  // Build per-field edit logs for every changed value
  const editLogRows = Object.entries(data)
    .filter(([field, newVal]) => String(property[field] ?? '') !== String(newVal ?? ''))
    .map(([field, newVal]) => ({
      propertyId,
      editedBy:     adminId,
      editedByName: adminName,
      fieldChanged: field,
      oldValue:     property[field] != null ? JSON.stringify(property[field]) : null,
      newValue:     newVal     != null ? JSON.stringify(newVal)              : null,
    }));

  const [updated] = await prisma.$transaction([
    prisma.property.update({ where: { id: propertyId }, data }),
    ...editLogRows.map((row) => prisma.propertyEditLog.create({ data: row })),
  ]);

  if (editLogRows.length > 0) {
    await createNotification({
      userId:  property.partnerId,
      title:   'Your listing was edited by Admin',
      message: `Admin updated ${editLogRows.length} field(s) on "${property.title}". Changes are visible on your listing.`,
      type:    'PROPERTY_EDITED_BY_ADMIN',
      linkUrl: `/partner/listings/${propertyId}`,
    });

    await createAuditLog({
      adminId, action: 'PROPERTY_EDITED', targetType: 'Property', targetId: propertyId,
      before: Object.fromEntries(editLogRows.map((r) => [r.fieldChanged, r.oldValue])),
      after:  Object.fromEntries(editLogRows.map((r) => [r.fieldChanged, r.newValue])),
      ipAddress: ip,
    });
  }

  return updated;
}

// ─── LOAN MANAGEMENT (Admin) ─────────────────────────────────────────────────

async function getAllLoans(filters, skip, limit) {
  const where = {};
  if (filters.status)   where.status   = filters.status;
  if (filters.userId)   where.userId   = filters.userId;

  const [data, total] = await Promise.all([
    prisma.loanApplication.findMany({
      where, skip, take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user:     { select: { name: true, email: true, phone: true } },
        property: { select: { title: true, slug: true, city: true } },
      },
    }),
    prisma.loanApplication.count({ where }),
  ]);
  return { data, total };
}

async function updateLoanStatus(loanId, status, adminNote, adminId) {
  const loan = await prisma.loanApplication.findUnique({ where: { id: loanId } });
  if (!loan) throw new ApiError(404, 'Loan application not found');

  const extraFields = {};
  if (status === 'SANCTIONED') extraFields.sanctionedAt = new Date();
  if (status === 'DISBURSED')  extraFields.disbursedAt  = new Date();

  const updated = await prisma.loanApplication.update({
    where: { id: loanId },
    data: { status, adminNote: adminNote || loan.adminNote, ...extraFields },
  });

  await createNotification({
    userId:  loan.userId,
    title:   'Loan Application Update',
    message: `Your loan application status has been updated to ${status}.`,
    type:    'LOAN_STATUS_UPDATE',
    linkUrl: `/dashboard/loan/${loanId}`,
  });

  return updated;
}

// ─── USER MANAGEMENT ─────────────────────────────────────────────────────────

async function getAllUsers(filters, skip, limit) {
  const where = {};
  if (filters.role)   where.role  = filters.role;
  if (filters.search) where.OR    = [
    { name:  { contains: filters.search, mode: 'insensitive' } },
    { email: { contains: filters.search, mode: 'insensitive' } },
  ];

  const [data, total] = await Promise.all([
    prisma.user.findMany({
      where, skip, take: limit,
      select: { id: true, name: true, email: true, phone: true, phoneVerified: true, role: true, kycStatus: true, partnerSubType: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ]);

  return { data, total };
}

async function changeUserRole(targetUserId, newRole, adminId, ip) {
  const VALID_ROLES = ['USER', 'PARTNER', 'ADMIN'];
  if (!VALID_ROLES.includes(newRole)) throw new ApiError(400, 'Invalid role');

  const user = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!user) throw new ApiError(404, 'User not found');

  const updated = await prisma.user.update({
    where: { id: targetUserId },
    data:  { role: newRole },
    select: { id: true, name: true, email: true, role: true, clerkId: true },
  });

  // Sync role to Clerk publicMetadata so the JWT Template reflects the new role immediately
  await setUserRole(user.clerkId, newRole).catch((err) =>
    logger.warn('[changeUserRole] Clerk publicMetadata sync failed', { clerkId: user.clerkId, error: err.message })
  );

  await createAuditLog({
    adminId, action: 'ROLE_CHANGED', targetType: 'User', targetId: targetUserId,
    before: { role: user.role }, after: { role: newRole },
    ipAddress: ip,
  });

  return updated;
}

module.exports = {
  getAllLeads, assignLead,
  getPendingProperties, approveProperty, rejectProperty, editProperty,
  getPendingKyc, verifyKyc,
  getRevenueSummary,
  getAllLoans, updateLoanStatus,
  getAllUsers, changeUserRole,
};
