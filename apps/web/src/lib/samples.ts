export interface EmailSample {
  id: string;
  title: string;
  category: 'Phishing' | 'BEC' | 'UPI/KYC Scam' | 'Clean Professional';
  subject: string;
  body: string;
  rawHeaders?: string;
  expectedScore: 'HIGH' | 'LOW';
}

export const EMAIL_SAMPLES: EmailSample[] = [
  {
    id: 'phishing-credential-harvest',
    title: 'Bank Account Suspension Phishing',
    category: 'Phishing',
    subject: 'URGENT: Your Account Has Been Temporarily Suspended - Verify Immediately',
    body: `Dear Valued Customer,

We have detected unauthorized login attempts to your online banking portal from an unrecognized device (IP: 192.168.1.5). For your protection, your access has been temporarily restricted.

To restore your account and prevent permanent suspension within 24 hours, you must verify your identity immediately:
http://192.168.1.5/secure-login/verify.php?token=928374

Please confirm your full account number, PIN, and Social Security Number (SSN: 123-45-6789) on the secure portal.

Failure to verify will result in immediate account termination.

Security Operations Team
Global Central Bank`,
    rawHeaders: `From: "Global Central Bank Security" <security@update-alert-services.net>
To: victim@example.com
Subject: URGENT: Your Account Has Been Temporarily Suspended - Verify Immediately
Date: Wed, 4 Nov 2026 14:22:10 +0000
Received: from mail.untrusted-relay.com (192.168.1.5) by mx.google.com
Authentication-Results: spf=fail (sender IP is 192.168.1.5) smtp.mailfrom=update-alert-services.net; dkim=fail; dmarc=fail`,
    expectedScore: 'HIGH',
  },
  {
    id: 'bec-payroll-wire',
    title: 'CEO Urgent Wire Transfer (BEC)',
    category: 'BEC',
    subject: 'Confidential: Acquisition Wire Transfer Instructions',
    body: `Alex,

Are you currently at your desk? I am in an off-site board meeting and cannot take calls right now.

We are closing a confidential acquisition today and require an immediate wire transfer of $48,500.00 to the escrow account before 3:00 PM EST.

Please do not mention this to anyone on the team until the public announcement tomorrow. Send me a quick confirmation once you are ready for the wire coordinates.

Thanks,
Mark Davis
Chief Executive Officer`,
    rawHeaders: `From: "Mark Davis" <ceo-office@company-corp.co>
Reply-To: executive.operations99@gmail.com
To: alex.finance@company.com
Subject: Confidential: Acquisition Wire Transfer Instructions
Date: Wed, 4 Nov 2026 09:15:00 -0400`,
    expectedScore: 'HIGH',
  },
  {
    id: 'upi-kyc-scam',
    title: 'UPI / Wallet KYC Expiry Scam',
    category: 'UPI/KYC Scam',
    subject: 'Urgent: Paytm/PhonePe KYC Block Notice - Update Today',
    body: `Dear User,

Your UPI and Wallet account KYC verification has expired today. Your wallet balance has been placed on hold and outgoing payments are blocked.

To complete your biometric KYC online within 10 minutes, click the link below and complete a Rs. 1 test transaction:
http://wallet-kyc-verification-desk.ru/update

Required details: Enter your registered mobile number, UPI PIN, and Debit Card details (16 digit number and CVV).

Customer Care Desk
National Payment Gateway`,
    rawHeaders: `From: "KYC Helpline" <no-reply@pay-wallet-service.in>
To: user@example.com
Subject: Urgent: Paytm/PhonePe KYC Block Notice - Update Today`,
    expectedScore: 'HIGH',
  },
  {
    id: 'clean-roadmap-sync',
    title: 'Quarterly Executive Roadmap Sync',
    category: 'Clean Professional',
    subject: 'Q4 Product Roadmap & Engineering Priorities',
    body: `Hi Team,

Hope this email finds you well.

Attached is the agenda for our upcoming quarterly product planning session scheduled for this Thursday at 2:00 PM EST. We will review our delivery milestones, cloud infrastructure budget, and key hiring targets for Q1.

Please review the attached briefing document ahead of the meeting so we can focus our discussion on decision points.

Looking forward to our discussion.

Best regards,
Sarah Jenkins
VP of Product Engineering`,
    rawHeaders: `From: "Sarah Jenkins" <sjenkins@enterprise.com>
To: engineering-leads@enterprise.com
Subject: Q4 Product Roadmap & Engineering Priorities
Date: Wed, 4 Nov 2026 11:30:00 -0500
Authentication-Results: spf=pass smtp.mailfrom=enterprise.com; dkim=pass header.d=enterprise.com; dmarc=pass`,
    expectedScore: 'LOW',
  },
];
