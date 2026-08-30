require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const crypto = require('crypto');

const User = require('../models/User');
const Merchant = require('../models/Merchant');
const Product = require('../models/Product');
const PolicyRule = require('../models/PolicyRule');
const Wallet = require('../models/Wallet');
const AgentType = require('../models/AgentType');
const AuditLog = require('../models/AuditLog');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

async function seedDatabase() {
  const mongoUri =
    process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/paygate402';

  console.log('\n======================================================');
  console.log('🌱 PayGate 402 — Automated Demo Database Seeder');
  console.log('======================================================');
  console.log(`Connecting to MongoDB: ${mongoUri.split('@').pop() || mongoUri}`);

  try {
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB successfully.\n');

    // 1. Seed Demo Buyer
    console.log('👤 [1/4] Seeding Demo Buyer Account...');
    let buyer = await User.findOne({ email: 'buyer@demo.com' });
    if (!buyer) {
      buyer = await User.create({
        name: 'Alex Vance (Demo Buyer)',
        email: 'buyer@demo.com',
        password: hashPassword('Password123!'),
        isActive: true,
      });
      console.log('   ✔ Created user: buyer@demo.com');
    } else {
      buyer.password = hashPassword('Password123!');
      await buyer.save();
      console.log('   ✔ Updated password for: buyer@demo.com');
    }

    // Pre-fund Buyer Wallet
    let wallet = await Wallet.findOne({ owner: buyer._id });
    if (!wallet) {
      wallet = await Wallet.create({
        owner: buyer._id,
        balance: 5000,
        perTransactionCap: 10000,
        perDayCap: 50000,
        dailySpent: 0,
        lastSpentResetDate: new Date(),
        ledger: [
          {
            type: 'topup',
            amount: 5000,
            description: 'Initial Demo Account Pre-funding',
            referenceId: 'seed_init_topup_5000',
            status: 'completed',
            balanceAfter: 5000,
            timestamp: new Date(),
          },
        ],
      });
      buyer.walletId = wallet._id;
      await buyer.save();
      console.log('   ✔ Created & pre-funded wallet with ₹5,000 INR balance.');
    } else {
      wallet.balance = Math.max(wallet.balance, 5000);
      wallet.perTransactionCap = 10000;
      wallet.perDayCap = 50000;
      await wallet.save();
      console.log(`   ✔ Verified wallet balance: ₹${wallet.balance} INR.`);
    }

    // 2. Seed Demo Merchant
    console.log('\n🏪 [2/4] Seeding Demo Merchant & Storefront...');
    let merchant = await Merchant.findOne({ email: 'merchant@demo.com' });
    if (!merchant) {
      merchant = await Merchant.create({
        businessName: 'Apex Electronics Store',
        email: 'merchant@demo.com',
        phone: '9876543210',
        businessCategory: 'Electronics',
        kycStatus: 'verified',
        panNumber: 'ABCDE1234F',
        gstin: '29ABCDE1234F1Z5',
        isVerified: true,
        password: hashPassword('Password123!'),
        razorpayKeyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_demo12345',
        razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || 'secret_demo12345',
        isActive: true,
      });
      console.log('   ✔ Created merchant: merchant@demo.com (Apex Electronics)');
    } else {
      merchant.password = hashPassword('Password123!');
      merchant.isVerified = true;
      await merchant.save();
      console.log('   ✔ Verified merchant: merchant@demo.com');
    }

    // Seed Merchant Catalog Products
    console.log('   📦 Seeding Merchant Product Catalog...');
    const demoProducts = [
      {
        title: 'Sony WH-1000XM5 Noise Cancelling Headphones',
        description: 'Industry-leading wireless noise-canceling headphones with 30-hour battery life.',
        category: 'Electronics',
        price: 2999,
        stock: 45,
        sku: 'ELEC-SONY-XM5',
        isActive: true,
        imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=60',
      },
      {
        title: 'Apple Watch Series 9 GPS 45mm',
        description: 'Advanced health sensors, bright Always-On Retina display, and fast charging.',
        category: 'Electronics',
        price: 1999,
        stock: 60,
        sku: 'ELEC-APPLE-W9',
        isActive: true,
        imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=60',
      },
      {
        title: 'Keychron Q1 Pro Wireless Custom Mechanical Keyboard',
        description: 'Full aluminum 75% layout custom mechanical keyboard with hot-swappable switches.',
        category: 'Electronics',
        price: 3499,
        stock: 25,
        sku: 'ELEC-KEYCHRON-Q1',
        isActive: true,
        imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&auto=format&fit=crop&q=60',
      },
      {
        title: 'Anker 100W GaN Fast Wall Charger (USB-C)',
        description: 'Ultra-compact 3-port fast charger for laptops, phones, and tablets.',
        category: 'Accessories',
        price: 899,
        stock: 120,
        sku: 'ACC-ANKER-100W',
        isActive: true,
        imageUrl: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=600&auto=format&fit=crop&q=60',
      },
      {
        title: 'Logitech MX Master 3S Wireless Performance Mouse',
        description: 'Quiet clicks, 8K DPI any-surface tracking, and ultra-fast MagSpeed scrolling.',
        category: 'Accessories',
        price: 1299,
        stock: 50,
        sku: 'ACC-LOGI-MX3S',
        isActive: true,
        imageUrl: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=600&auto=format&fit=crop&q=60',
      },
    ];

    for (const prodData of demoProducts) {
      const existing = await Product.findOne({ merchant: merchant._id, sku: prodData.sku });
      if (!existing) {
        await Product.create({
          ...prodData,
          merchant: merchant._id,
        });
        console.log(`      + Added product: ${prodData.title} (₹${prodData.price})`);
      }
    }

    // Seed Merchant Governance Policy Rules
    console.log('   🛡️ Seeding Merchant Governance & Settlement Rules...');
    const demoPolicies = [
      {
        ruleId: 'RULE_SPEND_CAP_01',
        name: 'Single Order Spending Cap',
        description: 'Auto-blocks single agent transaction orders exceeding ₹15,000 INR.',
        ruleType: 'max_spend_cap',
        maxAmount: 15000,
        precedence: 1,
        isActive: true,
      },
      {
        ruleId: 'RULE_DAILY_VELOCITY_02',
        name: '24h Merchant Velocity Cap',
        description: 'Guards merchant settlement from exceeding ₹1,00,000 INR per 24 hours.',
        ruleType: 'daily_velocity_limit',
        dailyCap: 100000,
        precedence: 2,
        isActive: true,
      },
      {
        ruleId: 'RULE_DISCOUNT_AUTO_03',
        name: 'AI Agent Negotiation Floor & Ceiling',
        description: 'Auto-accepts discounts up to 10%, strictly rejects offers exceeding 25% off.',
        ruleType: 'max_spend_cap',
        autoAcceptDiscountPercent: 10,
        maxAllowedDiscountPercent: 25,
        precedence: 3,
        isActive: true,
      },
    ];

    for (const polData of demoPolicies) {
      const existing = await PolicyRule.findOne({ merchant: merchant._id, ruleId: polData.ruleId });
      if (!existing) {
        await PolicyRule.create({
          ...polData,
          merchant: merchant._id,
        });
        console.log(`      + Added policy: ${polData.name} (${polData.ruleId}, Precedence #${polData.precedence})`);
      }
    }

    // 3. Seed Demo Admin Account
    console.log('\n👑 [3/4] Seeding Platform Administrator Account...');
    let admin = await User.findOne({ email: 'admin@demo.com' });
    if (!admin) {
      admin = await User.create({
        name: 'Platform Administrator',
        email: 'admin@demo.com',
        password: hashPassword('Password123!'),
        isActive: true,
      });
      console.log('   ✔ Created admin: admin@demo.com');
    } else {
      admin.password = hashPassword('Password123!');
      await admin.save();
      console.log('   ✔ Verified admin: admin@demo.com');
    }

    // 4. Seed Standard Autonomous Agent Personas
    console.log('\n🤖 [4/4] Seeding Autonomous Agent Personas...');
    const agentPersonas = [
      {
        agentSlug: 'bargain-hunter',
        title: 'Bargain Hunter Agent',
        description: 'Aggressively negotiates multi-round merchant discounts within dynamic margin floors.',
        category: 'Shopping',
        icon: 'trending-down',
        defaultCapabilities: ['multi_round_negotiation', 'ap2_mandate_signing', 'price_drop_alerts'],
        isPublic: true,
      },
      {
        agentSlug: 'instant-shopper',
        title: 'Instant Voice Shopper',
        description: 'Executes voice-activated checkout routines with zero friction and sub-second settlement.',
        category: 'Voice Commerce',
        icon: 'mic',
        defaultCapabilities: ['voice_nlp_intent', 'groq_whisper', 'instant_settlement'],
        isPublic: true,
      },
      {
        agentSlug: 'recurring-restocker',
        title: 'Automated Restock Agent',
        description: 'Cron-scheduled background agent that reorders essential supplies automatically.',
        category: 'Automation',
        icon: 'clock',
        defaultCapabilities: ['scheduled_cron', 'velocity_limit_checks', 'auto_fulfillment'],
        isPublic: true,
      },
    ];

    for (const persona of agentPersonas) {
      const existing = await AgentType.findOne({ agentSlug: persona.agentSlug });
      if (!existing) {
        await AgentType.create(persona);
        console.log(`   ✔ Seeded agent persona: ${persona.title}`);
      }
    }

    // Seed a couple of audit entries for initial admin overview telemetry
    const auditCount = await AuditLog.countDocuments();
    if (auditCount === 0) {
      await AuditLog.create({
        correlationId: 'corr_seed_init_001',
        agentId: 'agent_bargain_hunter_01',
        merchant: merchant._id,
        action: 'AGENT_CATALOG_DISCOVERY',
        decision: 'ALLOW',
        ruleId: 'POLICY_ALL_PASSED',
        reasonCode: 'DISCOVERY_AUTHORIZED',
        reason: 'Autonomous agent discovered verified merchant manifest',
        executionTimeMs: 14,
      });
      console.log('   ✔ Seeded initial platform audit telemetry log.');
    }

    console.log('\n======================================================');
    console.log('✨ Demo Database Seeding Complete!');
    console.log('======================================================');
    console.log('\n🔑 Ready-to-Use Demo Credentials:\n');
    console.log('┌───────────────────┬──────────────────────┬───────────────┬──────────────────────────────┐');
    console.log('│ Role              │ Email                │ Password      │ Pre-Loaded State             │');
    console.log('├───────────────────┼──────────────────────┼───────────────┼──────────────────────────────┤');
    console.log('│ 👤 Buyer          │ buyer@demo.com       │ Password123!  │ ₹5,000 Pre-Funded AP2 Wallet │');
    console.log('│ 🏪 Merchant       │ merchant@demo.com    │ Password123!  │ 5 Products + 3 Active Rules  │');
    console.log('│ 👑 Admin          │ admin@demo.com       │ Password123!  │ Platform Telemetry Access    │');
    console.log('└───────────────────┴──────────────────────┴───────────────┴──────────────────────────────┘');
    console.log('\n🚀 Run: npm run dev to start both servers, or visit: https://pay-gate-402.vercel.app/\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  }
}

seedDatabase();
