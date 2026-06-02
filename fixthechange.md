Skip to main content


Search

Ctrl + K

73 days left

Krishnamurthy's workspace



RealtyDoor — Master Schema & Scalability Suggestions Claude
RealtyDoor — Master Schema & Scalability Suggestions Claude

By Krishnamurthy M Gokarnkar

Prepared: 2026-05-26
Author: Claude (synthesis)
Inputs reconciled:

SCHEMA_GAPS_REPORT.md (MVP-vs-current-schema diff)

PHASE2_SCHEMA_SCALABILITY_RECOMMENDATIONS.md (structural/scaling review)

mvp_prd.md (§§1–16 + flows)

phase2_prd.md (§§1–16 + Appendices A.1–A.5, C.1–C.7, D.1–D.3, Email B.x)

Goal: One actionable, PRD-grounded plan for evolving the Prisma schema from where it is today to a state that ships MVP cleanly and absorbs Phase 2 with zero disruptive migrations. Where the two source reports disagree, this document picks one and explains why.

0. HOW TO READ THIS DOCUMENT 
Every recommendation carries:

Tag

Meaning

P0 / 🔴

Required for MVP. Current schema breaks a PRD-stated feature or a payment-correctness rule. Ship-blocker.

P1 / 🟡

Add now (nullable / unused). Cheap to add, prevents a disruptive Phase 2 migration.

P2 / 🟢

Phase 2 only. Defer until that scope is funded, but the space is already reserved here.

Each item lists:

PRD anchor — the section/appendix that motivates the change

Decision — the conflict resolution between the two source reports, where one exists

Action — the concrete schema delta

1. CONFLICT RESOLUTION — WHERE THE TWO REPORTS DISAGREE 
Both source reports are largely complementary, but they take different stances on five technical questions. The MVP can ship either way; this document picks one and the rest of the file assumes it.

#

Question

SCHEMA_GAPS says

SCALABILITY says

Master decision

Reason

1

Store money as Float or Int paise?

Float everywhere

Int paise everywhere

Int paise for all new money fields; leave existing Float fields as-is until a tracked migration

Razorpay APIs are paise-native. Float will introduce rounding errors on commission splits and refunds. Existing fields keep Float for MVP to avoid a high-blast-radius migration; every new money field is Int paise. Tracked tech-debt for Phase 2 cutover.

2

EscrowTransaction.status default?

Keep HELD

Change to PAYMENT_PENDING, make heldAt nullable

PAYMENT_PENDING, heldAt DateTime?

A row is created at orders.create time, before payment is captured. Defaulting to HELD makes an unpaid order indistinguishable from real held money — breaks the Pattern 10 escrow rule. This is a correctness fix.

3

phone String? @unique on User?

Yes — MongoDB skips nulls

Risky without a partial index

Make phone String? @unique BUT add an app-layer uniqueness check + a manual partial index in MongoDB

Prisma cannot express partial indexes for MongoDB. @unique works on populated values, but Prisma's docs warn about it for nullable fields. We get the schema declaration and enforce uniqueness on insert/update in code. Same caveat applies to ContentBlock.slug String? @unique.

4

Stringly-typed status fields where an enum already exists?

Silent on it

Convert all to the existing enums

Convert all of them now (Lead.buyerFeedbackStatus, UserSubscription.paymentStatus, B2BConnection.status, VideoTourRequest.status, UserDocument.status)

Enums (BuyerFeedbackStatus, PaymentStatus, B2BConnectionStatus, VideoTourStatus, DocumentStatus) already exist in _base.prisma and are unused. Leaving them as String defers the cost to every controller that has to validate strings.

5

Commission tracking on Lead or in a separate CommissionInvoice model?

On Lead (six nullable fields)

Either/or; prefers CommissionInvoice if you need history

Both — add the six summary fields on Lead now (Phase-2-ready); add CommissionInvoice only when Phase 2 needs invoice history (partial payments, disputes, regeneration)

Summary fields keep dashboards fast. The invoice model is genuinely deferrable.

2. P0 — MVP SHIP-BLOCKERS 
2.1 User.phone uniqueness + phoneVerifiedAt 
PRD anchor: MVP §6 (phone String @unique), Phase 2 Appendix A.1, MVP §2.5 (lazy phone verification), Pattern 5.

Why it's P0: Two users can register with the same phone today → OTP delivery and the entire WATI WhatsApp flow break. The phone-verification flow is explicitly one-time-only, so we need a timestamp.

Action — user.prisma:

auto
phone           String?   @unique  // see Conflict #3: also enforce in app code
phoneVerifiedAt DateTime?

Add app-level check before insert/update (Conflict #3). Add manual MongoDB partial unique index outside Prisma if hardening becomes necessary.

2.2 EscrowTransaction payment-state correctness 
PRD anchor: Pattern 10 (Razorpay Route), Anti-Leakage Rule 6 (escrow MUST be HELD before close), Phase 2 Appendix A.5.

Why it's P0: Current schema defaults status: HELD and heldAt: now() at row creation — but rows are created at order time, before the payment.captured webhook. A failed payment leaves a phantom "held" row that satisfies Rule 6's check and lets a deal close without real money.

Action — escrow.prisma:

auto
model EscrowTransaction {
  id                 String       @id @default(auto()) @map("_id") @db.ObjectId
  leadId             String       @db.ObjectId
  lead               Lead         @relation(fields: [leadId], references: [id])
  buyerId            String       @db.ObjectId

  razorpayOrderId    String       @unique
  razorpayPaymentId  String?
  razorpayTransferId String?      // for split releases via Route
  razorpayRefundId   String?      // for refund traceability

  // Money: kept as Float for MVP to avoid a wide migration; tracked tech-debt.
  amount             Float
  currency           String       @default("INR")

  status             EscrowStatus @default(PAYMENT_PENDING)  // CHANGED from HELD
  heldAt             DateTime?    // CHANGED from default(now()) — set on webhook capture
  releasedAt         DateTime?
  refundedAt         DateTime?
  failedAt           DateTime?
  cancelledAt        DateTime?

  releasedByAdminId  String?      @db.ObjectId
  adminNote          String?
  createdAt          DateTime     @default(now())
  updatedAt          DateTime     @updatedAt

  @@index([leadId])
  @@index([buyerId])
  @@index([status])
  @@index([status, createdAt])
}

Also extend the enum if needed in _base.prisma:

auto
enum EscrowStatus { PAYMENT_PENDING HELD RELEASED REFUNDED FAILED CANCELLED }

Rule-6 contract update: Lead can transition to CLOSED only when an EscrowTransaction with status = HELD AND razorpayPaymentId IS NOT NULL exists.

2.3 Lead — drop trail + buyer-feedback enum + second follow-up 
PRD anchor: Phase 2 Appendix C.2 (two-tier drop permission), Appendix C.4 (7-day STILL_DECIDING follow-up), MVP Anti-Leakage Rules 1, 5–7, Pattern 9.

Why it's P0: Without these fields:

Partner can drop a lead with no audit trail → Anti-Leakage Rule 1 collapses.

The 7-day re-ping cron has nothing to query against → causes duplicate WhatsApp spam.

buyerFeedbackStatus is a free-form String? despite the BuyerFeedbackStatus enum already existing.

Action — lead.prisma:

auto
// Convert from String? to enum (see Conflict #4)
buyerFeedbackStatus     BuyerFeedbackStatus?

// 7-day re-ping for STILL_DECIDING (Appendix C.4)
secondFollowupSentAt    DateTime?

// Two-tier drop system (Appendix C.2) — Partners REQUEST, Admin EXECUTES
dropRequestedByPartner  Boolean   @default(false)
dropRequestNote         String?
dropRequestedAt         DateTime?
droppedReason           String?   // Admin's reason at drop time
droppedAt               DateTime?
droppedByAdminId        String?   @db.ObjectId

@@index([buyerFeedbackStatus])
@@index([dropRequestedByPartner])
@@index([assignedPartnerId, status])
@@index([status, createdAt])

Cron contract: WHERE buyerFeedbackStatus = 'STILL_DECIDING' AND feedbackReceivedAt < now()-7d AND secondFollowupSentAt IS NULL.

2.4 New model — LocalityInsight 
PRD anchor: MVP §8 Page 3 (Property Detail "Locality Insights" panel), Priya's journey §3.3, Phase 2 Appendix A.2.

Why it's P0: The property detail page promises a price-benchmark badge (Good Deal / Fair / Above Market) and nearby-infra tags. No model = feature cannot be built. Both reports agree this is MVP, not Phase 2.

Action — new file locality.prisma:

auto
// Powers /properties/[slug] "Locality Insights" panel.
// Admin-managed (monthly refresh) via /admin/cms/locality-insights.
model LocalityInsight {
  id                       String   @id @default(auto()) @map("_id") @db.ObjectId
  city                     String
  locality                 String
  citySlug                 String?
  localitySlug             String?

  // Money in paise (see Conflict #1 — new fields use Int paise)
  avgPricePerSqftPaise     Int
  minPricePerSqftPaise     Int?
  maxPricePerSqftPaise     Int?
  avgRentPerMonthPaise     Int?

  priceChangeLastMonthPct  Float?   // e.g. +2.3 or -1.1

  nearbyInfra              String[] // ["Metro: 500m", "ITPL: 1.2km"]
  dataAsOfDate             DateTime
  updatedByAdminId         String?  @db.ObjectId
  createdAt                DateTime @default(now())
  updatedAt                DateTime @updatedAt

  @@unique([city, locality])
  @@index([city])
  @@index([citySlug, localitySlug])
}

Comparison logic (controller, not schema):

auto
const pricePerSqftPaise = (property.price * 100) / property.carpetArea;
const diff = ((pricePerSqftPaise - insight.avgPricePerSqftPaise) / insight.avgPricePerSqftPaise) * 100;
// diff < -3% → "Good Deal" ; diff > +5% → "Above Market" ; else "Fair Price"

2.5 New model — LoanApplication 
PRD anchor: MVP §11 (User Dashboard module /dashboard/loan), Priya's journey §3.3 ("Documents Verified → Sent to HDFC → Awaiting Sanction"), Phase 2 Appendix A.3.

Why it's P0: The route exists in MVP nav. The LoanStatus enum exists. The model does not.

Action — new file loan.prisma:

auto
model LoanApplication {
  id                       String     @id @default(auto()) @map("_id") @db.ObjectId
  userId                   String     @db.ObjectId
  user                     User       @relation(fields: [userId], references: [id])
  propertyId               String?    @db.ObjectId
  property                 Property?  @relation(fields: [propertyId], references: [id])

  preferredBank            String?    // "HDFC" | "SBI" | "ICICI" | "AXIS"
  loanAmountRequestedPaise Int?
  sanctionedAmountPaise    Int?

  status                   LoanStatus @default(DOCUMENTS_PENDING)
  statusHistory            String[]   // JSON snapshots [{status,timestamp,note}]
  adminNote                String?
  bankRefNumber            String?
  sanctionedAt             DateTime?
  disbursedAt              DateTime?
  rejectionReason          String?

  submittedDocIds          String[]   // UserDocument IDs already in Vault

  createdAt                DateTime   @default(now())
  updatedAt                DateTime   @updatedAt

  @@index([userId])
  @@index([status])
  @@index([userId, status])
  @@index([propertyId])
}

Add LoanStatus enum to _base.prisma if not already there:

auto
enum LoanStatus {
  DOCUMENTS_PENDING DOCUMENTS_SUBMITTED DOCUMENTS_VERIFIED
  SENT_TO_BANK AWAITING_SANCTION SANCTIONED DISBURSED REJECTED
}

Back-relations:

auto
model User     { loanApplications LoanApplication[] }
model Property { loanApplications LoanApplication[] }

2.6 New model — PropertyEditLog 
PRD anchor: Phase 2 Appendix C.7 — "Admin can edit any property. Partner can see a full trail of every Admin edit … but CANNOT revert."

Why it's P0: MVP gives Admin unrestricted edit rights on any listing. Without an immutable log, Partner trust collapses and the transparency promise in C.7 is unimplementable.

Action — new file editlog.prisma:

auto
model PropertyEditLog {
  id           String   @id @default(auto()) @map("_id") @db.ObjectId
  propertyId   String   @db.ObjectId
  property     Property @relation(fields: [propertyId], references: [id])

  editedBy     String   @db.ObjectId   // Admin userId
  editedByName String                  // snapshot — survives admin renames
  fieldChanged String                  // e.g. "price", "publishStatus"
  oldValue     String?                 // JSON-stringified
  newValue     String?
  editNote     String?

  editedAt     DateTime @default(now())

  @@index([propertyId])
  @@index([propertyId, editedAt])
  @@index([editedBy])
}

Back-relation:

auto
model Property { editLogs PropertyEditLog[] }

Trigger contract: every PATCH /api/admin/properties/[id] writes one row per changed field, plus a PROPERTY_EDITED_BY_ADMIN notification to the listing's partnerId.

2.7 Favorite uniqueness 
PRD anchor: §11 (User favorites).

Why it's P0: Without @@unique([userId, propertyId]), a user can favorite the same property N times and clutter their dashboard.

auto
model Favorite { @@unique([userId, propertyId]) }

3. P1 — ADD NOW (PHASE 2 READY) 
These are cheap-to-add nullable fields/relations or model stubs. Adding them now means the Phase 2 cut-over needs zero schema migration — only data/code changes.

3.1 _base.prisma — Phase 2 enums 
auto
enum CommissionStatus { PENDING INVOICED COLLECTED DISPUTED }
// LoanStatus — already added in §2.5

3.2 user.prisma — Premium B2B subscription fields 
PRD anchor: Phase 2 §2.3, Pattern 13, §16 Cron, Email B.11 expiry warning.

auto
isPremiumPartner   Boolean   @default(false)
premiumValidUntil  DateTime?
premiumOrderId     String?   // Razorpay subscription order ID

// Back-relations for new models below
partnerSubscriptions  PartnerSubscription[]  // §4.1
loanApplications      LoanApplication[]      // §2.5

Keep isPremiumPartner + premiumValidUntil as denormalized fields even after PartnerSubscription exists — fast route guards and expiry crons read from User, not from a join.

3.3 lead.prisma — Commission summary fields 
PRD anchor: Phase 2 Appendix C.1 (Admin sets commission % manually per closed deal).

Both reports agree on six fields on Lead. Master decision (Conflict #5): keep them on Lead; layer CommissionInvoice (§4.2) on top only if invoice history is needed.

auto
platformCommissionPct  Float?                 // Admin enters per deal — NOT auto-calculated
commissionAmountPaise  Int?                   // Conflict #1: paise for new field
commissionStatus       CommissionStatus @default(PENDING)
invoiceUrl             String?
invoicedAt             DateTime?
collectedAt            DateTime?

@@index([commissionStatus])

3.4 property.prisma — Phase 2 media + B2B + back-relations 
PRD anchor: Phase 2 §6, B2B Pattern 13.

auto
// Phase 2 media
virtualTourUrl       String?
videoUrl             String?

// Phase 2 B2B
isB2BOnly            Boolean  @default(false)
commissionSplitOffer String?

// Back-relations (Conflict #4 — also fix B2BConnection/VideoTourRequest below)
b2bConnections       B2BConnection[]
videoTourRequests    VideoTourRequest[]
editLogs             PropertyEditLog[]        // §2.6
loanApplications     LoanApplication[]        // §2.5
boosts               ListingBoost[]           // §4.3

3.5 Apply existing-but-unused enums 
These four are all flagged by the SCALABILITY report and confirmed against the PRD. Do them in the same migration as P0 lead/escrow changes.

Model.field

Was

Becomes

Lead.buyerFeedbackStatus

String?

BuyerFeedbackStatus? (in §2.3)

UserSubscription.paymentStatus

String

PaymentStatus @default(PENDING)

B2BConnection.status

String @default("INTERESTED")

B2BConnectionStatus @default(INTERESTED)

VideoTourRequest.status

String @default("PENDING")

VideoTourStatus @default(PENDING)

UserDocument

isVerified Boolean only

add status DocumentStatus @default(PENDING_REVIEW), keep isVerified as denormalized read-cache

3.6 b2b.prisma — Property relation + uniqueness + indexes 
PRD anchor: Pattern 13.

auto
model B2BConnection {
  // ... existing fields ...
  property   Property @relation(fields: [propertyId], references: [id])  // NEW relation
  status     B2BConnectionStatus @default(INTERESTED)                    // §3.5
  updatedAt  DateTime @updatedAt                                         // NEW

  @@unique([buyerPartnerId, propertyId])  // prevents duplicate interest rows
  @@index([listingPartnerId])
  @@index([buyerPartnerId])
  @@index([propertyId])
  @@index([status])
}

3.7 video.prisma — Property relation + completion fields 
PRD anchor: NRI feature (MVP §2.4 "Request video tours" + Phase 2 Pattern 14).

auto
model VideoTourRequest {
  // ... existing fields ...
  property    Property @relation(fields: [propertyId], references: [id])  // NEW
  status      VideoTourStatus @default(PENDING)                           // §3.5
  userNote    String?
  adminNote   String?
  completedAt DateTime?

  @@index([userId])
  @@index([propertyId])
  @@index([status])
  @@index([assignedTo])
}

3.8 document.prisma — Verification lifecycle 
PRD anchor: Pattern 12 (Document Vault), Priya's loan-tracker journey.

auto
model UserDocument {
  // ... existing fields ...
  status            DocumentStatus @default(PENDING_REVIEW)  // §3.5
  verifiedByAdminId String?        @db.ObjectId
  rejectionNote     String?
  expiresAt         DateTime?

  @@index([userId])
  @@index([userId, status])
  @@index([documentType])
}

3.9 Search & dashboard compound indexes 
PRD anchor: Phase 2 §16 NFR — "sub-100ms search".

auto
model Property {
  @@index([publishStatus, isB2BOnly])
  @@index([city, locality, publishStatus])
  @@index([propertyType, listingType, publishStatus])
  @@index([city, propertyType, listingType, publishStatus])
  @@index([partnerId, publishStatus])
  @@index([isFeatured, publishStatus])
}

model Lead {
  @@index([status, createdAt])
  @@index([propertyId, status])
  @@index([buyerId, createdAt])
}

model ServiceTicket {
  @@index([status, createdAt])
  @@index([userId, status])
  @@index([subscriptionId, status])
}

model ContentBlock {
  @@index([type, isPublished])
  @@index([isPublished, publishedAt])
}

3.10 AuditLog & Notification polish 
PRD anchor: Pattern 2 (audit on every assignment), MVP §13 Email/WhatsApp layer.

auto
model AuditLog {
  actorRole String?
  requestId String?
  metadata  String?
  @@index([targetType, targetId])
  @@index([action, createdAt])
}

model Notification {
  readAt    DateTime?
  metadata  String?
  channel   String?   // IN_APP | EMAIL | WHATSAPP
  @@index([type])
  @@index([createdAt])
  @@index([userId, isRead])
}

4. P2 — PHASE 2 ONLY (DEFERRABLE) 
These are not recommended for MVP unless Phase 2 ships at the same time. Document the shape now so the team doesn't make incompatible choices.

4.1 PartnerSubscription model 
PRD anchor: Phase 2 §1.3 Revenue Stream 2 (₹4,999/month premium), Pattern 13.

Why a separate model: UserSubscription represents user-purchased services (per-purchase). A premium-plan B2B subscription is recurring partner SaaS — different lifecycle, different cron, different invoice. Overloading the existing model leaks concepts.

auto
model PartnerSubscription {
  id                String        @id @default(auto()) @map("_id") @db.ObjectId
  partnerId         String        @db.ObjectId
  partner           User          @relation(fields: [partnerId], references: [id])
  planCode          String        // "PREMIUM_B2B"
  status            PaymentStatus @default(PENDING)
  amountPaise       Int
  currency          String        @default("INR")
  razorpayOrderId   String?       @unique
  razorpayPaymentId String?
  startsAt          DateTime?
  validUntil        DateTime?
  cancelledAt       DateTime?
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt

  @@index([partnerId])
  @@index([status])
  @@index([validUntil])
}

Denormalized cache on User.isPremiumPartner + User.premiumValidUntil (§3.2) stays the source of truth for route guards.

4.2 CommissionInvoice model (only if needed) 
PRD anchor: Phase 2 Appendix C.1.

Add only when Phase 2 needs invoice-level history (partial payments, disputes, PDF regeneration). Otherwise the six summary fields on Lead (§3.3) are enough.

auto
model CommissionInvoice {
  id                    String           @id @default(auto()) @map("_id") @db.ObjectId
  leadId                String           @db.ObjectId
  lead                  Lead             @relation(fields: [leadId], references: [id])
  partnerId             String           @db.ObjectId
  issuedByAdminId       String           @db.ObjectId
  platformCommissionPct Float
  amountPaise           Int
  status                CommissionStatus @default(INVOICED)
  invoiceUrl            String?
  razorpayOrderId       String?
  razorpayPaymentId     String?
  issuedAt              DateTime         @default(now())
  paidAt                DateTime?
  disputedAt            DateTime?
  adminNote             String?

  @@index([leadId])
  @@index([partnerId, status])
  @@index([status, issuedAt])
}

4.3 ListingBoost model 
PRD anchor: Phase 2 §1.3 Revenue Stream 5.

auto
model ListingBoost {
  id                String        @id @default(auto()) @map("_id") @db.ObjectId
  propertyId        String        @db.ObjectId
  property          Property      @relation(fields: [propertyId], references: [id])
  partnerId         String        @db.ObjectId
  placement         String        // HOME_FEATURED | SEARCH_TOP | CITY_FEATURED
  status            PaymentStatus @default(PENDING)
  amountPaise       Int
  currency          String        @default("INR")
  startsAt          DateTime?
  endsAt            DateTime?
  razorpayOrderId   String?       @unique
  razorpayPaymentId String?
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt

  @@index([propertyId])
  @@index([partnerId])
  @@index([status, startsAt, endsAt])
}

4.4 BuilderProject + ProjectUnit (microsite scalability) 
PRD anchor: Pattern 16 (Microsite Builder). MVP allows microsites via single Property rows; Phase 2 needs multiple unit configurations under one project.

If/when this lands, decide explicitly whether ConstructionUpdate attaches to Property or BuilderProject — supporting both is a maintenance trap.

(Schema shapes already specified in the SCALABILITY report §8; not duplicated here. Adopt verbatim when scoping Phase 2.)

4.5 Operational history tables (optional) 
LeadEvent, ServiceTicketEvent, NotificationDelivery, BulkUploadBatch + BulkUploadItem — useful when Admin reporting needs filterable timelines instead of String[] statusHistory. Not gating Phase 2.

4.6 ServiceVendor model 
Replace vendorName String? / vendorPhone String? on ServiceTicket with a vendor table + assignedVendorId + dispatchedAt/closedAt. Defer until repeat-dispatch becomes the norm.

5. DEVELOPER ACTION CHECKLIST (P0 + P1, in migration order) 
Sequenced to minimize churn and avoid mid-migration broken states.

auto
WAVE 1 — Enum-only migration (zero data risk)
[ ] _base.prisma : add CommissionStatus, LoanStatus (LoanStatus may already exist)
[ ] _base.prisma : extend EscrowStatus with PAYMENT_PENDING, FAILED, CANCELLED

WAVE 2 — Use existing enums in models (Conflict #4)
[ ] lead.prisma          : buyerFeedbackStatus → BuyerFeedbackStatus?
[ ] service.prisma       : UserSubscription.paymentStatus → PaymentStatus
[ ] b2b.prisma           : status → B2BConnectionStatus
[ ] video.prisma         : status → VideoTourStatus
[ ] document.prisma      : add status DocumentStatus (keep isVerified bool)

WAVE 3 — P0 correctness fixes
[ ] escrow.prisma        : default → PAYMENT_PENDING ; heldAt → DateTime? ; add Transfer/Refund IDs ; add failedAt/cancelledAt + indexes
[ ] user.prisma          : phone → String? @unique ; add phoneVerifiedAt
[ ] lead.prisma          : add 6 drop-trail fields + secondFollowupSentAt + indexes
[ ] property.prisma      : add editLogs back-relation

WAVE 4 — P0 new MVP models
[ ] locality.prisma      : LocalityInsight (new file)
[ ] loan.prisma          : LoanApplication (new file) + back-relations on User & Property
[ ] editlog.prisma       : PropertyEditLog (new file)

WAVE 5 — P1 Phase-2-ready scaffolding (all nullable / non-breaking)
[ ] user.prisma          : isPremiumPartner, premiumValidUntil, premiumOrderId
[ ] lead.prisma          : commission summary fields (×6, paise Int)
[ ] property.prisma      : virtualTourUrl, videoUrl, isB2BOnly, commissionSplitOffer
[ ] property.prisma      : back-relations (b2bConnections, videoTourRequests, loanApplications)
[ ] b2b.prisma           : add property relation, @@unique([buyerPartnerId, propertyId]), updatedAt, indexes
[ ] video.prisma         : add property relation, completedAt, userNote/adminNote, indexes
[ ] document.prisma      : verifiedByAdminId, rejectionNote, expiresAt, indexes

WAVE 6 — Indexes & uniqueness
[ ] property.prisma      : 6 compound search indexes
[ ] lead.prisma          : status/createdAt, propertyId/status, buyerId/createdAt
[ ] service.prisma       : ServiceTicket indexes
[ ] cms.prisma           : type/isPublished, isPublished/publishedAt
[ ] favorite             : @@unique([userId, propertyId])
[ ] audit.prisma         : actorRole, requestId, metadata + 2 indexes
[ ] notification.prisma  : readAt, channel, metadata + 3 indexes

API & CRON IMPLICATIONS (track as separate tickets, not schema-only)
[ ] GET   /api/locality-insights?city=&locality=
[ ] POST  /api/user/loan
[ ] GET   /api/user/loan
[ ] GET   /api/user/loan/[id]
[ ] PATCH /api/admin/loan/[id]/status
[ ] Hook  PATCH /api/admin/properties/[id] → write PropertyEditLog row per changed field + PROPERTY_EDITED_BY_ADMIN notification
[ ] Cron  (daily) — 7-day STILL_DECIDING re-ping → set secondFollowupSentAt
[ ] Cron  (hourly, Phase 2) — premium expiry → set isPremiumPartner=false where premiumValidUntil < now()
[ ] Cron  (daily, Phase 2) — premium expiry warning (Email B.11) — 3 days before premiumValidUntil
[ ] App-layer uniqueness check on User.phone (Conflict #3)
[ ] Manual MongoDB partial index on User.phone (optional hardening)

6. ALREADY CORRECT — DO NOT TOUCH 
For completeness (cross-checked against both PRDs):

Surface

Status

Core enums in _base.prisma (Role, PartnerSubType, PropertyType, ListingType, PublishStatus, PropertyStatus, LeadStatus, KycStatus, TicketStatus)

✅ match PRD §6

Clerk integration via clerkId replacing hashedPassword

✅ MVP §7 architecture

Phone OTP fields on User (otpGeneratedAt, otpAttempts, otpLockedUntil, etc.)

✅ MVP §2.5 Pattern 5

OTP anti-leakage fields on Lead (siteVisitOTP, otpExpiresAt, isOtpVerified, otpVerifiedAt, whatsappSentAt)

✅ Anti-Leakage §5 Rules 1–7

EscrowTransaction core fields (leadId, razorpayOrderId @unique, releasedByAdminId, adminNote)

✅ Pattern 10 — only the defaults need fixing (§2.2)

Service, UserSubscription, ServiceTicket, service relation

✅ Pattern 11/15

ConstructionUpdate (Phase 2-ready as-is)

✅ Pattern 14

ContentBlock for Admin CMS

✅ §9

AuditLog shape

✅ Pattern 2 — only adding fields, not restructuring

ContactMessage

✅ Pattern 1

7. SUMMARY: ONE-PAGE CHEAT SHEET 
P0 (ship-blocking, MVP):

User.phone unique + phoneVerifiedAt

EscrowTransaction defaults → PAYMENT_PENDING, heldAt nullable, add transfer/refund IDs

Lead drop trail (6 fields) + secondFollowupSentAt + buyerFeedbackStatus enum

New LocalityInsight

New LoanApplication

New PropertyEditLog

Favorite unique constraint

P1 (cheap now, prevents Phase 2 migration):
8. Premium B2B fields on User
9. Commission summary fields on Lead
10. virtualTourUrl / videoUrl / isB2BOnly / commissionSplitOffer on Property
11. Adopt existing enums on UserSubscription, B2BConnection, VideoTourRequest, UserDocument
12. Property relations on B2BConnection and VideoTourRequest + uniqueness on B2BConnection
13. Compound indexes for property search, lead dashboards, ticket dashboards
14. AuditLog / Notification operational fields

P2 (Phase 2 — design but don't build now):
15. PartnerSubscription
16. CommissionInvoice (only if invoice history needed)
17. ListingBoost
18. BuilderProject + ProjectUnit
19. Operational history tables (LeadEvent, ServiceTicketEvent, NotificationDelivery, BulkUploadBatch)
20. ServiceVendor

Tech debt parked: migrate all Float money fields to Int paise during Phase 2 cutover (currently mixed; new fields already use paise).

End of master suggestions — cross-referenced against mvp_prd.md §§1–16, phase2_prd.md §§1–16 + Appendices A.1–A.5, C.1–C.7, D.1–D.3.

