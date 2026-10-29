# Ki10 Games Ltd — QA services booking playbook

Internal working guide for the indie QA offering at /qa-services. This is NOT a client contract, legal advice, an invoice, or a confirmation that a payment gateway is connected.

## Product and scope
- Quick Check — £25 — **one total hour** of manual testing and reporting.
- Indie Playtest — £65 — **three total hours** of manual testing and reporting.
- Release Readiness — £120 — **six total hours** of manual testing and reporting.
- Every package covers a single agreed game build, testing platforms, scope and report.
- No guaranteed defect count, certification, automated testing, bug fixes, or included retesting.
- Windows PC and Android; Steam Deck subject to device/build compatibility confirmed before acceptance.
- Larger/ongoing engagements quoted separately.

## Client enquiry checklist
Collect only what you need:
1. Business/client contact and billing name; business address for the invoice.
2. Game title, project/store link and target platform.
3. Build download/access requirements, approximate download size, specs and any login or test accounts.
4. Goal: demo, patch, internal milestone or release.
5. Risk areas the developer particularly wants checked.
6. Requested package and ideal delivery date.
7. Any NDA, reporting format, bug tracker or special access needs.
Never ask for payment card details by email. Avoid accepting secrets/access credentials by plain email; agree a secure transfer method.

## Quote email template

Subject: Ki10 Games QA — [Game] — [Package] quote

Hi [Name],

Thanks for getting in touch about [Game]. Based on what you've shared, we can offer:

Package: [Name]
Platform and devices: [agreed devices]
Build/version: [specific build]
Test focus: [agreed features and risks]
Time: [N hours total including testing and report preparation]
Deliverables: [prioritised bug report, evidence where useful, brief coverage summary]
Target delivery: [date/time and time zone]
Fixed price: £[amount] [VAT treatment to confirm]
Retesting / extra builds: Not included; quote separately if needed.

The booking begins after written acceptance and payment of the invoice. Please tell me if you need an NDA before sending access.

Before you accept, we'll also confirm the cancellation/refund position appropriate to your booking and any applicable statutory consumer rights. The quote and agreed written terms form the service agreement.

If you'd like to proceed, reply confirming acceptance, your invoicing details and the agreed build details.

Best,
Ki10 Games Ltd
business@ki10games.com

## Invoice checklist (use your invoicing tool, e.g. Stripe Invoicing)
- Invoice identifier, e.g. KI10-QA-0001 (unique, no duplicates).
- Ki10 Games Ltd (full registered legal name), registered contact and address.
- Company number 15687835; England and Wales registration.
- Client legal billing name and address.
- Invoice issue date, supply date (or clear prepayment for future service), agreed due date.
- Description: game title, platform, package, number of hours including reporting, agreed build and milestone.
- Total in GBP, VAT treatment **only after verifying actual VAT status and place-of-supply rules**.
- Correct payout details OR secure provider-hosted invoice/card link.
- Invoice should say 'Payment due before work commences' for the small one-off packages.
- Retain invoice, quote acceptance, payment confirmation and deliverables in business records.

**Confirm before launch:** company VAT registration status, registered-office address that must appear in company disclosure, business bank account ownership, the Stripe account's legal entity and payout verification. Do not enter invented details or publish a personal/home address without explicit approval.

## Payment workflow
1. Do not expose an instant £25/£65/£120 checkout publicly; test compatibility and scope first.
2. Send the agreed quote and secure the client's written acceptance.
3. Create a **draft** invoice in the company's billing/invoicing system, check amount and tax.
4. Send a hosted Stripe invoice for card payments if the Stripe business account is connected and approved, or offer a company bank transfer.
5. Do not begin work until the invoice is actually paid and build access is confirmed.
6. Provide a paid receipt and the testing report at the agreed time. Maintain records.
7. Any dispute, cancellation or refund should follow applicable law and the specifically agreed terms. Never make a blanket 'no refunds' claim. Consumer/sole-trader bookings may carry statutory distance-selling rights.

For bigger custom projects, negotiate a milestone deposit and balance instead of relying on these one-off package rules.

## Delivery report template
**Game/build:** ...
**Platform/devices:** ...
**Tester/date:** ...
**Total scope/time:** ...
**Coverage tested:** ...
**Coverage not tested:** ...
**Summary / key risks:** ...
**Defects:** numbered ID, title, severity, environment, preconditions, steps, expected, actual, occurrence rate, evidence link.
**Usability observations:** separated from confirmed defects.
**Retesting required:** ...
**Caveat:** limited time-scope test; no guarantee of zero defects.

## Completion email
Subject: Ki10 Games QA report — [Game] — [build]

Hi [Name],

Thanks for booking Ki10 Games QA. Attached/linked are the findings for the agreed [build] on [platform].

We completed [testing scope] within [N] hours (including reporting). The handover includes [number] reported issues and a brief summary of notable risks. Please note the limits listed in the coverage summary.

Let me know if you'd like a separately quoted retest after fixes.

Best,
Ki10 Games

## Booking operations
- Keep a lightweight tracker with enquiry date, client, project, package, quote, accepted date, invoice ID, payment status, agreed build, deadline, delivery and testimonial permission.
- Agree how long clients' build files are retained and delete them after that retention period unless continued testing is booked.
- Keep client reports and assets private and request express permission before sharing testimonials.
- Before launch, get appropriate advice on UK website company disclosure, privacy wording, cancellation rights and cross-border VAT treatment.
