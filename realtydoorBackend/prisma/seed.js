/**
 * RealtyDoor — MongoDB Seed Script
 *
 * Run: node prisma/seed.js
 *
 * IMPORTANT: The clerkId values below are placeholders.
 * Replace them with real Clerk user IDs from your Clerk dashboard
 * so you can authenticate via the API using those accounts.
 *
 * Seed data created:
 *  - 1 ADMIN user
 *  - 1 PARTNER user (KYC VERIFIED, with 3 approved properties)
 *  - 1 regular USER (phone verified)
 *  - 5 Service catalog entries
 *  - 4 Locality insights
 *  - 4 CMS content blocks (2 BLOG, 1 FAQ, 1 ANNOUNCEMENT)
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ─── Replace these with real Clerk user IDs ───────────────────────────────────
const ADMIN_CLERK_ID   = 'user_seed_admin_001';
const PARTNER_CLERK_ID = 'user_seed_partner_001';
const USER_CLERK_ID    = 'user_seed_user_001';
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱  Starting seed...\n');

  // ── Users ──────────────────────────────────────────────────────────────────

  const admin = await prisma.user.upsert({
    where:  { email: 'admin@realtydoor.com' },
    update: { clerkId: ADMIN_CLERK_ID, role: 'ADMIN' },
    create: {
      clerkId:       ADMIN_CLERK_ID,
      name:          'Admin User',
      email:         'admin@realtydoor.com',
      phone:         '+919000000001',
      phoneVerified: true,
      role:          'ADMIN',
    },
  });
  console.log(`✅  Admin   : ${admin.email}  (id: ${admin.id})`);

  const partner = await prisma.user.upsert({
    where:  { email: 'partner@realtydoor.com' },
    update: { clerkId: PARTNER_CLERK_ID },
    create: {
      clerkId:         PARTNER_CLERK_ID,
      name:            'Rajdeep Kumar',
      email:           'partner@realtydoor.com',
      phone:           '+919000000002',
      phoneVerified:   true,
      role:            'PARTNER',
      partnerSubType:  'AGENT',
      companyName:     'RealtyPro Solutions',
      bio:             '10 years of experience in Pune real estate market.',
      websiteUrl:      'https://realtypro.in',
      kycStatus:       'VERIFIED',
      kycVerifiedAt:   new Date(),
      kycDocumentUrls: ['https://example.com/kyc/pan.pdf', 'https://example.com/kyc/aadhar.pdf'],
    },
  });
  console.log(`✅  Partner : ${partner.email}  (id: ${partner.id})`);

  const user = await prisma.user.upsert({
    where:  { email: 'user@realtydoor.com' },
    update: { clerkId: USER_CLERK_ID },
    create: {
      clerkId:       USER_CLERK_ID,
      name:          'Suresh Mehta',
      email:         'user@realtydoor.com',
      phone:         '+919000000003',
      phoneVerified: true,
      role:          'USER',
    },
  });
  console.log(`✅  User    : ${user.email}  (id: ${user.id})`);

  // ── Services ───────────────────────────────────────────────────────────────

  const services = [
    {
      name:        'Maintenance Premium',
      shortDesc:   'Annual home maintenance package',
      description: 'Comprehensive AMC covering plumbing, electrical, carpentry, painting, and pest control. Includes 4 scheduled visits per year plus on-demand support.',
      price:       4999,
      category:    'MAINTENANCE',
      features:    ['4 Scheduled Visits/Year', 'Plumbing & Electrical', 'Carpentry & Painting', 'Pest Control', '24x7 Emergency Helpline'],
      sortOrder:   1,
      imageUrl:    'https://cdn.realtydoor.in/services/maintenance.jpg',
    },
    {
      name:        'Legal Assistance',
      shortDesc:   'Property documentation and legal support',
      description: 'End-to-end legal support for property transactions including agreement drafting, title verification, registration assistance, and property due diligence.',
      price:       9999,
      category:    'LEGAL',
      features:    ['Agreement Drafting', 'Title Verification', 'Registration Assistance', 'Due Diligence Report', 'Dedicated Legal Expert'],
      sortOrder:   2,
      imageUrl:    'https://cdn.realtydoor.in/services/legal.jpg',
    },
    {
      name:        'Home Loan Assistance',
      shortDesc:   'Dedicated loan processing support',
      description: 'Get dedicated support from our loan experts to compare offers from 10+ banks, prepare documents, and track your loan application from submission to disbursement.',
      price:       2999,
      category:    'LOAN',
      features:    ['10+ Bank Comparisons', 'Document Preparation', 'Application Tracking', 'Dedicated Loan Manager', 'Best Rate Guarantee'],
      sortOrder:   3,
      imageUrl:    'https://cdn.realtydoor.in/services/loan.jpg',
    },
    {
      name:        'Interior Design Consultation',
      shortDesc:   '1-on-1 interior design session',
      description: 'A 2-hour virtual consultation with an experienced interior designer. Get personalised layout plans, material suggestions, and a budget estimate for your new home.',
      price:       1499,
      category:    'CONSTRUCTION',
      features:    ['2-Hour Virtual Session', 'Layout Plan', 'Material Suggestions', 'Budget Estimate', 'Follow-up Report'],
      sortOrder:   4,
      imageUrl:    'https://cdn.realtydoor.in/services/interior.jpg',
    },
    {
      name:        'Property Valuation Report',
      shortDesc:   'Certified market valuation',
      description: 'Get a certified property valuation report prepared by a RICS-accredited valuer. Includes comparable sales analysis, condition report, and official stamp.',
      price:       3499,
      category:    'VALUATION',
      features:    ['RICS-Accredited Valuer', 'Comparable Sales Analysis', 'Condition Report', 'Official Stamp', '5-Business-Day Delivery'],
      sortOrder:   5,
      imageUrl:    'https://cdn.realtydoor.in/services/valuation.jpg',
    },
  ];

  for (const svc of services) {
    const existing = await prisma.service.findFirst({ where: { name: svc.name } });
    if (!existing) {
      await prisma.service.create({ data: svc });
      console.log(`✅  Service : ${svc.name}`);
    } else {
      console.log(`⏭   Service : ${svc.name} (already exists)`);
    }
  }

  // ── Properties ─────────────────────────────────────────────────────────────

  const properties = [
    {
      title:          '3 BHK Flat in Baner',
      description:    'Spacious 3 BHK apartment in the heart of Baner with premium amenities, ample parking, and excellent connectivity to Hinjewadi IT Park. Ready to move in.',
      propertyType:   'FLAT',
      listingType:    'SALE',
      propertyStatus: 'READY_TO_MOVE',
      publishStatus:  'APPROVED',
      price:          8500000,
      priceNegotiable: true,
      bhk:            3,
      bathrooms:      2,
      carpetArea:     1200,
      builtUpArea:    1450,
      floorNumber:    4,
      totalFloors:    12,
      ageOfProperty:  2,
      furnishing:     'Semi-Furnished',
      facing:         'East',
      address:        'Skyline Heights, Plot 12, Baner Road',
      locality:       'Baner',
      city:           'Pune',
      state:          'Maharashtra',
      pincode:        '411045',
      latitude:       18.5596,
      longitude:      73.7769,
      nearbyLandmarks: ['D-Mart Baner', 'Orchid School', 'Baner Metro Station'],
      reraNumber:     'P52100012345',
      bankApprovals:  ['SBI', 'HDFC', 'ICICI'],
      images:         [
        'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800',
        'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800',
        'https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?w=800',
      ],
      amenities:       ['Gymnasium', 'Swimming Pool', '24x7 Security', 'CCTV', 'Power Backup'],
      societyFeatures: ['Club House', "Children's Play Area", 'Jogging Track', 'Visitor Parking'],
      isFeatured:      true,
      isVerified:      true,
      partnerId:       partner.id,
      slug:            'skyline-heights-3bhk-baner-' + Date.now(),
    },
    {
      title:          '2 BHK Flat for Rent in Kothrud',
      description:    'Well-maintained 2 BHK in a prime Kothrud location, close to Kothrud bus depot and major schools. Ideal for families or working professionals.',
      propertyType:   'FLAT',
      listingType:    'RENT',
      propertyStatus: 'READY_TO_MOVE',
      publishStatus:  'APPROVED',
      monthlyRent:    25000,
      bhk:            2,
      bathrooms:      2,
      carpetArea:     850,
      builtUpArea:    1050,
      floorNumber:    2,
      totalFloors:    6,
      ageOfProperty:  5,
      furnishing:     'Furnished',
      facing:         'West',
      address:        'Green Valley Apartments, Karve Road',
      locality:       'Kothrud',
      city:           'Pune',
      state:          'Maharashtra',
      pincode:        '411038',
      nearbyLandmarks: ['Kothrud Bus Depot', 'Symbiosis College', 'D-Mart Kothrud'],
      images:         [
        'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800',
        'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800',
      ],
      amenities:       ['Lift', '24x7 Security', 'Power Backup'],
      societyFeatures: ['Terrace Garden', 'Visitor Parking'],
      isVerified:      true,
      partnerId:       partner.id,
      slug:            'green-valley-2bhk-kothrud-rent-' + (Date.now() + 1),
    },
    {
      title:          'Commercial Office Space in Hinjewadi',
      description:    'Ready-to-use commercial office space in Rajiv Gandhi IT Park, Hinjewadi Phase 1. Ideal for tech startups and SMEs. High-speed fibre, modular workstations included.',
      propertyType:   'COMMERCIAL_OFFICE',
      listingType:    'LEASE',
      propertyStatus: 'READY_TO_MOVE',
      publishStatus:  'APPROVED',
      monthlyRent:    85000,
      carpetArea:     1500,
      builtUpArea:    1800,
      floorNumber:    7,
      totalFloors:    10,
      furnishing:     'Fully Furnished',
      address:        'Rajiv Gandhi IT Park, Phase 1',
      locality:       'Hinjewadi',
      city:           'Pune',
      state:          'Maharashtra',
      pincode:        '411057',
      latitude:       18.5931,
      longitude:      73.7382,
      nearbyLandmarks: ['Infosys Campus', 'Wipro Gate', 'Hinjewadi Bridge'],
      images:         [
        'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800',
        'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800',
      ],
      amenities:       ['High-Speed Internet', 'Conference Room', 'Cafeteria', '24x7 Security', 'Power Backup', 'Parking'],
      isFeatured:      true,
      partnerId:       partner.id,
      slug:            'hinjewadi-office-phase1-lease-' + (Date.now() + 2),
    },
    {
      title:          '4 BHK Independent House in Aundh',
      description:    "Stunning 4 BHK independent bungalow in one of Pune's most sought-after residential neighbourhoods. Private garden, rooftop terrace, and 2-car garage.",
      propertyType:   'INDEPENDENT_HOUSE',
      listingType:    'SALE',
      propertyStatus: 'READY_TO_MOVE',
      publishStatus:  'APPROVED',
      price:          28000000,
      priceNegotiable: false,
      bhk:            4,
      bathrooms:      4,
      carpetArea:     3200,
      builtUpArea:    3800,
      plotArea:       5000,
      floorNumber:    0,
      totalFloors:    2,
      ageOfProperty:  3,
      furnishing:     'Semi-Furnished',
      facing:         'North',
      address:        '15, Pashan-Sus Road, Aundh',
      locality:       'Aundh',
      city:           'Pune',
      state:          'Maharashtra',
      pincode:        '411067',
      latitude:       18.5581,
      longitude:      73.8099,
      nearbyLandmarks: ['Aundh Chest Hospital', 'DP Road', 'D-Mart Aundh'],
      reraNumber:     'P52100054321',
      bankApprovals:  ['HDFC', 'ICICI', 'Axis Bank'],
      images:         [
        'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800',
        'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800',
        'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800',
      ],
      amenities:       ['Private Garden', 'Rooftop Terrace', '2-Car Garage', 'Solar Panels', 'Rainwater Harvesting'],
      societyFeatures: ['Gated Community', '24x7 Security'],
      isFeatured:      true,
      isVerified:      true,
      partnerId:       partner.id,
      slug:            'independent-house-4bhk-aundh-' + (Date.now() + 3),
    },
  ];

  for (const prop of properties) {
    const existing = await prisma.property.findFirst({ where: { slug: prop.slug } });
    if (!existing) {
      await prisma.property.create({ data: prop });
      console.log(`✅  Property: ${prop.title}`);
    } else {
      console.log(`⏭   Property: ${prop.title} (already exists)`);
    }
  }

  // ── Locality Insights ──────────────────────────────────────────────────────

  const localities = [
    {
      city:                   'Pune',
      locality:               'Baner',
      citySlug:               'pune',
      localitySlug:           'baner',
      avgPricePerSqftPaise:   850000,
      minPricePerSqftPaise:   700000,
      maxPricePerSqftPaise:  1050000,
      avgRentPerMonthPaise:  2800000,
      priceChangeLastMonthPct: 2.3,
      nearbyInfra:            ['D-Mart', 'Orchid School', 'Baner Metro Station', 'Aditya Birla Hospital'],
      dataAsOfDate:           new Date('2024-01-01'),
      updatedByAdminId:       admin.id,
    },
    {
      city:                   'Pune',
      locality:               'Kothrud',
      citySlug:               'pune',
      localitySlug:           'kothrud',
      avgPricePerSqftPaise:   720000,
      minPricePerSqftPaise:   600000,
      maxPricePerSqftPaise:   900000,
      avgRentPerMonthPaise:  2200000,
      priceChangeLastMonthPct: 1.8,
      nearbyInfra:            ['Kothrud Bus Depot', 'Symbiosis College', 'Chandni Chowk'],
      dataAsOfDate:           new Date('2024-01-01'),
      updatedByAdminId:       admin.id,
    },
    {
      city:                   'Pune',
      locality:               'Hinjewadi',
      citySlug:               'pune',
      localitySlug:           'hinjewadi',
      avgPricePerSqftPaise:   650000,
      minPricePerSqftPaise:   520000,
      maxPricePerSqftPaise:   820000,
      avgRentPerMonthPaise:  2000000,
      priceChangeLastMonthPct: 3.1,
      nearbyInfra:            ['Rajiv Gandhi IT Park', 'Infosys BPO', 'Hinjewadi Bus Stop'],
      dataAsOfDate:           new Date('2024-01-01'),
      updatedByAdminId:       admin.id,
    },
    {
      city:                   'Pune',
      locality:               'Aundh',
      citySlug:               'pune',
      localitySlug:           'aundh',
      avgPricePerSqftPaise:   920000,
      minPricePerSqftPaise:   750000,
      maxPricePerSqftPaise:  1200000,
      avgRentPerMonthPaise:  3200000,
      priceChangeLastMonthPct: 1.5,
      nearbyInfra:            ['Aundh Chest Hospital', 'DP Road Market', 'Westend Mall'],
      dataAsOfDate:           new Date('2024-01-01'),
      updatedByAdminId:       admin.id,
    },
  ];

  for (const loc of localities) {
    await prisma.localityInsight.upsert({
      where:  { city_locality: { city: loc.city, locality: loc.locality } },
      update: loc,
      create: loc,
    });
    console.log(`✅  Locality: ${loc.city} / ${loc.locality}`);
  }

  // ── CMS Content Blocks ─────────────────────────────────────────────────────

  const contentBlocks = [
    {
      type:        'BLOG',
      title:       'Top 5 Neighbourhoods to Buy Property in Pune (2024)',
      slug:        'top-5-pune-neighbourhoods-2024',
      content:     `<h2>1. Baner</h2><p>Baner has emerged as one of Pune's most sought-after residential hubs owing to its proximity to Hinjewadi IT Park and excellent social infrastructure...</p><h2>2. Kothrud</h2><p>A well-established locality with excellent connectivity and top schools...</p><h2>3. Aundh</h2><p>Premium residential area with wide roads and upscale housing options...</p><h2>4. Hinjewadi</h2><p>Fastest-growing micro-market driven by the IT sector...</p><h2>5. Wakad</h2><p>Emerging residential hub with affordable pricing and good infrastructure...</p>`,
      excerpt:     'Thinking about buying a home in Pune? Here are the top 5 neighbourhoods offering the best combination of price appreciation, infrastructure, and quality of life.',
      imageUrl:    'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?w=1200',
      author:      'RealtyDoor Research',
      tags:        ['Pune', 'Investment', 'Residential', '2024', 'Neighbourhood Guide'],
      isPublished: true,
      publishedAt: new Date('2024-01-10'),
      seoTitle:    'Top 5 Pune Neighbourhoods to Buy Property in 2024 | RealtyDoor',
      seoDesc:     'Discover the best areas to invest in Pune real estate — Baner, Kothrud, Aundh, Hinjewadi & Wakad compared.',
    },
    {
      type:        'BLOG',
      title:       'RERA Explained: What Every Pune Homebuyer Must Know',
      slug:        'rera-guide-pune-homebuyer',
      content:     `<h2>What is RERA?</h2><p>The Real Estate (Regulation and Development) Act, 2016 (RERA) was enacted to protect homebuyers and boost investments in the real estate sector...</p><h2>How to Verify a Project</h2><p>You can verify any registered project on the MahaRERA portal at maharera.mahaonline.gov.in...</p><h2>Key Protections for Buyers</h2><p>RERA mandates that developers must deposit 70% of collected funds in a separate bank account...</p>`,
      excerpt:     'RERA has transformed the Indian real estate landscape. Here is everything a Pune homebuyer needs to know before signing on the dotted line.',
      imageUrl:    'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=1200',
      author:      'RealtyDoor Legal Team',
      tags:        ['RERA', 'Legal', 'Homebuyer Guide', 'MahaRERA', 'Pune'],
      isPublished: true,
      publishedAt: new Date('2024-01-20'),
      seoTitle:    'RERA Guide for Pune Homebuyers 2024 | RealtyDoor',
      seoDesc:     'Everything you need to know about RERA, MahaRERA, and how to verify a real estate project in Pune.',
    },
    {
      type:        'FAQ',
      title:       'Frequently Asked Questions',
      slug:        'faq',
      content:     JSON.stringify([
        { q: 'How does RealtyDoor ensure I get genuine leads?', a: 'We use a multi-step OTP verification system. The buyer verifies their phone, and the partner must verify a site-visit OTP before the buyer contact is revealed.' },
        { q: 'What is the escrow / token advance system?', a: 'Before closing a deal, the buyer deposits a token advance via Razorpay into our escrow. This is released to the seller once the deal is confirmed, or refunded if it falls through.' },
        { q: 'How long does KYC verification take?', a: 'Our team typically reviews KYC documents within 24 working hours. You will receive an email and in-app notification once it is complete.' },
        { q: 'What documents do I need for KYC as a Partner?', a: 'You need a government-issued ID (Aadhaar or PAN), address proof, and relevant professional certifications (RERA registration number for agents or builders).' },
        { q: 'Can I list my property for free?', a: 'Yes, listing a property on RealtyDoor is free. We earn a platform commission only on successful deal closures.' },
      ]),
      excerpt:     'Common questions about RealtyDoor, property listings, KYC, escrow, and the buying process.',
      isPublished: true,
      publishedAt: new Date('2024-01-01'),
      tags:        ['FAQ', 'Help', 'KYC', 'Escrow', 'Listings'],
    },
    {
      type:        'ANNOUNCEMENT',
      title:       'Welcome to RealtyDoor Beta!',
      slug:        'welcome-realtydoor-beta',
      content:     '<p>We are excited to launch RealtyDoor — India\'s most transparent real estate platform. Our mission is to eliminate property fraud through technology, escrow-backed deals, and KYC-verified partners.</p><p>During beta, all services are available at introductory pricing. We\'d love your feedback!</p>',
      excerpt:     'RealtyDoor is officially live! Explore verified properties, connect with KYC-verified partners, and enjoy secure, escrow-backed deals.',
      imageUrl:    'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1200',
      author:      'RealtyDoor Team',
      tags:        ['Announcement', 'Launch', 'Beta'],
      isPublished: true,
      publishedAt: new Date('2024-01-01'),
    },
  ];

  for (const block of contentBlocks) {
    const existing = block.slug
      ? await prisma.contentBlock.findFirst({ where: { slug: block.slug } })
      : null;
    if (!existing) {
      await prisma.contentBlock.create({ data: block });
      console.log(`✅  Content : [${block.type}] ${block.title}`);
    } else {
      console.log(`⏭   Content : [${block.type}] ${block.title} (already exists)`);
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────

  console.log('\n─────────────────────────────────────────────────────');
  console.log('🌱  Seed complete!\n');
  console.log('  Postman variables to set:');
  console.log(`    adminId    = ${admin.id}`);
  console.log(`    partnerId  = ${partner.id}`);
  console.log(`    userId     = ${user.id}`);
  console.log('\n  ⚠️  Update clerkId values in seed.js to match your');
  console.log('     Clerk test accounts before running the API with');
  console.log('     real authentication tokens.\n');
  console.log('  Clerk IDs currently set:');
  console.log(`    ADMIN_CLERK_ID   = ${ADMIN_CLERK_ID}`);
  console.log(`    PARTNER_CLERK_ID = ${PARTNER_CLERK_ID}`);
  console.log(`    USER_CLERK_ID    = ${USER_CLERK_ID}`);
  console.log('─────────────────────────────────────────────────────\n');
}

main()
  .catch((e) => {
    console.error('❌  Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
