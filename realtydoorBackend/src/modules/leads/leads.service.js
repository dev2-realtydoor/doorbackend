const prisma = require('../../lib/prisma');
const ApiError = require('../../utils/ApiError');
const { formatPhone } = require('../../lib/phoneUtils');
const { generate, expiresAt, isExpired, isLocked, lockUntil, maxAttemptsReached } = require('../../lib/otp');
const { sendSiteVisitOtp, sendLeadAssignedNotice } = require('../../lib/wati');
const { createNotification } = require('../../lib/notifications');
const { sendLeadAssigned } = require('../../lib/email');

async function submitLead(data) {
  const lead = await prisma.lead.create({
    data: { ...data, status: 'UNASSIGNED' },
  });

  // Notify admin of new unassigned lead
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
  for (const admin of admins) {
    await createNotification({
      userId: admin.id,
      title: 'New Unassigned Lead',
      message: `${data.buyerName} enquired about a property.`,
      type: 'LEAD_NEW',
      linkUrl: `/admin/leads/${lead.id}`,
    });
  }

  return lead;
}

function sanitizeLeadForPartner(lead) {
  return {
    ...lead,
    buyerPhone: formatPhone(lead.buyerPhone, lead.isOtpVerified),
    siteVisitOTP: undefined, // never expose OTP in response
  };
}

async function getPartnerLeads(partnerId) {
  // Rule 2: Partner sees only their assigned leads
  const leads = await prisma.lead.findMany({
    where: { assignedPartnerId: partnerId },
    include: { property: { select: { title: true, slug: true, locality: true, city: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return leads.map(sanitizeLeadForPartner);
}

async function getPartnerLeadById(leadId, partnerId) {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, assignedPartnerId: partnerId },
    include: { property: true },
  });
  if (!lead) throw new ApiError(404, 'Lead not found');
  return sanitizeLeadForPartner(lead);
}

async function scheduleVisit(leadId, partnerId, scheduledAt) {
  const lead = await prisma.lead.findFirst({ where: { id: leadId, assignedPartnerId: partnerId } });
  if (!lead) throw new ApiError(404, 'Lead not found');
  if (lead.status === 'CLOSED') throw new ApiError(400, 'Cannot schedule visit on a closed lead');

  const otp = generate();
  const otpExp = expiresAt();

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      status: 'SITE_VISIT_SCHEDULED',
      siteVisitScheduledAt: new Date(scheduledAt),
      siteVisitOTP: otp,
      otpGeneratedAt: new Date(),
      otpExpiresAt: otpExp,
      otpAttempts: 0,
      otpLockedUntil: null,
    },
  });

  await sendSiteVisitOtp(lead.buyerPhone, otp);
  return { message: 'OTP sent to buyer via WhatsApp. Enter it at the site.' };
}

async function verifyOtp(leadId, partnerId, inputOtp) {
  const lead = await prisma.lead.findFirst({ where: { id: leadId, assignedPartnerId: partnerId } });
  if (!lead) throw new ApiError(404, 'Lead not found');
  if (!lead.siteVisitOTP) throw new ApiError(400, 'No OTP generated for this lead');
  if (isLocked(lead.otpLockedUntil)) throw new ApiError(429, 'OTP locked. Contact Admin to override.');
  if (isExpired(lead.otpExpiresAt)) throw new ApiError(400, 'OTP has expired');

  if (lead.siteVisitOTP !== inputOtp) {
    const newAttempts = lead.otpAttempts + 1;
    const locked = maxAttemptsReached(newAttempts) ? lockUntil() : null;
    await prisma.lead.update({
      where: { id: leadId },
      data: { otpAttempts: newAttempts, otpLockedUntil: locked },
    });
    if (locked) throw new ApiError(429, 'Maximum OTP attempts reached. Lead is locked. Contact Admin.');
    throw new ApiError(400, `Incorrect OTP. ${3 - newAttempts} attempt(s) remaining.`);
  }

  const updated = await prisma.lead.update({
    where: { id: leadId },
    data: {
      isOtpVerified: true,
      otpVerifiedAt: new Date(),
      status: 'SITE_VISIT_DONE',
      siteVisitOTP: null,
    },
  });

  return { message: 'OTP verified. Buyer contact revealed.', buyerPhone: updated.buyerPhone };
}

async function uploadDocs(leadId, partnerId, data, fileUrls) {
  const lead = await prisma.lead.findFirst({ where: { id: leadId, assignedPartnerId: partnerId } });
  if (!lead) throw new ApiError(404, 'Lead not found');

  return prisma.lead.update({
    where: { id: leadId },
    data: {
      visitNotes: data.visitNotes,
      partnerNotes: data.partnerNotes,
      ...(fileUrls.visitPhotos ? { visitPhotoUrls: { push: fileUrls.visitPhotos } } : {}),
      ...(fileUrls.closureDocs ? { closureDocumentUrls: { push: fileUrls.closureDocs } } : {}),
    },
  });
}

async function closeLead(leadId, partnerId) {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, assignedPartnerId: partnerId },
    include: { escrowTransactions: true },
  });
  if (!lead) throw new ApiError(404, 'Lead not found');

  // Rule 6: A HELD escrow with a captured payment is required before closing
  const heldEscrow = lead.escrowTransactions.find((e) => e.status === 'HELD' && e.razorpayPaymentId);
  if (!heldEscrow) throw new ApiError(400, 'Escrow payment must be captured (HELD) before closing a deal (PRD Rule 6)');

  // Rule 7: CLOSED is irreversible by partner
  if (lead.status === 'CLOSED') throw new ApiError(400, 'Lead is already closed');

  await prisma.lead.update({ where: { id: leadId }, data: { status: 'CLOSED' } });

  const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
  for (const admin of admins) {
    await createNotification({
      userId: admin.id,
      title: 'Deal Closed — Escrow Review Needed',
      message: `Lead #${leadId} has been marked as closed. Review escrow release.`,
      type: 'DEAL_CLOSED',
      linkUrl: `/admin/leads/${leadId}`,
    });
  }

  return { message: 'Lead marked as closed. Admin will review escrow release.' };
}

module.exports = { submitLead, getPartnerLeads, getPartnerLeadById, scheduleVisit, verifyOtp, uploadDocs, closeLead };
