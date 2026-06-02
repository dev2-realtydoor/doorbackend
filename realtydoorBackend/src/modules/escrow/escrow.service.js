const prisma = require('../../lib/prisma');
const ApiError = require('../../utils/ApiError');
const { createEscrowOrder, releaseEscrow, refundPayment } = require('../../lib/razorpay');
const { createAuditLog } = require('../../lib/auditLog');
const { createNotification } = require('../../lib/notifications');

async function createOrder(leadId, buyerId, amountInRupees) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new ApiError(404, 'Lead not found');

  const existing = await prisma.escrowTransaction.findFirst({
    where: { leadId, status: { in: ['HELD', 'PAYMENT_PENDING'] } },
  });
  if (existing) throw new ApiError(400, 'An active escrow order already exists for this lead');

  const amountInPaise = Math.round(amountInRupees * 100);
  const order = await createEscrowOrder(amountInPaise, `escrow_${leadId}`);

  const escrow = await prisma.escrowTransaction.create({
    data: {
      leadId,
      buyerId,
      razorpayOrderId: order.id,
      amount: amountInRupees,
      status: 'PAYMENT_PENDING',
    },
  });

  return { escrow, razorpayOrder: order };
}

async function confirmPayment(razorpayOrderId, razorpayPaymentId) {
  return prisma.escrowTransaction.update({
    where: { razorpayOrderId },
    data: { razorpayPaymentId, status: 'HELD', heldAt: new Date() },
  });
}

async function release(escrowId, adminId, releaseData, ip) {
  const { sellerAccountId, partnerShare, platformFee, note } = releaseData ?? {};

  const escrow = await prisma.escrowTransaction.findUnique({ where: { id: escrowId } });
  if (!escrow) throw new ApiError(404, 'Escrow not found');
  if (escrow.status !== 'HELD') throw new ApiError(400, `Cannot release escrow with status ${escrow.status}`);
  if (!escrow.razorpayPaymentId) throw new ApiError(400, 'Payment not yet captured');

  const amountInPaise = Math.round(escrow.amount * 100);
  if (sellerAccountId) {
    await releaseEscrow(escrow.razorpayPaymentId, sellerAccountId, amountInPaise);
  }

  const parts = [];
  if (partnerShare != null) parts.push(`Partner share: ₹${partnerShare}`);
  if (platformFee   != null) parts.push(`Platform fee: ₹${platformFee}`);
  if (note)                  parts.push(note);
  const adminNote = parts.join(' | ') || undefined;

  const updated = await prisma.escrowTransaction.update({
    where: { id: escrowId },
    data: { status: 'RELEASED', releasedAt: new Date(), releasedByAdminId: adminId, adminNote },
  });

  await createAuditLog({
    adminId, action: 'ESCROW_RELEASED', targetType: 'EscrowTransaction', targetId: escrowId,
    after: { status: 'RELEASED', partnerShare, platformFee, note }, ipAddress: ip,
  });

  return updated;
}

async function refund(escrowId, adminId, ip) {
  const escrow = await prisma.escrowTransaction.findUnique({ where: { id: escrowId } });
  if (!escrow) throw new ApiError(404, 'Escrow not found');
  if (escrow.status !== 'HELD') throw new ApiError(400, `Cannot refund escrow with status ${escrow.status}`);
  if (!escrow.razorpayPaymentId) throw new ApiError(400, 'Payment not yet captured');

  const amountInPaise = Math.round(escrow.amount * 100);
  await refundPayment(escrow.razorpayPaymentId, amountInPaise);

  const updated = await prisma.escrowTransaction.update({
    where: { id: escrowId },
    data: { status: 'REFUNDED', refundedAt: new Date() },
  });

  await createAuditLog({
    adminId, action: 'ESCROW_REFUNDED', targetType: 'EscrowTransaction', targetId: escrowId,
    after: { status: 'REFUNDED' }, ipAddress: ip,
  });

  await createNotification({
    userId: escrow.buyerId,
    title: 'Escrow Refunded',
    message: 'Your token advance has been refunded to your original payment method.',
    type: 'ESCROW_REFUNDED',
  });

  return updated;
}

async function getAllEscrow(filters, skip, limit) {
  const where = {};
  if (filters.status) where.status = filters.status;
  const [data, total] = await prisma.$transaction([
    prisma.escrowTransaction.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
    prisma.escrowTransaction.count({ where }),
  ]);
  return { data, total };
}

module.exports = { createOrder, confirmPayment, release, refund, getAllEscrow };
