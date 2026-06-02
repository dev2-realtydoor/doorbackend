const { verifyWebhookSignature } = require('../../lib/razorpay');
const { confirmPayment } = require('../escrow/escrow.service');
const prisma = require('../../lib/prisma');
const { sendServiceActivated } = require('../../lib/email');
const { createNotification } = require('../../lib/notifications');
const logger = require('../../lib/logger');

async function razorpay(req, res) {
  const signature = req.headers['x-razorpay-signature'];

  if (!verifyWebhookSignature(req.rawBody, signature)) {
    return res.status(400).json({ error: 'Invalid signature' });
  }

  const { event, payload } = req.body;

  try {
    if (event === 'payment.captured') {
      const { order_id: orderId, id: paymentId } = payload.payment.entity;

      // Determine if this is an escrow or service payment
      const escrow = await prisma.escrowTransaction.findUnique({ where: { razorpayOrderId: orderId } });
      if (escrow) {
        await confirmPayment(orderId, paymentId);
        return res.json({ status: 'ok' });
      }

      const subscription = await prisma.userSubscription.findUnique({ where: { razorpayOrderId: orderId } });
      if (subscription) {
        await prisma.userSubscription.update({
          where: { razorpayOrderId: orderId },
          data: { paymentStatus: 'SUCCESS', razorpayPaymentId: paymentId },
        });

        const service = await prisma.service.findUnique({ where: { id: subscription.serviceId } });
        await prisma.serviceTicket.create({
          data: {
            userId: subscription.userId,
            subscriptionId: subscription.id,
            subject: `${service?.name} — Initial Setup`,
            description: 'Service activated. Admin will coordinate.',
            status: 'OPEN',
          },
        });

        await createNotification({
          userId: subscription.userId,
          title: 'Service Activated',
          message: `Your ${service?.name} service is now active.`,
          type: 'SERVICE_ACTIVATED',
          linkUrl: '/dashboard/services',
        });

        const user = await prisma.user.findUnique({ where: { id: subscription.userId } });
        if (user && service) sendServiceActivated(user.email, service.name).catch(() => {});
      }
    }

    if (event === 'payment.failed') {
      const { order_id: orderId } = payload.payment.entity;

      const escrow = await prisma.escrowTransaction.findUnique({ where: { razorpayOrderId: orderId } });
      if (escrow) {
        await prisma.escrowTransaction.update({
          where: { razorpayOrderId: orderId },
          data: { status: 'FAILED', failedAt: new Date() },
        });
        return res.json({ status: 'ok' });
      }

      await prisma.userSubscription.updateMany({
        where: { razorpayOrderId: orderId },
        data: { paymentStatus: 'FAILED' },
      });
    }
  } catch (err) {
    logger.error('[RazorpayWebhook] Error processing event', { event, error: err.message });
  }

  res.json({ status: 'ok' });
}

module.exports = { razorpay };
