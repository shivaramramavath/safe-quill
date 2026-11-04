"""
SMS Spam Collection & Email Phishing Baseline Dataset
Provides labeled training pairs for spam/phishing (1) and legitimate/ham (0).
"""

from typing import List, Tuple

RAW_SAMPLES: List[Tuple[str, int]] = [
    # Spam / Phishing samples (label: 1)
    ("URGENT: Your bank account has been suspended due to suspicious activity. Verify immediately at http://secure-login.xyz", 1),
    ("Congratulations! You won a $1,000 Walmart gift card. Click here to claim your prize now: http://free-prizes.cc", 1),
    ("Final notice: Unpaid invoice #INV-9281. Open the attached document or your service will be terminated immediately.", 1),
    ("Your Netflix membership is on hold. Update your credit card details immediately to continue watching.", 1),
    ("Dear customer, our records show an unauthorized login from Russia. Click here to secure your password immediately.", 1),
    ("Earn $5,000 per week working from home! No experience required. Send your deposit today to get started.", 1),
    ("Wire transfer confirmation needed. Transfer funds to offshore account before 5 PM to finalize company acquisition.", 1),
    ("Security Alert: We detected an unknown device accessing your account. Reset your credentials now at http://bit.ly/fake-auth", 1),
    ("You have 1 pending package delivery. Pay $1.99 redelivery fee at http://usps-track-update.info", 1),
    ("Exclusive offer: Buy generic Viagra and Cialis online at 90% discount with discreet shipping.", 1),
    ("IRS Tax Refund Notification: You are eligible to receive a refund of $1,420. Submit your SSN to claim.", 1),
    ("Action Required: Your Microsoft 365 password expires today. Keep your same password by validating here.", 1),
    ("Free entry into our weekly £1000 prize draw. Text WIN to 80085 to enter.", 1),
    ("Immediate attention: CEO requests wire payment to vendor immediately. Do not call, I am in a board meeting.", 1),
    ("Crypto investment opportunity: Guaranteed 200% return in 48 hours. Deposit Bitcoin into our wallet.", 1),
    ("Your PayPal account has been limited. Confirm your identity to restore access.", 1),
    ("Urgent notification: Apple ID locked for security reasons. Unlock now to avoid permanent deletion.", 1),
    ("Hot singles in your area want to meet tonight. Click to browse profiles without registration.", 1),
    ("You have received an encrypted confidential voicemail. Download and run audio_attachment.exe to listen.", 1),
    ("Overdue debt notice: Legal action will be filed against you in 24 hours unless payment is received.", 1),
    ("Claim your inheritance: $4.5M USD left by late diplomat. Send bank coordinates and processing fee.", 1),
    ("Your mailbox is almost full. 99% of storage used. Click here to upgrade storage quota for free.", 1),
    ("Important security warning: Critical patch needed. Download Windows Security Update from link below.", 1),
    ("Act fast! Limited time offer: Get 80% off luxury watches, Rolex, and handbags. Valid for 2 hours only.", 1),
    ("DocuSign: Please review and sign document 'Severance Agreement' immediately.", 1),

    # Ham / Legitimate samples (label: 0)
    ("Hey Shiva, are we still meeting tomorrow at 10 AM for the quarterly engineering sync?", 0),
    ("Hi team, please find attached the meeting minutes and action items from today's sprint planning.", 0),
    ("Can you review the pull request for the authentication service when you get a chance?", 0),
    ("Thanks for sending the report. Everything looks accurate and ready for client presentation.", 0),
    ("Reminder: The office will be closed this Friday for the public holiday. Enjoy your weekend!", 0),
    ("Lunch tomorrow? Let's check out that new taco place near the office.", 0),
    ("Hi Mom, arrived safely at the hotel. Will call you tonight after dinner.", 0),
    ("Attached is the draft of the SafeQuill documentation for your feedback. Let me know what you think.", 0),
    ("Here are the flight confirmation details and hotel reservation for the conference in Berlin.", 0),
    ("The scheduled database maintenance has been completed successfully with zero downtime.", 0),
    ("Could you please send over the latest financial statement when you have a moment?", 0),
    ("Happy birthday! Wishing you a wonderful year ahead filled with joy and success.", 0),
    ("The design team updated the Figma prototype for the dashboard. Link is inside the Jira ticket.", 0),
    ("Weekly standup notes: we made great progress on the search indexing feature.", 0),
    ("Thank you for your inquiry. Our support team has received your ticket and will respond within 24 hours.", 0),
    ("Let's reschedule our one-on-one meeting to Thursday afternoon if that works better for you.", 0),
    ("Please remember to submit your timesheets by 5 PM today for payroll processing.", 0),
    ("The package was delivered to your front door at 2:15 PM. Tracking number 940011189956.", 0),
    ("Here is the recipe we discussed yesterday. Make sure to bake it at 350 degrees for 40 minutes.", 0),
    ("Great presentation today! The client was very impressed with our roadmap and metrics.", 0),
    ("Can you send me the Zoom link for the 3 PM product demo?", 0),
    ("Don't forget to bring the projector adapter to the conference room tomorrow morning.", 0),
    ("Hey, left my notebook on the 4th floor conference table. Could you grab it for me if you're nearby?", 0),
    ("The test suite passed on all branch pipelines. Ready to merge to staging.", 0),
    ("Hi everyone, please welcome Sarah to our engineering team as our new frontend specialist!", 0),
]

def get_training_data() -> Tuple[List[str], List[int]]:
    texts = [sample[0] for sample in RAW_SAMPLES]
    labels = [sample[1] for sample in RAW_SAMPLES]
    return texts, labels
