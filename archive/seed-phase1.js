const { createStrapi } = require('@strapi/strapi');

async function seed() {
  const app = await createStrapi().load();

  console.log('Seeding Phase 1 content...');

  // 1. Enable permissions
  const publicRole = await app.db.connection('up_roles').where('type', 'public').first();
  if (publicRole) {
    const roleId = publicRole.id;
    const actions = [
      'api::about-us-page.about-us-page.find',
      'api::contact-us-page.contact-us-page.find',
      'api::page.page.find',
      'api::page.page.findOne'
    ];

    for (const action of actions) {
      let perm = await app.db.connection('up_permissions').where('action', action).first();
      if (!perm) {
        const document_id = Math.random().toString(36).substring(2, 16);
        const [insertedId] = await app.db.connection('up_permissions').insert({
          action,
          document_id,
          created_at: new Date(),
          updated_at: new Date(),
          published_at: new Date(),
          locale: null
        });
        perm = { id: insertedId };
      }

      const link = await app.db.connection('up_permissions_role_lnk')
        .where({ permission_id: perm.id, role_id: roleId })
        .first();
      if (!link) {
        const ordRes = await app.db.connection('up_permissions_role_lnk')
          .where('role_id', roleId)
          .max('permission_ord as maxOrd')
          .first();
        const nextOrd = (ordRes?.maxOrd || 0) + 1;
        await app.db.connection('up_permissions_role_lnk').insert({
          permission_id: perm.id,
          role_id: roleId,
          permission_ord: nextOrd
        });
      }
    }
    console.log('Permissions updated successfully.');
  }

  // 2. Seed About Us Page
  const aboutUid = 'api::about-us-page.about-us-page';
  const aboutExists = await app.documents(aboutUid).findFirst();
  if (!aboutExists) {
    await app.documents(aboutUid).create({
      data: {
        heroEyebrow: 'A Muthoot Exim (P) Ltd. Enterprise',
        heroTitle: 'Muthoot Gold Point — Precision You Can Trust',
        heroDescription: 'At Muthoot Gold Point, we bring decades of trust and transparent valuation directly to you. Our scientific process ensures you get the absolute best value for your gold.',
        heroChecklist: [
          { text: '100% Scientific XRF Valuation' },
          { text: 'Instant Cash or Bank Transfer' }
        ],
        heroStats: [
          { label: 'Happy Customers', number: '1M+' },
          { label: 'Branches PAN India', number: '20+' }
        ],
        recyclingSubtitle: 'Closed-Loop Ecosystem',
        recyclingTitle: 'What Do We Do With The Gold We Buy?',
        recyclingDescription: 'Every piece of gold purchased is scientifically purified and reintroduced into the market, minimizing the need for harmful new gold mining.',
        recyclingSteps: [
          { title: 'Melting & Refining', desc: 'Gold is sent to state-of-the-art refineries.' },
          { title: 'Minting New Assets', desc: 'Purified gold is minted into Muthoot Swarnavarsham coins.' },
          { title: 'Market Recirculation', desc: 'Coins are made available across our vast network.' }
        ],
        historySubtitle: 'Legacy & Heritage',
        historyTitle: 'Our Historic Milestones',
        historyDescription: 'A brief timeline of how Muthoot Exim brought transparent gold recycling to India.',
        historyMilestones: [
          { year: '2015', title: 'First Branch', desc: 'Opened our flagship Muthoot Gold Point in Mumbai.' },
          { year: '2017', title: 'Mobile Van Launch', desc: 'Introduced India’s first Mobile Gold Buying Van.' },
          { year: '2020', title: 'Digital Shift', desc: 'Launched seamless online booking & valuation tools.' },
          { year: '2023', title: '1 Million Trust', desc: 'Crossed one million satisfied customers nationwide.' }
        ],
        parentEyebrow: 'Parent Conglomerate',
        parentTitle: 'About The Muthoot Pappachan Group',
        parentDescription: 'A massive business conglomerate with a rich legacy of over 137 years, MPG touches millions of lives through diverse financial and community services.',
        parentChecklist: [
          { text: 'Founded in 1887 in Kerala' },
          { text: 'Built on Trust, Truth, and Tradition' }
        ],
        parentCompareHeading: 'At a Glance',
        parentStats: [
          { label: 'Years of Trust', number: '137+' },
          { label: 'Branches', number: '4000+' },
          { label: 'Employees', number: '35,000+' },
          { label: 'Daily Customers', number: '100,000+' }
        ],
        philanthropySubtitle: 'Social Commitment',
        philanthropyTitle: 'Our Unwavering Focus on Philanthropy',
        philanthropyDescription: 'The Muthoot Pappachan Foundation spearheads our CSR initiatives, driving sustainable social change in healthcare, education, and environment.',
        philanthropyInitiativeTitle: 'The HEEL Initiative',
        philanthropyInitiativeDesc: 'Our core CSR philosophy is encapsulated in the HEEL initiative, focusing on four primary pillars of societal development:',
        philanthropyPillars: [
          { letter: 'H', title: 'Health', desc: 'Providing accessible healthcare solutions.' },
          { letter: 'E', title: 'Education', desc: 'Empowering the youth through scholarships.' },
          { letter: 'E', title: 'Environment', desc: 'Promoting green and sustainable practices.' },
          { letter: 'L', title: 'Livelihood', desc: 'Creating skill development opportunities.' }
        ],
        philanthropyConclusion: 'Business Without Boundaries: We believe that true success is measured not just by financial growth, but by the positive impact we leave on our communities.',
        presentSubtitle: 'Present Day',
        presentTitle: 'Where We Stand Today',
        presentDescription: 'Today, the Muthoot Pappachan Group is a sprawling financial supermarket, serving over 5 million customers across India.',
        presentSubDescription: 'Our diversified portfolio caters to the varied financial needs of the common man.',
        presentCardTag: 'Ecosystem',
        presentCardTitle: 'The Financial Supermarket',
        presentCardDesc: 'We offer a complete suite of services under one roof.',
        presentServicesTitle: 'Our Offerings',
        presentServices: [
          { title: 'Gold Loans' },
          { title: 'Micro Finance' },
          { title: 'Affordable Housing' },
          { title: 'Two-Wheeler Finance' },
          { title: 'Precious Metals' },
          { title: 'Foreign Exchange' },
          { title: 'Money Transfer' },
          { title: 'Insurance' }
        ],
        seoTitle: 'About Us - Muthoot Gold Point | A Legacy of Trust',
        seoDescription: 'Discover the history, values, and vision of Muthoot Gold Point.'
      }
    });
    console.log('Seeded About Us Page.');
  }

  // 3. Seed Contact Us Page
  const contactUid = 'api::contact-us-page.contact-us-page';
  const contactExists = await app.documents(contactUid).findFirst();
  if (!contactExists) {
    await app.documents(contactUid).create({
      data: {
        heroHeading: 'We’re Just A Message Away.',
        heroLead: 'Whether you want to understand our valuation process, book a mobile van, or just say hello — our support team is always ready to assist you.',
        formTitle: 'Write to us',
        formServices: [
          { text: 'Sell Gold for Cash' },
          { text: 'Gold Loan Service' },
          { text: 'Book Mobile Van' },
          { text: 'Feedback or Complaint' },
          { text: 'Other' }
        ],
        officeName: 'Muthoot Exim Pvt. Ltd.',
        officeAddress: 'Muthoot Towers, M.G. Road, Ernakulam, Kerala - 682035',
        officePhone1: '0484 2351481',
        officePhone2: '1800 102 1616',
        officeEmail: 'info@muthootexim.com',
        officeMapUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3929.351280769358!2d76.28187807621183!3d9.987823573249053!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3b080d4e3bb07ebf%3A0xc3e3ef96369ddca7!2sMuthoot%20Towers!5e0!3m2!1sen!2sin!4v1700000000000!5m2!1sen!2sin',
        officeMapPopupTitle: 'Corporate Headquarters',
        officeMapPopupText: 'Visit our registered office in Ernakulam for corporate inquiries.',
        seoTitle: 'Contact Us | Muthoot Gold Point',
        seoDescription: 'Get in touch with Muthoot Gold Point.'
      }
    });
    console.log('Seeded Contact Us Page.');
  }

  // 4. Update Career Page Settings
  const careerUid = 'api::career-page-setting.career-page-setting';
  const careerSettings = await app.documents(careerUid).findFirst();
  if (careerSettings) {
    if (!careerSettings.careerBenefits || careerSettings.careerBenefits.length === 0) {
      await app.documents(careerUid).update({
        documentId: careerSettings.documentId,
        data: {
          careerBenefits: [
            { title: 'Accelerated Growth', desc: 'Clear career progression paths for top performers.' },
            { title: 'Legacy of Trust', desc: 'Work with a brand backed by 137+ years of history.' },
            { title: 'Competitive Rewards', desc: 'Industry-leading compensation and incentives.' },
            { title: 'Inclusive Culture', desc: 'A diverse workplace that values every voice.' }
          ]
        }
      });
      console.log('Updated Career Page Settings with benefits.');
    }
  }

  console.log('Done seeding. Exiting...');
  process.exit(0);
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
