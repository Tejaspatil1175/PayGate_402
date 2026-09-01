require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  const User = require('../models/User');
  const Wallet = require('../models/Wallet');

  const emails = ['tejas@gmail.com', 'buyer@demo.com', 'pranav@gmail.com'];

  for (const email of emails) {
    const user = await User.findOne({ email }).lean();
    if (!user) {
      console.log(`Skipped (not found): ${email}`);
      continue;
    }

    const newBalance = 10000;
    const existing = await Wallet.findOne({ owner: user._id });

    if (existing) {
      existing.balance = newBalance;
      existing.ledger.push({
        type: 'credit',
        amount: newBalance,
        description: 'Demo top-up for Buildathon',
        referenceId: `TOPUP-DEMO-${Date.now()}`,
        status: 'completed',
        balanceAfter: newBalance,
      });
      await existing.save();
      console.log(`Topped up ${email} -> Rs.${existing.balance}`);
    } else {
      const w = await Wallet.create({
        owner: user._id,
        balance: newBalance,
        ledger: [{
          type: 'credit',
          amount: newBalance,
          description: 'Demo top-up for Buildathon',
          referenceId: `TOPUP-DEMO-${Date.now()}`,
          status: 'completed',
          balanceAfter: newBalance,
        }],
      });
      console.log(`Created wallet for ${email} -> Rs.${w.balance}`);
    }
  }

  process.exit(0);
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
