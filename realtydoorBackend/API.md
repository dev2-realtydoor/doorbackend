# RealtyDoor Backend — API Reference

---

## Overview

**Base URL:** `http://localhost:5000/api` (dev) · `https://api.realtydoor.in/api` (prod)

### Authentication

All protected routes require a Clerk JWT in the `Authorization` header:

```
Authorization: Bearer <clerk_session_token>
```

Roles: `USER` · `PARTNER` · `ADMIN`

### Response Envelope

```json
{
  "success": true,
  "message": "Success",
  "data": { ... }
}
```

Error response:

```json
{
  "success": false,
  "message": "Error description"
}
```

### Paginated Responses

Paginated endpoints return this shape inside `data`:

```json
{
  "data": [ ... ],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

Default: `page=1`, `limit=20`.

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK |
| 201 | Created |
| 204 | No Content (DELETE) |
| 400 | Bad Request / Validation error |
| 401 | Unauthenticated |
| 403 | Forbidden (wrong role / KYC not verified) |
| 404 | Not found |
| 409 | Conflict (duplicate) |
| 429 | Rate limited / OTP locked |
| 500 | Server error |

---

## 1. Auth

### POST /api/auth/sync

Verifies Clerk JWT, upserts DB user record, returns profile.

**Auth:** Clerk JWT in `Authorization` header (token verified manually, no middleware)

**Request Body:** _(none)_

**Response `200`:**

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "id": "64abc...",
    "clerkId": "user_2abc...",
    "name": "Rajdeep Kumar",
    "email": "rajdeep@example.com",
    "phone": "+919876543210",
    "phoneVerified": true,
    "phoneVerifiedAt": "2024-01-15T10:30:00.000Z",
    "role": "USER",
    "isNRI": false,
    "profileImageUrl": "https://img.clerk.com/...",
    "partnerSubType": null,
    "companyName": null,
    "bio": null,
    "websiteUrl": null,
    "kycStatus": "NOT_SUBMITTED",
    "kycVerifiedAt": null,
    "kycRejectionNote": null,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

---

### GET /api/auth/me

Returns the full profile for the authenticated user including active subscription and unread notification count.

**Auth:** Required (any role)

**Response `200`:**

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "id": "64abc...",
    "clerkId": "user_2abc...",
    "name": "Rajdeep Kumar",
    "email": "rajdeep@example.com",
    "phone": "+919876543210",
    "phoneVerified": true,
    "phoneVerifiedAt": "2024-01-15T10:30:00.000Z",
    "role": "PARTNER",
    "isNRI": false,
    "profileImageUrl": "https://img.clerk.com/...",
    "partnerSubType": "AGENT",
    "companyName": "RealtyPro Solutions",
    "bio": "10 years in Pune real estate.",
    "websiteUrl": "https://realtypro.in",
    "kycStatus": "VERIFIED",
    "kycVerifiedAt": "2024-02-01T00:00:00.000Z",
    "kycRejectionNote": null,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-02-01T00:00:00.000Z",
    "unreadNotifications": 3,
    "activeSubscription": {
      "plan": "Maintenance Premium",
      "paymentStatus": "SUCCESS",
      "expiresAt": "2025-02-01T00:00:00.000Z"
    }
  }
}
```

`activeSubscription` is `null` if the user has no subscription.

---

### POST /api/auth/set-role

Self-service role upgrade: `USER` → `PARTNER` only. Idempotent if already PARTNER.

**Auth:** Required (USER)

**Request Body:**

```json
{ "role": "PARTNER" }
```

**Response `200`:**

```json
{
  "success": true,
  "message": "Success",
  "data": { "role": "PARTNER" }
}
```

**Errors:** `400` if role is not `"PARTNER"`.

---

## 2. Properties

### GET /api/properties

Search published, non-B2B properties.

**Auth:** Public

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `q` | string | Full-text search (title, description, locality) |
| `city` | string | Case-insensitive exact match |
| `locality` | string | Case-insensitive contains |
| `propertyType` | string | `FLAT` · `INDEPENDENT_HOUSE` · `VILLA` · `PLOT` · `COMMERCIAL_OFFICE` · `RETAIL_SHOP` |
| `listingType` | string | `SALE` · `RENT` · `LEASE` |
| `propertyStatus` | string | `READY_TO_MOVE` · `UNDER_CONSTRUCTION` |
| `bhk` | number | Number of bedrooms |
| `minPrice` | number | Min price (₹) |
| `maxPrice` | number | Max price (₹) |
| `minArea` | number | Min carpet area (sq ft) |
| `maxArea` | number | Max carpet area (sq ft) |
| `furnishing` | string | Free text e.g. `Furnished` |
| `isVerified` | boolean | Filter verified listings |
| `amenities` | string | Comma-separated e.g. `Gym,Pool` |
| `sort` | string | `price_asc` · `price_desc` · `newest` · `area_asc` (default: `newest`) |
| `page` | number | Default: `1` |
| `limit` | number | Default: `20` |

**Response `200`:**

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "data": [
      {
        "id": "64abc...",
        "title": "3 BHK Flat in Baner",
        "slug": "3-bhk-flat-in-baner-1700000000000",
        "price": 8500000,
        "monthlyRent": null,
        "propertyType": "FLAT",
        "listingType": "SALE",
        "propertyStatus": "READY_TO_MOVE",
        "bhk": 3,
        "carpetArea": 1200,
        "locality": "Baner",
        "city": "Pune",
        "images": ["https://cdn.realtydoor.in/prop1.jpg"],
        "coverImageIndex": 0,
        "isVerified": true,
        "isFeatured": false,
        "reraNumber": "P52100012345",
        "createdAt": "2024-01-10T00:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 45,
      "page": 1,
      "limit": 20,
      "totalPages": 3,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

---

### GET /api/properties/featured

Returns up to 12 featured approved listings.

**Auth:** Public

**Response `200`:**

```json
{
  "success": true,
  "message": "Success",
  "data": [
    {
      "id": "64abc...",
      "title": "Luxury Villa in Koregaon Park",
      "slug": "luxury-villa-koregaon-park-1700000000000",
      "price": 25000000,
      "monthlyRent": null,
      "propertyType": "VILLA",
      "listingType": "SALE",
      "bhk": 4,
      "locality": "Koregaon Park",
      "city": "Pune",
      "images": ["https://cdn.realtydoor.in/villa1.jpg"],
      "coverImageIndex": 0,
      "isVerified": true
    }
  ]
}
```

---

### GET /api/properties/:slug

Full property detail for a single approved listing.

**Auth:** Public

**Response `200`:**

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "id": "64abc...",
    "title": "3 BHK Flat in Baner",
    "slug": "3-bhk-flat-in-baner-1700000000000",
    "description": "Spacious 3 BHK with great amenities...",
    "price": 8500000,
    "monthlyRent": null,
    "priceNegotiable": true,
    "propertyType": "FLAT",
    "listingType": "SALE",
    "propertyStatus": "READY_TO_MOVE",
    "publishStatus": "APPROVED",
    "isFeatured": false,
    "isVerified": true,
    "bhk": 3,
    "bathrooms": 2,
    "carpetArea": 1200,
    "builtUpArea": 1400,
    "plotArea": null,
    "floorNumber": 4,
    "totalFloors": 10,
    "ageOfProperty": 2,
    "furnishing": "Semi-Furnished",
    "facing": "East",
    "possessionDate": null,
    "address": "Plot 12, Baner Road",
    "locality": "Baner",
    "city": "Pune",
    "state": "Maharashtra",
    "pincode": "411045",
    "latitude": 18.5596,
    "longitude": 73.7769,
    "nearbyLandmarks": ["D-Mart", "Orchid School"],
    "reraNumber": "P52100012345",
    "bankApprovals": ["SBI", "HDFC"],
    "images": ["https://cdn.realtydoor.in/prop1.jpg"],
    "coverImageIndex": 0,
    "floorPlanUrl": null,
    "virtualTourUrl": null,
    "videoUrl": null,
    "amenities": ["Gym", "Swimming Pool", "24x7 Security"],
    "societyFeatures": ["Club House", "Children's Play Area"],
    "metaTitle": null,
    "metaDescription": null,
    "createdAt": "2024-01-10T00:00:00.000Z",
    "updatedAt": "2024-01-15T00:00:00.000Z",
    "partner": {
      "companyName": "RealtyPro Solutions",
      "partnerSubType": "AGENT"
    }
  }
}
```

**Errors:** `404` if not found or not approved.

---

### POST /api/properties

Create a new property listing (submitted for admin review).

**Auth:** PARTNER + KYC verified

**Request Body:**

```json
{
  "title": "3 BHK Flat in Baner",
  "description": "Spacious apartment with modern amenities in prime location.",
  "propertyType": "FLAT",
  "listingType": "SALE",
  "propertyStatus": "READY_TO_MOVE",
  "price": 8500000,
  "priceNegotiable": true,
  "bhk": 3,
  "bathrooms": 2,
  "carpetArea": 1200,
  "builtUpArea": 1400,
  "floorNumber": 4,
  "totalFloors": 10,
  "ageOfProperty": 2,
  "furnishing": "Semi-Furnished",
  "facing": "East",
  "address": "Plot 12, Baner Road",
  "locality": "Baner",
  "city": "Pune",
  "state": "Maharashtra",
  "pincode": "411045",
  "latitude": 18.5596,
  "longitude": 73.7769,
  "nearbyLandmarks": ["D-Mart", "Orchid School"],
  "amenities": ["Gym", "Swimming Pool"],
  "societyFeatures": ["Club House"],
  "reraNumber": "P52100012345"
}
```

Fields `publishStatus`, `isVerified`, `partnerId` are silently stripped.

**Response `201`:**

```json
{
  "success": true,
  "message": "Listing submitted for review",
  "data": {
    "id": "64abc...",
    "slug": "3-bhk-flat-in-baner-1700000000000",
    "publishStatus": "PENDING_APPROVAL",
    "partnerId": "64partner...",
    "createdAt": "2024-01-10T00:00:00.000Z"
  }
}
```

---

### PATCH /api/properties/:id

Update own listing. Fields `publishStatus`, `isVerified`, `partnerId` are stripped.

**Auth:** PARTNER + KYC verified

**Request Body:** Partial property fields (same as POST).

**Response `200`:**

```json
{ "success": true, "message": "Listing updated", "data": { ... } }
```

**Errors:** `403` not your listing · `404` not found.

---

### POST /api/properties/:id/images

Upload images to a listing.

**Auth:** PARTNER (KYC not required)

**Request:** `multipart/form-data`, field name `images`, up to 10 files.

**Response `200`:**

```json
{ "success": true, "message": "Images uploaded", "data": { "images": ["url1", "url2"] } }
```

**Errors:** `400` no images provided · `403` not your listing.

---

## 3. Leads

### POST /api/leads

Submit a buyer inquiry.

**Auth:** USER + phone verified

**Request Body:**

```json
{
  "propertyId": "64abc...",
  "buyerName": "Suresh Mehta",
  "buyerEmail": "suresh@example.com",
  "buyerPhone": "+919876543210",
  "buyerMessage": "Interested in a site visit this weekend."
}
```

`buyerMessage` is optional.

**Response `201`:**

```json
{
  "success": true,
  "message": "We'll reach out within 24 hours",
  "data": {
    "id": "64lead...",
    "buyerName": "Suresh Mehta",
    "buyerEmail": "suresh@example.com",
    "buyerPhone": "+919876543210",
    "propertyId": "64abc...",
    "status": "UNASSIGNED",
    "createdAt": "2024-01-15T10:00:00.000Z"
  }
}
```

---

### GET /api/leads/partner

All leads assigned to the authenticated partner. Phone is masked until OTP is verified.

**Auth:** PARTNER + KYC verified

**Response `200`:**

```json
{
  "success": true,
  "message": "Success",
  "data": [
    {
      "id": "64lead...",
      "buyerName": "Suresh Mehta",
      "buyerEmail": "suresh@example.com",
      "buyerPhone": "+91XXXXXX3210",
      "status": "ASSIGNED",
      "isOtpVerified": false,
      "assignedAt": "2024-01-15T12:00:00.000Z",
      "property": {
        "title": "3 BHK Flat in Baner",
        "slug": "3-bhk-flat-in-baner-...",
        "locality": "Baner",
        "city": "Pune"
      },
      "createdAt": "2024-01-15T10:00:00.000Z"
    }
  ]
}
```

---

### GET /api/leads/partner/:id

Single lead detail. Full property record included.

**Auth:** PARTNER + KYC verified

**Response `200`:**

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "id": "64lead...",
    "buyerName": "Suresh Mehta",
    "buyerPhone": "+91XXXXXX3210",
    "status": "ASSIGNED",
    "isOtpVerified": false,
    "siteVisitScheduledAt": null,
    "visitNotes": null,
    "visitPhotoUrls": [],
    "closureDocumentUrls": [],
    "property": { ... },
    "createdAt": "2024-01-15T10:00:00.000Z"
  }
}
```

`buyerPhone` is unmasked once `isOtpVerified` is `true`.  
**Errors:** `404` not found or not assigned to this partner.

---

### POST /api/leads/partner/:id/schedule-visit

Schedule a site visit and send a 4-digit OTP to the buyer via WhatsApp.

**Auth:** PARTNER + KYC verified

**Request Body:**

```json
{ "scheduledAt": "2024-01-20T10:00:00.000Z" }
```

**Response `200`:**

```json
{
  "success": true,
  "message": "Success",
  "data": { "message": "OTP sent to buyer via WhatsApp. Enter it at the site." }
}
```

**Errors:** `400` if lead is already closed.

---

### POST /api/leads/partner/:id/verify-otp

Verify the 4-digit site-visit OTP. Reveals buyer's full phone number on success.

**Auth:** PARTNER + KYC verified (rate-limited)

**Request Body:**

```json
{ "otp": "7412" }
```

**Response `200`:**

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "message": "OTP verified. Buyer contact revealed.",
    "buyerPhone": "+919876543210"
  }
}
```

**Errors:** `400` invalid/expired OTP · `429` too many attempts (lead locked, contact admin).

---

### PATCH /api/leads/partner/:id/document

Upload visit notes and files for a lead.

**Auth:** PARTNER + KYC verified

**Request:** `multipart/form-data`

| Field | Type | Description |
|-------|------|-------------|
| `visitNotes` | string | Notes about the visit |
| `partnerNotes` | string | Internal notes |
| `visitPhotos` | file[] | Up to 10 site photos |
| `closureDocs` | file[] | Up to 5 closure documents |

**Response `200`:**

```json
{
  "success": true,
  "message": "Documentation uploaded",
  "data": {
    "id": "64lead...",
    "visitNotes": "Buyer was very interested.",
    "visitPhotoUrls": ["https://..."],
    "closureDocumentUrls": ["https://..."]
  }
}
```

---

### PATCH /api/leads/partner/:id/close

Mark lead as closed. Requires an escrow with `status: HELD` and a captured payment. Irreversible by partner.

**Auth:** PARTNER + KYC verified

**Request Body:** _(none)_

**Response `200`:**

```json
{
  "success": true,
  "message": "Success",
  "data": { "message": "Lead marked as closed. Admin will review escrow release." }
}
```

**Errors:** `400` no HELD escrow with captured payment · `400` already closed.

---

## 4. User Dashboard

All `/api/user/*` routes require `authenticate` + `requireUser`.

### POST /api/user/verify-phone

Request a 4-digit phone verification OTP via WhatsApp.

**Auth:** USER (rate-limited)

**Request Body:**

```json
{ "phone": "+919876543210" }
```

**Response `200`:**

```json
{
  "success": true,
  "message": "Success",
  "data": { "message": "OTP sent via WhatsApp" }
}
```

**Errors:** `409` phone already registered to another account · `429` OTP locked.

---

### POST /api/user/verify-phone/otp

Verify the 4-digit OTP to confirm phone ownership.

**Auth:** USER (rate-limited)

**Request Body:**

```json
{ "otp": "7412" }
```

**Response `200`:**

```json
{
  "success": true,
  "message": "Phone number verified",
  "data": { "phoneVerified": true, "phone": "+919876543210" }
}
```

**Errors:** `400` OTP expired or wrong · `429` account locked 30 minutes.

---

### GET /api/user/leads

All inquiries submitted by the authenticated user.

**Auth:** USER

**Response `200`:**

```json
{
  "success": true,
  "message": "Success",
  "data": [
    {
      "id": "64lead...",
      "buyerName": "Suresh Mehta",
      "status": "ASSIGNED",
      "createdAt": "2024-01-15T10:00:00.000Z",
      "property": {
        "title": "3 BHK Flat in Baner",
        "slug": "3-bhk-flat-in-baner-...",
        "city": "Pune",
        "images": ["https://cdn.realtydoor.in/prop1.jpg"]
      }
    }
  ]
}
```

---

### POST /api/user/favorites

Toggle property in/out of favorites.

**Auth:** USER + phone verified

**Request Body:**

```json
{ "propertyId": "64abc..." }
```

**Response `200`:**

```json
{ "success": true, "message": "Success", "data": { "favorited": true } }
```

`favorited: false` when removed.

---

### GET /api/user/documents

All documents in the user's vault.

**Auth:** USER

**Response `200`:**

```json
{
  "success": true,
  "message": "Success",
  "data": [
    {
      "id": "64doc...",
      "documentType": "PAN_CARD",
      "fileUrl": "https://cdn.realtydoor.in/docs/pan.pdf",
      "fileName": "pan_card.pdf",
      "status": "PENDING_REVIEW",
      "isVerified": false,
      "uploadedAt": "2024-01-10T00:00:00.000Z"
    }
  ]
}
```

---

### POST /api/user/documents

Upload a document.

**Auth:** USER + phone verified

**Request:** `multipart/form-data`

| Field | Type | Description |
|-------|------|-------------|
| `file` | file | Single file |
| `documentType` | string | `PAN_CARD` · `AADHAR` · `SALARY_SLIP` · `FORM_16` · `BANK_STATEMENT` |

**Response `201`:**

```json
{
  "success": true,
  "message": "Document uploaded",
  "data": {
    "id": "64doc...",
    "documentType": "PAN_CARD",
    "fileUrl": "https://...",
    "fileName": "pan_card.pdf",
    "status": "PENDING_REVIEW",
    "isVerified": false,
    "uploadedAt": "2024-01-10T00:00:00.000Z"
  }
}
```

---

### GET /api/user/subscriptions

All service subscriptions with associated tickets.

**Auth:** USER

**Response `200`:**

```json
{
  "success": true,
  "message": "Success",
  "data": [
    {
      "id": "64sub...",
      "serviceId": "64svc...",
      "razorpayOrderId": "order_...",
      "razorpayPaymentId": "pay_...",
      "paymentStatus": "SUCCESS",
      "amountPaid": 4999,
      "currency": "INR",
      "startDate": "2024-01-10T00:00:00.000Z",
      "endDate": "2025-01-10T00:00:00.000Z",
      "tickets": [
        { "id": "64tkt...", "subject": "Plumbing leak", "status": "OPEN", "createdAt": "..." }
      ]
    }
  ]
}
```

---

### POST /api/user/tickets

Raise a service ticket under an active subscription.

**Auth:** USER + phone verified

**Request Body:**

```json
{
  "subscriptionId": "64sub...",
  "subject": "Plumbing leak in bathroom",
  "description": "Slow leak under the wash basin.",
  "category": "PLUMBING",
  "priority": "HIGH"
}
```

`category`: `PLUMBING` · `ELECTRICAL` · `PAINTING` · `GENERAL`  
`priority`: `NORMAL` (default) · `HIGH` · `URGENT`

**Response `201`:**

```json
{
  "success": true,
  "message": "Ticket raised",
  "data": {
    "id": "64tkt...",
    "subject": "Plumbing leak in bathroom",
    "status": "OPEN",
    "priority": "HIGH",
    "createdAt": "2024-02-01T00:00:00.000Z"
  }
}
```

**Errors:** `404` subscription not found · `400` service not active.

---

### PATCH /api/user/tickets/:id/verify

Confirm service was completed. Moves ticket to `VERIFIED_BY_USER`.

**Auth:** USER

**Request Body:** _(none)_

**Response `200`:**

```json
{
  "success": true,
  "message": "Ticket verified and closed",
  "data": { "id": "64tkt...", "status": "VERIFIED_BY_USER", "verifiedAt": "..." }
}
```

**Errors:** `404` not found · `400` ticket is not `RESOLVED`.

---

### POST /api/user/loan

Submit a home loan application.

**Auth:** USER + phone verified

**Request Body:**

```json
{
  "propertyId": "64abc...",
  "preferredBank": "HDFC Bank",
  "loanAmountRequestedPaise": 7000000
}
```

All fields are optional. `loanAmountRequestedPaise` is in paise (₹1 = 100 paise).

**Response `201`:**

```json
{
  "success": true,
  "message": "Loan application submitted",
  "data": {
    "id": "64loan...",
    "userId": "64user...",
    "propertyId": "64abc...",
    "preferredBank": "HDFC Bank",
    "loanAmountRequestedPaise": 7000000,
    "status": "DOCUMENTS_PENDING",
    "createdAt": "2024-01-15T00:00:00.000Z"
  }
}
```

---

### GET /api/user/loan

All loan applications for the authenticated user.

**Auth:** USER

**Response `200`:**

```json
{
  "success": true,
  "message": "Success",
  "data": [
    {
      "id": "64loan...",
      "status": "DOCUMENTS_SUBMITTED",
      "preferredBank": "HDFC Bank",
      "loanAmountRequestedPaise": 7000000,
      "sanctionedAmountPaise": null,
      "adminNote": null,
      "createdAt": "2024-01-15T00:00:00.000Z",
      "property": { "title": "3 BHK Flat in Baner", "slug": "...", "city": "Pune" }
    }
  ]
}
```

---

### GET /api/user/loan/:id

Single loan application (must belong to authenticated user).

**Auth:** USER

**Response `200`:**

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "id": "64loan...",
    "userId": "64user...",
    "propertyId": "64abc...",
    "preferredBank": "HDFC Bank",
    "loanAmountRequestedPaise": 7000000,
    "sanctionedAmountPaise": null,
    "status": "DOCUMENTS_SUBMITTED",
    "adminNote": null,
    "bankRefNumber": null,
    "sanctionedAt": null,
    "disbursedAt": null,
    "rejectionReason": null,
    "submittedDocIds": [],
    "createdAt": "2024-01-15T00:00:00.000Z",
    "updatedAt": "2024-01-15T00:00:00.000Z"
  }
}
```

**Errors:** `404` not found or belongs to another user.

---

## 5. Partner

All `/api/partner/*` routes require `authenticate` + `requirePartner`.

### POST /api/partner/kyc

Submit KYC documents for admin review (up to 5 files).

**Auth:** PARTNER (KYC not required to submit)

**Request:** `multipart/form-data`, field name `documents`, up to 5 files.

**Response `200`:**

```json
{
  "success": true,
  "message": "KYC submitted for review. Usually verified within 24 hours.",
  "data": { "id": "64user...", "kycStatus": "PENDING_REVIEW", "kycDocumentUrls": ["..."] }
}
```

**Errors:** `400` KYC already VERIFIED.

---

### GET /api/partner/profile

**Auth:** PARTNER

**Response `200`:**

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "id": "64user...",
    "name": "Rajdeep Kumar",
    "email": "rajdeep@example.com",
    "phone": "+919876543210",
    "companyName": "RealtyPro Solutions",
    "bio": "10 years in Pune real estate.",
    "profileImageUrl": "https://img.clerk.com/...",
    "websiteUrl": "https://realtypro.in",
    "partnerSubType": "AGENT",
    "kycStatus": "VERIFIED",
    "kycRejectionNote": null,
    "kycVerifiedAt": "2024-02-01T00:00:00.000Z",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

### PATCH /api/partner/profile

Update partner profile. Fields `role`, `kycStatus`, `kycDocumentUrls`, `email` are protected and silently stripped.

**Auth:** PARTNER

**Request Body:**

```json
{
  "name": "Rajdeep Kumar",
  "phone": "+919876543210",
  "companyName": "RealtyPro Solutions",
  "bio": "Updated bio.",
  "websiteUrl": "https://realtypro.in",
  "partnerSubType": "AGENT"
}
```

**Response `200`:**

```json
{ "success": true, "message": "Profile updated", "data": { ... } }
```

---

### GET /api/partner/listings

Partner's own property listings.

**Auth:** PARTNER + KYC verified

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `status` | string | `PENDING_APPROVAL` · `APPROVED` · `REJECTED` · `ARCHIVED` |

**Response `200`:**

```json
{
  "success": true,
  "message": "Success",
  "data": [
    {
      "id": "64prop...",
      "title": "3 BHK Flat in Baner",
      "slug": "3-bhk-flat-in-baner-...",
      "publishStatus": "APPROVED",
      "rejectionNote": null,
      "propertyType": "FLAT",
      "listingType": "SALE",
      "city": "Pune",
      "locality": "Baner",
      "price": 8500000,
      "bhk": 3,
      "images": ["https://cdn.realtydoor.in/prop1.jpg"],
      "createdAt": "2024-01-10T00:00:00.000Z"
    }
  ]
}
```

---

### GET /api/partner/listings/:id

Single listing owned by the partner.

**Auth:** PARTNER + KYC verified

**Response `200`:** Full property record.

**Errors:** `404` not found or belongs to another partner.

---

### GET /api/partner/finance

Partner finance / escrow summary.

**Auth:** PARTNER + KYC verified

**Response `200`:**

```json
{
  "success": true,
  "message": "Success",
  "data": { "totalLeads": 12, "closedDeals": 3, "escrowHeld": 150000 }
}
```

`escrowHeld` is the sum in ₹ of HELD escrow on the partner's closed leads.

---

## 6. Services

### GET /api/services

All active services in the catalog.

**Auth:** Public

**Response `200`:**

```json
{
  "success": true,
  "message": "Success",
  "data": [
    {
      "id": "64svc...",
      "name": "Maintenance Premium",
      "shortDesc": "Annual home maintenance package",
      "description": "Includes plumbing, electrical, painting.",
      "price": 4999,
      "category": "MAINTENANCE",
      "features": ["Annual AMC", "Priority Support", "24x7 Helpline"],
      "imageUrl": "https://cdn.realtydoor.in/services/maintenance.jpg",
      "sortOrder": 1,
      "isActive": true
    }
  ]
}
```

---

### POST /api/services/create-order

Create a Razorpay order to purchase a service subscription.

**Auth:** USER + phone verified

**Request Body:**

```json
{ "serviceId": "64svc..." }
```

**Response `201`:**

```json
{
  "success": true,
  "message": "Order created",
  "data": {
    "subscription": {
      "id": "64sub...",
      "serviceId": "64svc...",
      "razorpayOrderId": "order_...",
      "paymentStatus": "PENDING",
      "amountPaid": 4999,
      "endDate": "2025-01-15T00:00:00.000Z"
    },
    "razorpayOrder": { "id": "order_...", "amount": 499900, "currency": "INR" },
    "key": "rzp_live_..."
  }
}
```

**Errors:** `404` service not found or inactive.

---

## 7. Escrow

### POST /api/escrow/create-order

Create a Razorpay escrow order (token advance). Only one active escrow (`PAYMENT_PENDING` or `HELD`) per lead.

**Auth:** USER + phone verified

**Request Body:**

```json
{ "leadId": "64lead...", "amount": 50000 }
```

`amount` in ₹.

**Response `201`:**

```json
{
  "success": true,
  "message": "Escrow order created",
  "data": {
    "escrow": {
      "id": "64esc...",
      "leadId": "64lead...",
      "buyerId": "64user...",
      "razorpayOrderId": "order_...",
      "amount": 50000,
      "currency": "INR",
      "status": "PAYMENT_PENDING",
      "createdAt": "2024-01-15T00:00:00.000Z"
    },
    "razorpayOrder": { "id": "order_...", "amount": 5000000, "currency": "INR" }
  }
}
```

`payment.captured` webhook moves status to `HELD`.  
**Errors:** `404` lead not found · `400` active escrow already exists.

---

## 8. Notifications

All `/api/notifications/*` require `authenticate` + `requireUser`.

### GET /api/notifications

Paginated notifications for the authenticated user.

**Auth:** USER

**Query Parameters:** `page`, `limit`

**Response `200`:**

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "data": [
      {
        "id": "64notif...",
        "title": "Listing Approved!",
        "message": "Your listing is now live.",
        "type": "PROPERTY_APPROVED",
        "isRead": false,
        "linkUrl": "/properties/...",
        "createdAt": "2024-01-15T10:00:00.000Z"
      }
    ],
    "pagination": { "total": 10, "page": 1, "limit": 20, "totalPages": 1, "hasNext": false, "hasPrev": false }
  }
}
```

---

### PATCH /api/notifications/:id/read

Mark a notification as read.

**Auth:** USER

**Response `200`:** `{ "success": true, "message": "Marked as read", "data": null }`

---

### PATCH /api/notifications/read-all

Mark all unread notifications as read.

**Auth:** USER

**Response `200`:** `{ "success": true, "message": "All marked as read", "data": null }`

---

## 9. Blog / CMS

### GET /api/blog

Published content blocks (paginated).

**Auth:** Public

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `type` | string | `BLOG` · `FAQ` · `HERO_BANNER` · `TESTIMONIAL` · `ANNOUNCEMENT` · `STATS_BAR` · `NRI_GUIDE` · `TEAM_MEMBER` |
| `page` | number | Default: `1` |
| `limit` | number | Default: `20` |

**Response `200`:**

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "data": [
      {
        "id": "64cms...",
        "type": "BLOG",
        "title": "Top 5 areas in Pune to buy in 2024",
        "slug": "top-5-areas-pune-2024",
        "content": "<p>Full article content...</p>",
        "excerpt": "A quick guide to the best neighbourhoods.",
        "imageUrl": "https://cdn.realtydoor.in/blog/pune-areas.jpg",
        "author": "Rajdeep",
        "tags": ["Pune", "Investment", "2024"],
        "isPublished": true,
        "publishedAt": "2024-01-10T00:00:00.000Z",
        "seoTitle": "Top 5 Pune Areas 2024 | RealtyDoor",
        "seoDesc": "Discover the best areas in Pune."
      }
    ],
    "pagination": { "total": 25, "page": 1, "limit": 20, "totalPages": 2, "hasNext": true, "hasPrev": false }
  }
}
```

---

### GET /api/blog/:slug

Single published content block by slug.

**Auth:** Public

**Response `200`:**

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "id": "64cms...",
    "type": "BLOG",
    "title": "Top 5 areas in Pune to buy in 2024",
    "slug": "top-5-areas-pune-2024",
    "content": "<p>Full article content...</p>",
    "excerpt": "A quick guide to the best neighbourhoods.",
    "imageUrl": "https://cdn.realtydoor.in/blog/pune-areas.jpg",
    "author": "Rajdeep",
    "tags": ["Pune", "Investment"],
    "isPublished": true,
    "publishedAt": "2024-01-10T00:00:00.000Z",
    "seoTitle": "Top 5 Pune Areas 2024 | RealtyDoor",
    "seoDesc": "Discover the best areas in Pune.",
    "createdAt": "2024-01-05T00:00:00.000Z",
    "updatedAt": "2024-01-10T00:00:00.000Z"
  }
}
```

**Errors:** `404` if not found or not published.

---

## 10. Contact

### POST /api/contact

Submit a contact form (authenticated or public).

**Auth:** Optional

**Request Body:**

```json
{
  "name": "Priya Sharma",
  "email": "priya@example.com",
  "phone": "+919876543210",
  "subject": "Inquiry about listing my property",
  "message": "I would like to know more about listing my property on RealtyDoor."
}
```

`phone` optional. `name` min 2. `subject` min 3. `message` min 10 chars.

**Response `201`:**

```json
{
  "success": true,
  "message": "Message received. We will get back to you shortly.",
  "data": { "id": "64msg..." }
}
```

---

## 11. Locality Insights

### GET /api/locality-insights

Get locality data for a city+locality pair.

**Auth:** Public

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `city` | string | Yes | e.g. `Pune` |
| `locality` | string | Yes | e.g. `Baner` |

**Response `200`:**

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "id": "64loc...",
    "city": "Pune",
    "locality": "Baner",
    "citySlug": "pune",
    "localitySlug": "baner",
    "avgPricePerSqftPaise": 850000,
    "minPricePerSqftPaise": 700000,
    "maxPricePerSqftPaise": 1050000,
    "avgRentPerMonthPaise": 3000000,
    "priceChangeLastMonthPct": 2.5,
    "nearbyInfra": ["D-Mart", "Orchid School", "Baner Metro"],
    "dataAsOfDate": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-15T00:00:00.000Z"
  }
}
```

All `Paise` fields are integers (₹1 = 100 paise).  
**Errors:** `404` no data for that city+locality.

---

### POST /api/locality-insights

Create or update (upsert) locality insight data.

**Auth:** ADMIN

**Request Body:**

```json
{
  "city": "Pune",
  "locality": "Baner",
  "citySlug": "pune",
  "localitySlug": "baner",
  "avgPricePerSqftPaise": 850000,
  "minPricePerSqftPaise": 700000,
  "maxPricePerSqftPaise": 1050000,
  "avgRentPerMonthPaise": 3000000,
  "priceChangeLastMonthPct": 2.5,
  "nearbyInfra": ["D-Mart", "Orchid School"],
  "dataAsOfDate": "2024-01-01T00:00:00.000Z"
}
```

**Response `201`:** `{ "success": true, "message": "Locality insight saved", "data": { ... } }`

---

### DELETE /api/locality-insights/:id

**Auth:** ADMIN

**Response `200`:** `{ "success": true, "message": "Locality insight deleted", "data": null }`

---

## 12. Webhooks

### POST /api/webhooks/razorpay

Handles `payment.captured` and `payment.failed` from Razorpay.

**Auth:** Razorpay HMAC signature (`x-razorpay-signature` header)

**`payment.captured`:**
- Escrow → status moves to `HELD`
- Subscription → status moves to `SUCCESS`, creates service ticket, sends notification + email

**`payment.failed`:**
- Escrow → status moves to `FAILED`
- Subscription → status moves to `FAILED`

**Response `200`:** `{ "status": "ok" }`

---

### POST /api/webhooks/clerk

Handles `user.created`, `user.updated`, `user.deleted` from Clerk.

**Auth:** Svix signature (`svix-id`, `svix-timestamp`, `svix-signature` headers)

**Response `200`:** `{ "status": "ok" }`

---

## 13. Admin

All `/api/admin/*` routes require `authenticate` + `requireAdmin`.

### GET /api/admin/leads

All leads (paginated). Filter by status and partner.

**Auth:** ADMIN

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `status` | string | `UNASSIGNED` · `ASSIGNED` · `SITE_VISIT_SCHEDULED` · `SITE_VISIT_DONE` · `CLOSED` · `DROPPED` |
| `partnerId` | string | Filter by assigned partner ID |
| `page` | number | Default: `1` |
| `limit` | number | Default: `20` |

**Response `200`:**

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "data": [
      {
        "id": "64lead...",
        "buyerName": "Suresh Mehta",
        "buyerEmail": "suresh@example.com",
        "buyerPhone": "+919876543210",
        "status": "ASSIGNED",
        "isOtpVerified": false,
        "createdAt": "2024-01-15T10:00:00.000Z",
        "property": { "title": "3 BHK Flat in Baner", "slug": "...", "city": "Pune" },
        "assignedPartner": { "name": "Rajdeep Kumar", "email": "rajdeep@example.com" }
      }
    ],
    "pagination": { "total": 50, "page": 1, "limit": 20, "totalPages": 3, "hasNext": true, "hasPrev": false }
  }
}
```

---

### PATCH /api/admin/leads/:id/assign

Assign lead to a KYC-verified partner.

**Auth:** ADMIN

**Request Body:** `{ "partnerId": "64partner..." }`

**Response `200`:**

```json
{
  "success": true,
  "message": "Lead assigned",
  "data": { "id": "64lead...", "status": "ASSIGNED", "assignedPartnerId": "64partner...", "assignedAt": "..." }
}
```

**Errors:** `404` lead not found · `400` partner not found or not KYC verified.

---

### GET /api/admin/properties

Properties with `PENDING_APPROVAL` status (paginated).

**Auth:** ADMIN

**Query Parameters:** `page`, `limit`

**Response `200`:**

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "data": [
      {
        "id": "64prop...",
        "title": "3 BHK Flat in Baner",
        "publishStatus": "PENDING_APPROVAL",
        "city": "Pune",
        "createdAt": "2024-01-10T00:00:00.000Z",
        "partner": { "name": "Rajdeep Kumar", "email": "rajdeep@example.com", "companyName": "RealtyPro Solutions" }
      }
    ],
    "pagination": { "total": 10, "page": 1, "limit": 20, "totalPages": 1, "hasNext": false, "hasPrev": false }
  }
}
```

---

### PATCH /api/admin/properties/:id/approve

Approve a pending listing. Notifies partner + sends email.

**Auth:** ADMIN

**Request Body:** _(none)_

**Response `200`:**

```json
{ "success": true, "message": "Property approved", "data": { "id": "...", "publishStatus": "APPROVED", "rejectionNote": null } }
```

---

### PATCH /api/admin/properties/:id/reject

Reject a pending listing.

**Auth:** ADMIN

**Request Body:** `{ "note": "Please provide RERA number and clearer images." }`

**Response `200`:**

```json
{ "success": true, "message": "Property rejected", "data": { "id": "...", "publishStatus": "REJECTED", "rejectionNote": "..." } }
```

---

### PATCH /api/admin/properties/:id

Admin edit of any property. Protected fields `partnerId` and `slug` are silently stripped. Creates per-field `PropertyEditLog` entries.

**Auth:** ADMIN

**Request Body:** Any property fields except `partnerId`, `slug`.

```json
{ "price": 9000000, "isVerified": true, "reraNumber": "P52100099999" }
```

**Response `200`:** `{ "success": true, "message": "Property updated", "data": { ... } }`

---

### GET /api/admin/kyc

Partners with `PENDING_REVIEW` KYC (paginated).

**Auth:** ADMIN

**Query Parameters:** `page`, `limit`

**Response `200`:**

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "data": [
      {
        "id": "64user...",
        "name": "Rajdeep Kumar",
        "email": "rajdeep@example.com",
        "companyName": "RealtyPro Solutions",
        "partnerSubType": "AGENT",
        "kycDocumentUrls": ["https://cdn.realtydoor.in/kyc/pan.pdf"],
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": { "total": 5, "page": 1, "limit": 20, "totalPages": 1, "hasNext": false, "hasPrev": false }
  }
}
```

---

### PATCH /api/admin/kyc/:userId/verify

Approve or reject partner KYC.

**Auth:** ADMIN

**Request Body:**

```json
{ "action": "APPROVE", "note": "Documents verified." }
```

`action`: `"APPROVE"` or `"REJECT"`. `note` required when rejecting.

**Response `200`:** `{ "success": true, "message": "KYC approved", "data": null }`

---

### GET /api/admin/revenue

Platform revenue summary (MTD = month-to-date).

**Auth:** ADMIN

**Response `200`:**

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "escrowHeld":        { "amount": 250000, "count": 5 },
    "escrowReleasedMTD": { "amount": 150000, "count": 3 },
    "serviceRevenueMTD": { "amount": 49990,  "count": 10 },
    "closedLeadsMTD": 3,
    "totalLeads": 50
  }
}
```

Amounts in ₹.

---

### GET /api/admin/audit-logs

All audit log entries (paginated, newest first).

**Auth:** ADMIN

**Query Parameters:** `page`, `limit`

**Response `200`:**

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "data": [
      {
        "id": "64audit...",
        "adminId": "64admin...",
        "action": "PROPERTY_APPROVED",
        "targetType": "Property",
        "targetId": "64prop...",
        "before": "{\"publishStatus\":\"PENDING_APPROVAL\"}",
        "after": "{\"publishStatus\":\"APPROVED\"}",
        "ipAddress": "103.x.x.x",
        "createdAt": "2024-01-15T12:00:00.000Z"
      }
    ],
    "pagination": { "total": 200, "page": 1, "limit": 20, "totalPages": 10, "hasNext": true, "hasPrev": false }
  }
}
```

`before` and `after` are JSON strings.

---

### GET /api/admin/partners

Performance metrics for all KYC-verified partners.

**Auth:** ADMIN

**Response `200`:**

```json
{
  "success": true,
  "message": "Success",
  "data": [
    {
      "id": "64user...",
      "name": "Rajdeep Kumar",
      "companyName": "RealtyPro Solutions",
      "partnerSubType": "AGENT",
      "totalLeads": 12,
      "closedLeads": 3,
      "totalListings": 8,
      "activeListings": 6
    }
  ]
}
```

---

### PATCH /api/admin/escrow/:id/release

Release a HELD escrow to seller via Razorpay. Requires `HELD` status + captured payment.

**Auth:** ADMIN

**Request Body:**

```json
{
  "sellerAccountId": "acc_...",
  "partnerShare": 5000,
  "platformFee": 2000,
  "note": "Release approved."
}
```

All fields optional. Omitting `sellerAccountId` skips Razorpay transfer.

**Response `200`:**

```json
{
  "success": true,
  "message": "Escrow released",
  "data": { "id": "64esc...", "status": "RELEASED", "releasedAt": "...", "adminNote": "..." }
}
```

**Errors:** `400` not HELD · `400` payment not captured.

---

### POST /api/admin/escrow/:id/refund

Refund a HELD escrow to buyer. Sends buyer notification.

**Auth:** ADMIN

**Request Body:** _(none)_

**Response `200`:**

```json
{ "success": true, "message": "Escrow refunded", "data": { "id": "64esc...", "status": "REFUNDED", "refundedAt": "..." } }
```

**Errors:** `400` not HELD · `400` payment not captured.

---

### GET /api/admin/escrow

All escrow transactions (paginated).

**Auth:** ADMIN

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `status` | string | `PAYMENT_PENDING` · `HELD` · `RELEASED` · `REFUNDED` · `FAILED` · `CANCELLED` |
| `page` | number | Default: `1` |
| `limit` | number | Default: `20` |

**Response `200`:**

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "data": [
      {
        "id": "64esc...",
        "leadId": "64lead...",
        "buyerId": "64user...",
        "razorpayOrderId": "order_...",
        "razorpayPaymentId": "pay_...",
        "amount": 50000,
        "currency": "INR",
        "status": "HELD",
        "heldAt": "2024-01-16T00:00:00.000Z",
        "createdAt": "2024-01-15T00:00:00.000Z"
      }
    ],
    "pagination": { "total": 20, "page": 1, "limit": 20, "totalPages": 1, "hasNext": false, "hasPrev": false }
  }
}
```

---

### POST /api/admin/content

Create a CMS content block.

**Auth:** ADMIN

**Request Body:**

```json
{
  "type": "BLOG",
  "title": "Top 5 areas in Pune to buy in 2024",
  "slug": "top-5-areas-pune-2024",
  "content": "<p>Full article content here...</p>",
  "excerpt": "A quick guide to the best neighbourhoods.",
  "imageUrl": "https://cdn.realtydoor.in/blog/pune-areas.jpg",
  "author": "Rajdeep",
  "tags": ["Pune", "Investment", "2024"],
  "isPublished": true,
  "seoTitle": "Top 5 Pune Areas 2024 | RealtyDoor",
  "seoDesc": "Discover the best areas to invest in Pune."
}
```

If `isPublished: true` and `publishedAt` omitted, defaults to now.

**Response `201`:** `{ "success": true, "message": "Created", "data": { "id": "64cms...", ... } }`

---

### PATCH /api/admin/content/:id

Update a CMS content block.

**Auth:** ADMIN

**Request Body:** Partial content block fields.

**Response `200`:** `{ "success": true, "message": "Success", "data": { ... } }`

---

### DELETE /api/admin/content/:id

Delete a CMS content block.

**Auth:** ADMIN

**Response `204`:** _(no body)_

---

### POST /api/admin/notifications/broadcast

Broadcast notification to all users of specified roles.

**Auth:** ADMIN

**Request Body:**

```json
{
  "roles": ["USER", "PARTNER"],
  "title": "System Maintenance",
  "message": "Platform down Sunday 2AM–4AM.",
  "type": "ANNOUNCEMENT"
}
```

`roles` optional — omit to broadcast to all users.

**Response `200`:** `{ "success": true, "message": "Broadcast sent", "data": { ... } }`

---

### GET /api/admin/loan

All loan applications (paginated).

**Auth:** ADMIN

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `status` | string | `DOCUMENTS_PENDING` · `DOCUMENTS_SUBMITTED` · `DOCUMENTS_VERIFIED` · `SENT_TO_BANK` · `AWAITING_SANCTION` · `SANCTIONED` · `DISBURSED` · `REJECTED` |
| `userId` | string | Filter by user ID |
| `page` | number | Default: `1` |
| `limit` | number | Default: `20` |

**Response `200`:**

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "data": [
      {
        "id": "64loan...",
        "status": "DOCUMENTS_SUBMITTED",
        "preferredBank": "HDFC Bank",
        "loanAmountRequestedPaise": 7000000,
        "sanctionedAmountPaise": null,
        "adminNote": null,
        "createdAt": "2024-01-15T00:00:00.000Z",
        "user": { "name": "Suresh Mehta", "email": "suresh@example.com", "phone": "+919876543210" },
        "property": { "title": "3 BHK Flat in Baner", "slug": "...", "city": "Pune" }
      }
    ],
    "pagination": { "total": 30, "page": 1, "limit": 20, "totalPages": 2, "hasNext": true, "hasPrev": false }
  }
}
```

---

### PATCH /api/admin/loan/:id/status

Update loan status. Sets `sanctionedAt` on `SANCTIONED`, `disbursedAt` on `DISBURSED`.

**Auth:** ADMIN

**Request Body:**

```json
{ "status": "SANCTIONED", "adminNote": "Sanctioned by HDFC. Ref: HDFC2024012345." }
```

**Response `200`:**

```json
{
  "success": true,
  "message": "Loan status updated",
  "data": { "id": "64loan...", "status": "SANCTIONED", "sanctionedAt": "...", "disbursedAt": null }
}
```

**Errors:** `404` loan not found.

---

### GET /api/admin/users

All users (paginated). Filter by role or search.

**Auth:** ADMIN

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `role` | string | `USER` · `PARTNER` · `ADMIN` |
| `search` | string | Case-insensitive search on name or email |
| `page` | number | Default: `1` |
| `limit` | number | Default: `20` |

**Response `200`:**

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "data": [
      {
        "id": "64user...",
        "name": "Suresh Mehta",
        "email": "suresh@example.com",
        "phone": "+919876543210",
        "phoneVerified": true,
        "role": "USER",
        "kycStatus": "NOT_SUBMITTED",
        "partnerSubType": null,
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": { "total": 120, "page": 1, "limit": 20, "totalPages": 6, "hasNext": true, "hasPrev": false }
  }
}
```

---

### PATCH /api/admin/users/:id/role

Change a user's role. Syncs to Clerk publicMetadata and creates audit log.

**Auth:** ADMIN

**Request Body:** `{ "role": "PARTNER" }`

**Response `200`:**

```json
{
  "success": true,
  "message": "Role updated to PARTNER",
  "data": { "id": "64user...", "name": "Suresh Mehta", "email": "suresh@example.com", "role": "PARTNER", "clerkId": "user_2abc..." }
}
```

**Errors:** `400` invalid role · `404` user not found.

---

## Enums Reference

### Role
`USER` · `PARTNER` · `ADMIN`

### PropertyType
`FLAT` · `INDEPENDENT_HOUSE` · `VILLA` · `PLOT` · `COMMERCIAL_OFFICE` · `RETAIL_SHOP`

### ListingType
`SALE` · `RENT` · `LEASE`

### PublishStatus
`PENDING_APPROVAL` · `APPROVED` · `REJECTED` · `ARCHIVED`

### PropertyStatus
`READY_TO_MOVE` · `UNDER_CONSTRUCTION` · `SOLD` · `RENTED`

### LeadStatus
`UNASSIGNED` · `ASSIGNED` · `SITE_VISIT_SCHEDULED` · `SITE_VISIT_DONE` · `CLOSED` · `DROPPED`

### EscrowStatus
`PAYMENT_PENDING` · `HELD` · `RELEASED` · `REFUNDED` · `FAILED` · `CANCELLED`

### KycStatus
`NOT_SUBMITTED` · `PENDING_REVIEW` · `VERIFIED` · `REJECTED`

### LoanStatus
`DOCUMENTS_PENDING` · `DOCUMENTS_SUBMITTED` · `DOCUMENTS_VERIFIED` · `SENT_TO_BANK` · `AWAITING_SANCTION` · `SANCTIONED` · `DISBURSED` · `REJECTED`

### PartnerSubType
`AGENT` · `BUILDER` · `ADVISOR` · `OWNER`

### PaymentStatus (subscriptions)
`PENDING` · `SUCCESS` · `FAILED` · `REFUNDED`

### TicketStatus
`OPEN` · `IN_PROGRESS` · `RESOLVED` · `VERIFIED_BY_USER`

### DocumentStatus
`PENDING_REVIEW` · `APPROVED` · `REJECTED` · `EXPIRED`

### CommissionStatus
`PENDING` · `INVOICED` · `COLLECTED` · `DISPUTED`

### ContentBlock Type
`BLOG` · `FAQ` · `HERO_BANNER` · `TESTIMONIAL` · `ANNOUNCEMENT` · `STATS_BAR` · `NRI_GUIDE` · `TEAM_MEMBER`

### Notification Type (examples)
`LEAD_NEW` · `LEAD_ASSIGNED` · `PROPERTY_APPROVED` · `PROPERTY_REJECTED` · `PROPERTY_EDITED_BY_ADMIN` · `KYC_PENDING` · `KYC_UPDATE` · `DEAL_CLOSED` · `ESCROW_REFUNDED` · `SERVICE_ACTIVATED` · `LOAN_STATUS_UPDATE` · `ANNOUNCEMENT`
