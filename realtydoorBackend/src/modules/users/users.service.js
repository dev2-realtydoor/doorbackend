const prisma = require('../../lib/prisma');
const ApiError = require('../../utils/ApiError');
const { sendPhoneVerificationOtp } = require('../../lib/wati');
const { generate, expiresAt, isExpired, isLocked, lockUntil, maxAttemptsReached, MAX_ATTEMPTS } = require('../../lib/otp');

async function requestPhoneOtp(userId, phone) {
  const duplicate = await prisma.user.findFirst({ where: { phone, NOT: { id: userId } } });
  if (duplicate) throw new ApiError(409, 'Phone number already registered to another account');

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (isLocked(user.phoneOtpLockedUntil)) {
    throw new ApiError(429, 'Too many attempts. Try again in 30 minutes.');
  }

  const otp = generate();
  await prisma.user.update({
    where: { id: userId },
    data: {
      phone,
      phoneVerified:       false,
      phoneOtp:            otp,
      phoneOtpExpiresAt:   expiresAt(),
      phoneOtpAttempts:    0,
      phoneOtpLockedUntil: null,
    },
  });

  await sendPhoneVerificationOtp(phone, otp);
  return { message: 'OTP sent via WhatsApp' };
}

async function verifyPhoneOtp(userId, otp) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user.phone || !user.phoneOtp) throw new ApiError(400, 'Request an OTP first');

  if (isLocked(user.phoneOtpLockedUntil)) {
    throw new ApiError(429, 'Too many attempts. Try again in 30 minutes.');
  }
  if (isExpired(user.phoneOtpExpiresAt)) {
    throw new ApiError(400, 'OTP expired. Request a new one.');
  }

  if (user.phoneOtp !== otp) {
    const attempts = user.phoneOtpAttempts + 1;
    const locked   = maxAttemptsReached(attempts);
    await prisma.user.update({
      where: { id: userId },
      data: {
        phoneOtpAttempts:    attempts,
        phoneOtpLockedUntil: locked ? lockUntil() : null,
      },
    });
    throw new ApiError(400, locked
      ? `Incorrect OTP. Account locked for 30 minutes after ${MAX_ATTEMPTS} failed attempts.`
      : `Incorrect OTP. ${MAX_ATTEMPTS - attempts} attempt(s) remaining.`
    );
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      phoneVerified:       true,
      phoneVerifiedAt:     new Date(),
      phoneOtp:            null,
      phoneOtpExpiresAt:   null,
      phoneOtpAttempts:    0,
      phoneOtpLockedUntil: null,
    },
  });
  return { phoneVerified: true, phone: user.phone };
}

async function getMyLeads(userId) {
  return prisma.lead.findMany({
    where: { buyerId: userId },
    include: { property: { select: { title: true, slug: true, city: true, images: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

async function toggleFavorite(userId, propertyId) {
  const existing = await prisma.favorite.findFirst({ where: { userId, propertyId } });
  if (existing) {
    await prisma.favorite.delete({ where: { id: existing.id } });
    return { favorited: false };
  }
  await prisma.favorite.create({ data: { userId, propertyId } });
  return { favorited: true };
}

async function getDocuments(userId) {
  return prisma.userDocument.findMany({ where: { userId }, orderBy: { uploadedAt: 'desc' } });
}

async function uploadDocument(userId, documentType, fileUrl, fileName) {
  return prisma.userDocument.create({
    data: { userId, documentType, fileUrl, fileName },
  });
}

async function getSubscriptions(userId) {
  return prisma.userSubscription.findMany({
    where: { userId },
    include: { tickets: { orderBy: { createdAt: 'desc' } } },
    orderBy: { startDate: 'desc' },
  });
}

async function raiseTicket(userId, subscriptionId, data) {
  const sub = await prisma.userSubscription.findFirst({ where: { id: subscriptionId, userId } });
  if (!sub) throw new ApiError(404, 'Subscription not found');
  if (sub.paymentStatus !== 'SUCCESS') throw new ApiError(400, 'Service not active');

  return prisma.serviceTicket.create({
    data: { ...data, userId, subscriptionId },
  });
}

async function verifyTicket(userId, ticketId) {
  const ticket = await prisma.serviceTicket.findFirst({ where: { id: ticketId, userId } });
  if (!ticket) throw new ApiError(404, 'Ticket not found');
  if (ticket.status !== 'RESOLVED') throw new ApiError(400, 'Ticket is not yet resolved');

  return prisma.serviceTicket.update({
    where: { id: ticketId },
    data: { status: 'VERIFIED_BY_USER', verifiedAt: new Date() },
  });
}

async function createLoanApplication(userId, data) {
  return prisma.loanApplication.create({
    data: { ...data, userId },
  });
}

async function getMyLoanApplications(userId) {
  return prisma.loanApplication.findMany({
    where: { userId },
    include: { property: { select: { title: true, slug: true, city: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

async function getLoanApplicationById(userId, loanId) {
  const loan = await prisma.loanApplication.findFirst({ where: { id: loanId, userId } });
  if (!loan) throw new ApiError(404, 'Loan application not found');
  return loan;
}

module.exports = { requestPhoneOtp, verifyPhoneOtp, getMyLeads, toggleFavorite, getDocuments, uploadDocument, getSubscriptions, raiseTicket, verifyTicket, createLoanApplication, getMyLoanApplications, getLoanApplicationById };
