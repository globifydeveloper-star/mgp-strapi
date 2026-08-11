import { Core } from '@strapi/strapi';
import fs from 'fs';
import path from 'path';

/**
 * Parser to extract branch records from the frontend TypeScript data file.
 */
function parseBranches(content: string) {
  const branches: any[] = [];
  const matches = content.match(/\{[\s\S]*?\}/g);
  if (matches) {
    for (const match of matches) {
      if (!match.includes('id:') || !match.includes('name:')) continue;
      
      const getVal = (key: string) => {
        const regex = new RegExp(`${key}:\\s*['"\`]([^'"\`]+)['"\`]`);
        const m = match.match(regex);
        return m ? m[1] : '';
      };
      
      const getNum = (key: string) => {
        const regex = new RegExp(`${key}:\\s*([0-9.-]+)`);
        const m = match.match(regex);
        return m ? parseFloat(m[1]) : 0;
      };

      branches.push({
        name: getVal('name'),
        url: getVal('url'),
        address: getVal('address'),
        city: getVal('city'),
        pincode: getVal('pincode'),
        stateName: getVal('state'),
        timing: getVal('timing'),
        lat: getNum('lat'),
        lng: getNum('lng')
      });
    }
  }
  return branches;
}

export default {
  register() {},

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    // 1. Seed Homepage Single Type
    const homepageUid = 'api::homepage.homepage';
    const homepageExisting = await strapi.documents(homepageUid).findFirst();
    if (!homepageExisting) {
      strapi.log.info('Seeding Homepage single type...');
      await strapi.documents(homepageUid).create({
        data: {
          estimateGoldHeading: 'Estimate The Value Of',
          estimateGoldHeadingHighlight: 'Your Gold',
          estimateGoldNote: 'Final Value may vary based on physical verification',
          vanHeadingLight: 'We Bring the',
          vanHeadingBold: 'Branch to You',
          vanDescription: "Can't visit us? Our Mobile Van carries the full GoldPoint setup — XRF machines, precision balances, real-time rates — directly to your home or office.",
          vanButtonLabel: 'Book a Van Visit',
          seoTitle: 'Sell Gold For Cash | Online Gold Valuation | Gold Point',
          seoDescription: 'Get the True Market Value of your old, unused or pledged gold through a transparent process conducted entirely in front of you.'
        }
      });
    }

    // 2. Seed Hero Slides
    const heroSlideUid = 'api::hero-slide.hero-slide';
    const heroSlidesExisting = await strapi.documents(heroSlideUid).findMany({ limit: 1 });
    if (heroSlidesExisting.length === 0) {
      strapi.log.info('Seeding Hero Slides...');
      await strapi.documents(heroSlideUid).create({
        data: {
          heroText: 'Sell Your Gold. Get Cash Today.',
          heroSubtext: 'Get the True Market Value Old, Unused or pledged gold through a transparent process conducted entirely in front of you',
          slideLink: '#branches',
          button1: { enabled: true, label: 'Find Nearest Branch', link: '#branches' },
          button2: { enabled: true, label: 'See how it works', link: '#gold-sell-process' }
        }
      });
      await strapi.documents(heroSlideUid).create({
        data: {
          heroText: 'Get 100% Value for Your Gold. Safe, Transparent & Scientific.',
          heroSubtext: 'Sell your gold with complete peace of mind. We use advanced XRF machines for purity testing right in front of you, ensuring you get the exact market rate.',
          slideLink: '#branches',
          button1: { enabled: true, label: 'Locate Nearest Branch', link: '#branches' },
          button2: { enabled: true, label: 'Check Gold Purity', link: '#gold-value-form' }
        }
      });
    }

    // 3. Seed Process Steps (Fix 2: Expose order field, compute number on frontend)
    const processStepUid = 'api::process-step.process-step';
    const processStepsExisting = await strapi.documents(processStepUid).findMany({ limit: 1 });
    if (processStepsExisting.length === 0) {
      strapi.log.info('Seeding Process Steps...');
      const steps = [
        {
          order: 1,
          stepTitle: 'Visit Your Nearest White Gold Branch',
          stepDescription: 'Walk into any of our branches with your gold jewellery. Our team will greet you and guide you through the entire selling process step by step.',
          leftDescription: 'Walk into any of our branches with your gold jewellery. Our team will greet you and guide you through the entire selling process step by step.'
        },
        {
          order: 2,
          stepTitle: 'Submit ID & Address Proof',
          stepDescription: 'Share a valid photo ID (Aadhaar, PAN, Passport or Voter ID) along with address proof for quick, hassle-free verification.',
          leftDescription: 'Keep your Aadhaar, PAN, Passport or Voter ID handy along with address proof so our team can verify your identity quickly.'
        },
        {
          order: 3,
          stepTitle: 'Professional Gold Purity Assessment',
          stepDescription: 'Our experts assess the purity of your gold using advanced XRF technology, right in front of you, for complete transparency.',
          leftDescription: 'Our experts use advanced XRF technology to test the purity of your gold right in front of you, ensuring complete transparency.'
        },
        {
          order: 4,
          stepTitle: 'Get the Latest Live Gold Rate',
          stepDescription: 'Your gold is valued against the current live market rate, ensuring you always get the fairest, most accurate price.',
          leftDescription: "We value your gold against today's live market rate, so you always get the fairest and most accurate price."
        },
        {
          order: 5,
          stepTitle: 'Instant Payment',
          stepDescription: 'Receive your payment instantly via bank transfer or cash, immediately after the valuation is complete.',
          leftDescription: 'Once the valuation is complete, receive your payment instantly via bank transfer or cash — no waiting around.'
        }
      ];
      for (const step of steps) {
        await strapi.documents(processStepUid).create({ data: step });
      }
    }

    // 4. Seed Difference Boxes
    const diffBoxUid = 'api::difference-box.difference-box';
    const diffBoxesExisting = await strapi.documents(diffBoxUid).findMany({ limit: 1 });
    if (diffBoxesExisting.length === 0) {
      strapi.log.info('Seeding Difference Boxes...');
      const boxes = [
        {
          order: 1,
          boxTitle: 'XRF over touchstone',
          boxDescription: "Spectroscopic analysis gives the exact elemental composition of your gold. A touchstone gives a rough estimate. We don't do rough estimates.",
          iconType: 'flask' as const
        },
        {
          order: 2,
          boxTitle: 'Three-decimal weight',
          boxDescription: 'Weighed to 0.001g on precision balances. Most buyers round down to the nearest gram. That difference is real money leaving your pocket.',
          iconType: 'scale' as const
        },
        {
          order: 3,
          boxTitle: 'Bank transfer, not cash-only',
          boxDescription: 'Every transaction above ₹10,000 reaches your account digitally. A full itemised invoice issued. No undocumented exchanges.',
          iconType: 'rupee' as const
        }
      ];
      for (const box of boxes) {
        await strapi.documents(diffBoxUid).create({ data: box });
      }
    }

    // 5. Seed Promo Slides
    const promoSlideUid = 'api::promo-slide.promo-slide';
    const promoSlidesExisting = await strapi.documents(promoSlideUid).findMany({ limit: 1 });
    if (promoSlidesExisting.length === 0) {
      strapi.log.info('Seeding Promo Slides...');
      const slides = [
        {
          heading: 'A Legacy Of',
          highlight: 'Trust, Truth & Tradition',
          description: 'The Muthoot Pappachan Group, with a reputation shaped over decades of high quality practices, total customer satisfaction and steady growth, has become one of the most trusted names in the business.',
          button: { enabled: true, label: 'Read More', link: '#branches' }
        },
        {
          heading: 'Built On',
          highlight: 'Transparency & Fairness',
          description: 'Every transaction is backed by science-driven valuation and complete honesty, so customers always know exactly what their gold is worth.',
          button: { enabled: true, label: 'Read More', link: '#branches' }
        },
        {
          heading: 'Driven By',
          highlight: 'Customer First Values',
          description: 'From the first visit to the final payment, every step is designed around convenience, speed and putting the customer’s interest ahead of everything else.',
          button: { enabled: true, label: 'Read More', link: '#branches' }
        }
      ];
      for (const slide of slides) {
        await strapi.documents(promoSlideUid).create({ data: slide });
      }
    }

    // 6. Seed Testimonials
    const testimonialUid = 'api::testimonial.testimonial';
    const testimonialsExisting = await strapi.documents(testimonialUid).findMany({ limit: 1 });
    if (testimonialsExisting.length === 0) {
      strapi.log.info('Seeding Testimonials...');
      const reviews = [
        {
          customerName: 'SACHIN JONEJA',
          location: 'Mumbai',
          rating: 5,
          testimonialText: 'My mother and I have sold some very old gold over the past few months to three different organizations. One was a branch of an old established famous Jeweller in Mumbai while two were only buyers of gold. Of these, our experience with Muthoot Gold Point has been by far the best. We were impressed with both the completely transparent and speedy procedure as well as the courteous and knowledgeable staff.'
        },
        {
          customerName: 'Basvaraju',
          location: 'Bengaluru, Karnataka',
          rating: 5,
          testimonialText: 'I wanted to sell some gold jewellery to pay for the construction of my house – my contractor had cheated us. I saw the MGP advertisement on a government bus and decided to meet them as I was in great need. My earlier experience of selling the gold had not been good. But, the salesperson at MGP sat and explained each process of how they value the gold. I was totally impressed by their transparency and detailing.'
        },
        {
          customerName: 'Srinarayan',
          location: 'Chennai, Tamil Nadu',
          rating: 5,
          testimonialText: 'I can never forget Muthoot Gold Point. If I had not come to know about MGP at the right time, I could have lost everything. In family and business, money is tight, when you need it the most. At these times, if there is a provision to sell your gold, plot of land, house and silver, then you can meet your difficulties easily. In my experience, MGP is the best solution for all those people looking to sell their gold and silver.'
        },
        {
          customerName: 'Vijay Sharma',
          location: 'Mumbai',
          rating: 5,
          testimonialText: 'I was looking to pay the last year’s fee for my eldest son’s engineering college, I did not have enough money. My wife asked me to sell all our gold jewellery and coins we had collected over the years. I went to some local jewellers and was shocked – they offered less than half of the value of the gold.'
        },
        {
          customerName: 'AMAR SINGH',
          location: 'Delhi',
          rating: 5,
          testimonialText: 'When my father needed an emergency by-pass, I took all the jewellery and sold gold for cash, I had to MGP, straight away. I went to them as soon as the doctor told me and within minutes, they had assessed the true value of the gold. They gave me a receipt and transferred the money to my account. Thanks to their operation!'
        }
      ];
      for (const r of reviews) {
        await strapi.documents(testimonialUid).create({ data: r });
      }
    }

    // 7. Seed FAQs
    const faqUid = 'api::faq.faq';
    const faqsExisting = await strapi.documents(faqUid).findMany({ limit: 1 });
    if (faqsExisting.length === 0) {
      strapi.log.info('Seeding FAQs...');
      const faqs = [
        {
          order: 1,
          question: 'Why Should I Choose Muthoot Gold Point to Sell my Gold?',
          answer: 'Citizenship by Investment (CBI) is a process where individuals can gain citizenship by investing in a country. The process involves applying to a government-approved program, undergoing a background check, and, if approved, making an economic contribution and Citizenship by Investment (CBI) is a process where in',
          section: 'home' as const
        },
        {
          order: 2,
          question: 'How Much Do Gold Buyers Pay For Gold?',
          answer: 'Valuation is based on the live market rate of gold, adjusted for purity and the net weight of your ornaments.',
          section: 'home' as const
        },
        {
          order: 3,
          question: 'How Is Valuation Done And How Long Does It Take?',
          answer: 'Valuation is done using XRF technology right in front of you and typically takes only a few minutes to complete.',
          section: 'home' as const
        },
        {
          order: 4,
          question: 'How Is Gold Price Per Gram Calculated?',
          answer: 'The price per gram is calculated using the live gold rate multiplied by the purity percentage of your gold.',
          section: 'home' as const
        },
        {
          order: 5,
          question: 'Do I need any documents for selling my jewelry?',
          answer: 'Yes, a valid photo ID and address proof are required to complete the sale.',
          section: 'home' as const
        }
      ];
      for (const faq of faqs) {
        await strapi.documents(faqUid).create({ data: faq });
      }
    }

    // 8. States & Branches: Branch data is dynamically fetched directly from Muthoot Branch Master API.
    // Static database seeding is disabled to prevent stale data.

    // 8b. Seed Career Page Settings and Departments
    const careerSettingUid = 'api::career-page-setting.career-page-setting';
    const careerSettingExisting = await strapi.documents(careerSettingUid).findFirst();
    if (!careerSettingExisting) {
      strapi.log.info('Seeding Career Page Settings...');
      await strapi.documents(careerSettingUid).create({
        data: {
          heroHeading: 'Join the Muthoot Gold Point Team',
          heroSubheading: 'Build a rewarding career with India’s most trusted gold buying organization. We foster talent, integrity, and career growth.',
          cultureHeading: 'Why Work With Us?',
          cultureDescription: 'At Muthoot Gold Point, we believe our people are our strongest asset. We provide a collaborative, transparent, and growth-oriented work environment with competitive benefits and continuous learning opportunities.',
          seoTitle: 'Careers | Work With Muthoot Gold Point',
          seoDescription: 'Explore open job opportunities and build your career with Muthoot Gold Point.'
        }
      });
    }

    const deptUid = 'api::job-department.job-department';
    let deptsList = await strapi.documents(deptUid).findMany({});
    if (deptsList.length === 0) {
      strapi.log.info('Seeding Job Departments...');
      const defaultDepts = [
        { name: 'Operations', slug: 'operations' },
        { name: 'Technology', slug: 'technology' },
        { name: 'Sales & Marketing', slug: 'sales-marketing' },
        { name: 'Finance & Accounting', slug: 'finance-accounting' }
      ];
      for (const dept of defaultDepts) {
        await strapi.documents(deptUid).create({ data: dept });
      }
      deptsList = await strapi.documents(deptUid).findMany({});
    }

    const posUid = 'api::job-position.job-position';
    const posExisting = await strapi.documents(posUid).findMany({ limit: 1 });
    if (posExisting.length === 0 && deptsList.length > 0) {
      strapi.log.info('Seeding Initial Job Positions...');
      const opsDept = deptsList.find(d => d.slug === 'operations') || deptsList[0];
      const salesDept = deptsList.find(d => d.slug === 'sales-marketing') || deptsList[0];
      const techDept = deptsList.find(d => d.slug === 'technology') || deptsList[0];

      const initialJobs = [
        {
          title: 'Branch Relationship Executive',
          slug: 'branch-relationship-executive',
          department: salesDept.documentId,
          location: 'Bengaluru, India',
          employmentType: 'Full-time' as const,
          experienceLevel: '1-3 Years',
          summary: 'Engage with clients, explain the gold valuation and selling process, and build lasting customer relationships at our branches.',
          description: 'We are seeking a proactive Branch Relationship Executive to engage with clients, explain the gold valuation and selling process, and build lasting customer relationships at our branches.',
          requirements: 'Prior experience in retail banking, gold loan, or financial services sales. Excellent verbal communication and customer relationship skills.',
          isOpen: true,
          postedDate: new Date().toISOString().split('T')[0]
        },
        {
          title: 'Customer Relationship Manager',
          slug: 'customer-relationship-manager',
          department: opsDept.documentId,
          location: 'Chennai, India',
          employmentType: 'Full-time' as const,
          experienceLevel: '3-5 Years',
          summary: 'Ensure smooth branch operations, oversee transparent gold testing protocols, and handle client escalations.',
          description: 'Ensure smooth branch operations, oversee transparent gold testing protocols, handle client escalations, and manage a team of valuation executives to guarantee top-tier service.',
          requirements: 'Proven track record in operations management in gold loan or gold buying sector. Strong leadership abilities and team management experience.',
          isOpen: true,
          postedDate: new Date().toISOString().split('T')[0]
        },
        {
          title: 'Frontend React/Next.js Developer',
          slug: 'frontend-react-nextjs-developer',
          department: techDept.documentId,
          location: 'Bengaluru / Hybrid',
          employmentType: 'Full-time' as const,
          experienceLevel: '2-4 Years',
          summary: 'Craft beautiful, responsive, and high-performance web applications using React and Next.js.',
          description: 'Join our digital transformation team to craft beautiful, responsive, and high-performance web applications using React, Next.js, and modern styling libraries.',
          requirements: 'Strong expertise in JavaScript, TypeScript, React.js, and Next.js. Experience building responsive layouts with pixel-perfect CSS.',
          isOpen: true,
          postedDate: new Date().toISOString().split('T')[0]
        },
        {
          title: 'Valuation & XRF Specialist',
          slug: 'valuation-xrf-specialist',
          department: opsDept.documentId,
          location: 'Mumbai, India',
          employmentType: 'Full-time' as const,
          experienceLevel: '1-3 Years',
          summary: 'Conduct scientific purity assessment of gold ornaments using XRF testing machines.',
          description: 'Conduct scientific purity assessment of gold ornaments using advanced XRF testing machines, explain purity findings transparently to clients, and handle instant cash processing.',
          requirements: 'Technical proficiency in gold testing or laboratory evaluation methods. High integrity and focus on transparency.',
          isOpen: true,
          postedDate: new Date().toISOString().split('T')[0]
        }
      ];

      for (const job of initialJobs) {
        await strapi.documents(posUid).create({ data: job });
      }
    }

    // 9. Auto-configure Public Role Permissions
    try {
      const publicRole = await strapi.db.connection('up_roles').where('type', 'public').first();
      if (publicRole) {
        const roleId = publicRole.id;
        const actions = [
          'api::blog-page-setting.blog-page-setting.find',
          'api::blog-post.blog-post.find',
          'api::blog-post.blog-post.findOne',
          'api::category.category.find',
          'api::category.category.findOne',
          'api::faq.faq.find',
          'api::branch.branch.find',
          'api::state.state.find',
          'api::homepage.homepage.find',
          'api::hero-slide.hero-slide.find',
          'api::process-step.process-step.find',
          'api::difference-box.difference-box.find',
          'api::promo-slide.promo-slide.find',
          'api::testimonial.testimonial.find',
          'api::career-page-setting.career-page-setting.find',
          'api::job-department.job-department.find',
          'api::job-position.job-position.find',
          'api::job-position.job-position.findOne',
          'api::job-application.job-application.create'
        ];

        for (const action of actions) {
          let perm = await strapi.db.connection('up_permissions').where('action', action).first();
          if (!perm) {
            const document_id = Math.random().toString(36).substring(2, 16);
            const [insertedId] = await strapi.db.connection('up_permissions').insert({
              action,
              document_id,
              created_at: new Date(),
              updated_at: new Date(),
              published_at: new Date(),
              locale: null
            });
            perm = { id: insertedId };
          }

          const link = await strapi.db.connection('up_permissions_role_lnk')
            .where({ permission_id: perm.id, role_id: roleId })
            .first();
          if (!link) {
            const ordRes = await strapi.db.connection('up_permissions_role_lnk')
              .where('role_id', roleId)
              .max('permission_ord as maxOrd')
              .first();
            const nextOrd = (ordRes?.maxOrd || 0) + 1;
            await strapi.db.connection('up_permissions_role_lnk').insert({
              permission_id: perm.id,
              role_id: roleId,
              permission_ord: nextOrd
            });
          }
        }
        strapi.log.info('Auto-configured Public role permissions successfully.');
      }
    } catch (err) {
      strapi.log.error('Failed to configure Public role permissions:', err);
    }

    // 10. Pre-seed / Update Content Manager Organizer Categories
    try {
      const organizerUid = 'plugin::content-manager-organizer.content-manager-configuration';
      const organizerConfig = {
        sortBy: 'custom',
        groups: [
          {
            id: 'pages-single-types',
            label: '📄 Single Types & Pages',
            defaultExpanded: true,
            kind: 'singleType',
            items: [
              'api::homepage.homepage',
              'api::blog-page-setting.blog-page-setting',
              'api::career-page-setting.career-page-setting'
            ]
          },
          {
            id: 'homepage-components',
            label: '🏠 Homepage Sections',
            defaultExpanded: true,
            kind: 'collectionType',
            items: [
              'api::hero-slide.hero-slide',
              'api::promo-slide.promo-slide',
              'api::process-step.process-step',
              'api::difference-box.difference-box',
              'api::testimonial.testimonial'
            ]
          },
          {
            id: 'careers-and-jobs',
            label: '💼 Careers & Job Openings',
            defaultExpanded: true,
            kind: 'collectionType',
            items: [
              'api::job-position.job-position',
              'api::job-department.job-department',
              'api::job-application.job-application'
            ]
          },
          {
            id: 'blog-and-news',
            label: '📝 Blog & Categories',
            defaultExpanded: true,
            kind: 'collectionType',
            items: [
              'api::blog-post.blog-post',
              'api::category.category'
            ]
          },
          {
            id: 'locations-and-branches',
            label: '📍 Locations & Network',
            defaultExpanded: true,
            kind: 'collectionType',
            items: [
              'api::branch.branch',
              'api::state.state'
            ]
          },
          {
            id: 'leads-and-support',
            label: '📩 Enquiries & Support',
            defaultExpanded: true,
            kind: 'collectionType',
            items: [
              'api::form-submission.form-submission',
              'api::enquiry.enquiry',
              'api::faq.faq',
              'api::otp-request.otp-request'
            ]
          }
        ]
      };

      const existingConfig = await strapi.db.query(organizerUid).findOne({ where: { key: 'main' } });
      if (!existingConfig) {
        await strapi.db.query(organizerUid).create({
          data: {
            key: 'main',
            config: organizerConfig
          }
        });
        strapi.log.info('Seeded Content Manager Organizer configuration successfully.');
      }
    } catch (err: any) {
      strapi.log.warn('Could not auto-configure Content Manager Organizer:', err.message || err);
    }
  },
};
