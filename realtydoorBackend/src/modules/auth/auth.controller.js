const { createClerkClient } = require('@clerk/clerk-sdk-node');
const prisma = require('../../lib/prisma');
const { setUserRole } = require('../../lib/clerkAdmin');
const ApiError = require('../../utils/ApiError');
const { success } = require('../../utils/ApiResponse');
const logger = require('../../lib/logger');

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

// POST /api/auth/sync
// Called by the Next.js frontend after every login.
// Fetches the full Clerk profile, upserts the DB record, and returns the profile.
async function syncUser(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) throw new ApiError(401, 'No token provided');

    const payload = await clerk.verifyToken(token);
    const clerkId = payload.sub;

    // Fetch full profile from Clerk (phone numbers, metadata, etc.)
    const clerkUser = await clerk.users.getUser(clerkId);

    const email = clerkUser.emailAddresses?.[0]?.emailAddress;
    const name  = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || email;
    const phone = clerkUser.phoneNumbers?.[0]?.phoneNumber || null;
    const profileImageUrl = clerkUser.imageUrl || null;

    // Role from Clerk publicMetadata (set by admin or on first signup)
    // Falls back to existing DB role, then 'USER' for brand-new records
    const clerkRole = clerkUser.publicMetadata?.role;

    const existing = await prisma.user.findUnique({ where: { clerkId } });
    const resolvedRole = clerkRole || existing?.role || 'USER';

    // Conflict #3: phone is @unique — if another account already holds this number
    // (e.g. merged Clerk accounts) skip the phone update rather than crashing.
    let phoneToWrite = phone || undefined;
    if (phoneToWrite && existing?.phone !== phoneToWrite) {
      const phoneTaken = await prisma.user.findFirst({
        where: { phone: phoneToWrite, NOT: { clerkId } },
        select: { id: true },
      });
      if (phoneTaken) phoneToWrite = undefined;
    }

    const user = existing
      ? await prisma.user.update({
          where: { clerkId },
          data: {
            name,
            email,
            ...(phoneToWrite !== undefined && { phone: phoneToWrite }),
            profileImageUrl,
            role: resolvedRole,
          },
        })
      : await prisma.user.create({
          data: {
            clerkId,
            name,
            email,
            ...(phoneToWrite ? { phone: phoneToWrite } : {}),
            profileImageUrl,
            role: resolvedRole,
          },
        });

    // If publicMetadata was missing a role, stamp it now so future JWTs include it
    if (!clerkRole) {
      await setUserRole(clerkId, resolvedRole).catch((err) =>
        logger.warn('[authSync] setUserRole failed', { clerkId, error: err.message })
      );
    }

    logger.info('[authSync] user synced', { clerkId, role: resolvedRole });
    success(res, userProfile(user));
  } catch (err) {
    next(err instanceof ApiError ? err : new ApiError(401, 'Sync failed: ' + err.message));
  }
}

// GET /api/auth/me
// Returns the full DB profile for the authenticated user (uses authenticate middleware).
async function getMe(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        subscriptions: {
          orderBy: { startDate: 'desc' },
          take: 1,
          select: { paymentStatus: true, endDate: true, service: { select: { name: true } } },
        },
        notifications: { where: { isRead: false }, select: { id: true } },
      },
    });
    if (!user) throw new ApiError(404, 'User not found');

    const unreadCount = user.notifications.length;
    const raw = user.subscriptions[0] || null;
    const activeSub = raw
      ? { plan: raw.service.name, paymentStatus: raw.paymentStatus, expiresAt: raw.endDate }
      : null;

    success(res, { ...userProfile(user), unreadNotifications: unreadCount, activeSubscription: activeSub });
  } catch (err) { next(err); }
}

function userProfile(u) {
  return {
    id:              u.id,
    clerkId:         u.clerkId,
    name:            u.name,
    email:           u.email,
    phone:           u.phone,
    phoneVerified:   u.phoneVerified,
    role:            u.role,
    isNRI:           u.isNRI,
    profileImageUrl: u.profileImageUrl,
    // Partner-specific
    partnerSubType:  u.partnerSubType  || null,
    companyName:     u.companyName     || null,
    bio:             u.bio             || null,
    websiteUrl:      u.websiteUrl      || null,
    // KYC
    kycStatus:       u.kycStatus,
    kycVerifiedAt:   u.kycVerifiedAt   || null,
    kycRejectionNote:u.kycRejectionNote|| null,
    createdAt:       u.createdAt,
    updatedAt:       u.updatedAt,
  };
}

// POST /api/auth/set-role
// Self-service role upgrade — USER → PARTNER only. ADMIN is manually assigned.
async function setRole(req, res, next) {
  try {
    const { role } = req.body;
    if (role !== 'PARTNER') throw new ApiError(400, 'Only PARTNER role can be self-assigned');
    if (req.user.role !== 'USER') return success(res, { role: req.user.role }); // idempotent

    await setUserRole(req.user.clerkId, 'PARTNER').catch((err) =>
      logger.warn('[setRole] setUserRole failed', { clerkId: req.user.clerkId, error: err.message })
    );
    const user = await prisma.user.update({ where: { id: req.user.id }, data: { role: 'PARTNER' } });
    logger.info('[setRole] upgraded to PARTNER', { userId: req.user.id });
    success(res, { role: user.role });
  } catch (err) {
    next(err instanceof ApiError ? err : new ApiError(500, err.message));
  }
}

module.exports = { syncUser, getMe, setRole };
