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
    const defaultHomeVideos = [
      { code: 'hi', label: 'हिंदी', videoUrl: '/videos/goldpoint-hindi.mp4' },
      { code: 'ml', label: 'മലയാളം', videoUrl: '/videos/goldpoint-malayalam.mp4' },
      { code: 'ta', label: 'தமிழ்', videoUrl: '/videos/goldpoint-tamil.mp4' },
      { code: 'kn', label: 'ಕನ್ನಡ', videoUrl: '/videos/goldpoint-kannada.mp4' },
      { code: 'en', label: 'EN' },
      { code: 'te', label: 'తెలుగు' },
      { code: 'mr', label: 'मराठी' },
      { code: 'bn', label: 'বাংলা' }
    ];
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
          seoDescription: 'Get the True Market Value of your old, unused or pledged gold through a transparent process conducted entirely in front of you.',
          homeVideos: defaultHomeVideos
        }
      });
    } else {
      const fullHomepage = await strapi.documents(homepageUid).findFirst({ populate: ['homeVideos'] });
      if (!fullHomepage?.homeVideos || (Array.isArray(fullHomepage.homeVideos) && fullHomepage.homeVideos.length === 0)) {
        strapi.log.info('Seeding default homeVideos for Homepage single type...');
        await strapi.documents(homepageUid).update({
          documentId: homepageExisting.documentId,
          data: {
            homeVideos: defaultHomeVideos
          }
        });
      }
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

    // 4b. Seed Comparison Rows
    const comparisonRowUid = 'api::comparison-row.comparison-row';
    const comparisonRowsExisting = await strapi.documents(comparisonRowUid).findMany({ limit: 1 });
    if (comparisonRowsExisting.length === 0) {
      strapi.log.info('Seeding Comparison Rows...');
      const rows = [
        { order: 1, title: 'Valuation of your Gold', mgpText: 'Multilevel scientific testing for exact Gold value only', tradText: 'Touchstone gives approximate Gold value' },
        { order: 2, title: 'Cleaning of your Gold', mgpText: 'Cleans the Gold with ultrasonic machine to get accurate weight', tradText: 'Do not clean and deduct melting cost directly' },
        { order: 3, title: 'Weighing of your Gold', mgpText: 'Takes up to 3 decimals points (per gram) that are showing on the weighing scale', tradText: 'Round off to lowest number showing on the weighing scale' },
        { order: 4, title: 'Gold rate', mgpText: 'Uses current market rate', tradText: 'Use lowest Gold rate of the day' },
        { order: 5, title: 'Melting of your Gold', mgpText: 'Multilevel scientific testing for exact Gold value only', tradText: 'Use low quality crucibles which allows Gold particles to remain inside after melting' },
        { order: 6, title: 'Mode of payment / invoicing', mgpText: 'Up to Rs 10,000 given as cash. Amounts higher than Rs 10,000 instantly paid to your bank account via NEFT/IMPS/RT. Invoice is always shared.', tradText: 'Cash payment with no invoice given' },
      ];
      for (const row of rows) {
        await strapi.documents(comparisonRowUid).create({ data: row });
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
          cultureHeading: 'Why Join Muthoot?',
          cultureDescription: 'At Muthoot Gold Point, we believe our people are our strongest asset. We provide a collaborative, transparent, and growth-oriented work environment with competitive benefits and continuous learning opportunities.',
          seoTitle: 'Careers | Work With Muthoot Gold Point',
          seoDescription: 'Explore open job opportunities and build your career with Muthoot Gold Point.'
        }
      });
    } else if (careerSettingExisting.cultureHeading === 'Why Work With Us?') {
      strapi.log.info('Updating Career Page Settings with new Culture Heading...');
      await strapi.documents(careerSettingUid).update({
        documentId: careerSettingExisting.documentId,
        data: {
          cultureHeading: 'Why Join Muthoot?'
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

    // 8a. Seed About Us Page
    const aboutUsUid = 'api::about-us-page.about-us-page';
    const aboutUsData = {
      heroEyebrow: "A Muthoot Exim (P) Ltd. Enterprise",
      heroTitle: "Muthoot Gold Point — Precision You Can Trust",
      heroDescription: "Muthoot Gold Point is a unit of Muthoot Exim (P) Ltd., the precious metal vertical of the Muthoot Pappachan Group that specialises in innovative products and offerings in the precious metal space. The vertical gives customers access to quality products that meet the highest standards at an affordable price. Apart from Muthoot Gold Point, Muthoot Exim’s flagship products include Swarnavarsham, Swethavarsham, and Corporate gifting.\nVisit the corporate website of Muthoot EXIM (P) Ltd to know more about the company: www.muthootexim.com\nMuthoot Gold Point is the first national-level organised sector player to get into the recycling of gold that is in sync with the Vision laid down by the Government of India for the Indian Gold Industry.\nWe enable customers to sell gold in a transparent and efficient manner. The unparalleled experience of selling old gold for instant cash is 100% fair and precise. Our customers enjoy a safe, transparent and scientifically tested way of selling gold.\nMobile Muthoot Gold Point – India’s First Mobile Gold Buying van buys gold at the customer’s doorstep. Continuing with our Group values around trust, we take the XRF and ultrasonic machines to the customer’s doorstep to ensure they are getting maximum value for their gold.",
      heroButtonText: "Sell Your Gold",
      heroButtonLink: "#what-we-do",
      heroChecklist: [
        { text: "133+ years of Muthoot Pappachan Group legacy" },
        { text: "India's first organised-sector gold recycler" }
      ],
      recyclingSubtitle: "Closed-Loop Ecosystem",
      recyclingTitle: "What Do We Do With \nThe Gold We Buy?",
      recyclingDescription: "Every gram we buy is refined into 995 investment-grade gold bars and re-channeled into domestic markets — stabilizing local demand and curbing the nation's reliance on imports.",
      recyclingSteps: [
        { title: 'Scientific Valuation', desc: 'Our gold is valued transparently using ultrasonic cleaning and advanced XRF gold-testing machines right in front of you.' },
        { title: 'Refinement into 995 Gold Bars', desc: 'All gold purchased from customers is sent to government-approved refineries and cast into pure 995 investment-grade gold bars.' },
        { title: 'Reducing Import Dependence', desc: "By recycling domestic gold and supplying it back to local markets, we directly reduce India's heavy dependency on gold imports." }
      ],
      historySubtitle: "Legacy & Heritage",
      historyTitle: "Our Historic Milestones",
      historyDescription: "From a local Kerala grain trader in 1887 to a multi-billion dollar diversified conglomerate.",
      historyMilestones: [
        { year: "1887", title: "Humble Beginnings", desc: "Muthoot Ninan Mathai started humbly as a retail and wholesale trader of grains at Kozhencherry, and later launched a Chit Funds business for estate workers." },
        { year: "1950s", title: "Gold Loan Pioneer", desc: "The family entered the gold loan business and became the largest player in Chits & Gold Loans." },
        { year: "1979", title: "Muthoot Pappachan Group Formed", desc: "An amicable family partition led to the genesis of the Muthoot Pappachan Group under Late Mathew M Thomas." },
        { year: "Today", title: "133 Years of Legacy", desc: "Empowering Indians across Financial Services, Hospitality, Automotive, Realty, IT Services, Healthcare, Precious Metals, Global Services and Alternate Energy." }
      ],
      parentEyebrow: "Parent Conglomerate",
      parentTitle: "About The Muthoot Pappachan Group",
      parentDescription: "Popularly known as Muthoot Blue, the group is built on the bedrock of Trust and shaped by the core values of Integrity, Collaboration, and Excellence. With its genesis in founder Shri Muthoot Pappachan's unwavering faith in love, respect, and duty towards humanity, it has evolved into a massive business conglomerate that places the well-being of the underserved masses of India at the very center of its purpose.",
      parentCompareHeading: "A Massive Business Conglomerate",
      parentChecklist: [
        { text: "Trusted and reliable since 1887" },
        { text: "Empowering millions of Indians to rise above their ordinariness" }
      ],
      parentStats: [
        { number: "133+", label: "Years of Legacy" },
        { number: "4,200+", label: "Branches" },
        { number: "100k+", label: "Daily Customers" },
        { number: "24,000+", label: "Employees" }
      ],
      philanthropySubtitle: "Social Commitment",
      philanthropyTitle: "Our Unwavering Focus on Philanthropy",
      philanthropyDescription: "Armed with a commitment to society, the Group set up the Muthoot Pappachan Foundation (MPF), a Public Charitable Trust and the CSR arm of MPG.",
      philanthropyInitiativeTitle: "HEEL Initiative",
      philanthropyInitiativeDesc: "The corporate social responsibility (CSR) programs of Muthoot Blue revolve around the signature theme HEEL, touching thousands of lives by enhancing capabilities, providing health relief, and establishing self-reliant livelihoods.",
      philanthropyPillars: [
        { letter: "H", title: "Health", desc: "Providing access to quality healthcare, diagnostics, and medical equipment in rural and economically backward regions." },
        { letter: "E", title: "Education", desc: "Supporting primary education, establishing learning centers, providing scholarships, and supporting digital classroom infrastructures." },
        { letter: "E", title: "Environment", desc: "Promoting green cover, driving clean energy solutions, encouraging organic farming methods, and supporting water harvesting programs." },
        { letter: "L", title: "Livelihood", desc: "Empowering under-served communities, youth, and women through skill development, vocational courses, and self-employment training." }
      ],
      philanthropyConclusion: "We believe in building a \"Business Without Boundaries\", where obstacles are treated as stepping stones to growth. We strive to take the world forward with perseverance, commitment, and sincerity. Indeed, the possibilities are infinite!",
      presentSubtitle: "Present Day",
      presentTitle: "Where We Stand Today",
      presentDescription: "Currently serving over 5 million customers through a nation-wide workforce of 24,000 employees.",
      presentSubDescription: "Our customer-centric approach and constant innovation in products cater to changing customer needs, helping us secure lifelong loyalty. By adopting state-of-the-art technology without compromising our core ethics, we serve over 100,000 customers daily.",
      presentCardTag: "One-Stop Solution",
      presentCardTitle: "The Financial Supermarket",
      presentCardDesc: "Each of our 4,200+ branches operates as a comprehensive financial hub, housing a diverse range of products designed to empower local ambitions under a single roof.",
      presentServicesTitle: "Services Offered at Our Branches",
      presentServices: [
        { title: "Gold Loans", icon: "💰" },
        { title: "Small Business Loans", icon: "💼" },
        { title: "Affordable Housing Loans", icon: "🏠" },
        { title: "Two Wheeler Loans", icon: "🏍️" },
        { title: "Used-car Loans", icon: "🚗" },
        { title: "Domestic Money Transfer", icon: "💸" },
        { title: "International Remittance", icon: "🌐" },
        { title: "Foreign Exchange", icon: "💱" },
        { title: "Insurance Products & Services", icon: "🛡️" },
        { title: "Wealth Management Services", icon: "📈" },
        { title: "Affordable Gold Jewellery", icon: "✨" }
      ],
      seoTitle: "About Us | Muthoot Gold Point",
      seoDescription: "Learn about Muthoot Gold Point, a unit of Muthoot Exim, and our legacy of trust, scientific gold valuation, and transparency."
    };

    const aboutUsExisting = await strapi.documents(aboutUsUid).findFirst();
    if (!aboutUsExisting) {
      strapi.log.info('Seeding About Us Page...');
      await strapi.documents(aboutUsUid).create({ data: aboutUsData });
    }

    // 8c. Seed Contact Us Page
    const contactUsUid = 'api::contact-us-page.contact-us-page';
    const contactUsExists = await strapi.documents(contactUsUid).findFirst();
    if (!contactUsExists) {
      strapi.log.info('Seeding Contact Us Page Data...');
      await strapi.documents(contactUsUid).create({
        data: {
          heroHeading: "We’re Just A Message Away.",
          heroLead: "Have questions or need assistance? We’re here to help you with all your gold loan & selling needs.",
          formTitle: "Write to us",
          officeName: "MUTHOOT GOLD POINT",
          officeAddress: "Muthoot Exim Private Limited, 40/7384 Muthoot Towers, M.G. Road, Ernakulam, Kerala - 682035",
          officePhone1: "0484 2351481",
          officePhone2: "0484 2351494",
          officeEmail: "info@muthootexim.com",
          officeMapUrl: "https://maps.google.com/maps?q=Muthoot%20Towers,%20MG%20Road,%20Ernakulam,%20Kerala%20682035&t=&z=15&ie=UTF8&iwloc=&output=embed",
          officeMapPopupTitle: "Muthoot Towers",
          officeMapPopupText: "M.G. Road, Ernakulam, Kerala - 682035",
          seoTitle: "Contact Us | Muthoot Gold Point",
          seoDescription: "Get in touch with Muthoot Gold Point."
        },
        status: 'published'
      });
    }

    // 8d. Seed Gold Rate Page
    const goldRateUid = 'api::gold-rate-page.gold-rate-page';
    const goldRateExists = await strapi.documents(goldRateUid).findFirst();
    if (!goldRateExists) {
      strapi.log.info('Seeding Gold Rate Page Data...');
      await strapi.documents(goldRateUid).create({
        data: {
          seoTitle: "Today's Gold Rate | Gold Price Per Gram | Gold Point",
          seoDescription: "Check today's gold rate and gold price per gram. Calculate the estimated value of your gold and explore transparent gold valuation with Gold Point.",
          heroTitle: "Live Gold Rates & Valuation",
          heroDescription: "Get the most accurate and real-time market value for your gold."
        }
      });
    }

    // 8e. Seed Mobile Van Page
    const mobileVanUid = 'api::mobile-van-page.mobile-van-page';
    const mobileVanExists = await strapi.documents(mobileVanUid).findFirst();
    if (!mobileVanExists) {
      strapi.log.info('Seeding Mobile Van Page Data...');
      await strapi.documents(mobileVanUid).create({
        data: {
          heroHeadingLight1: "Mobile",
          heroHeadingLight2: "Van",
          heroHeadingBold: "India’s First Mobile Gold Buying Van",
          heroDescription: "We bring our state-of-the-art gold valuation process directly to your doorstep. Safe, secure, and fully transparent.",
          howItWorksSubtitle: "Simple Process",
          howItWorksTitle: "How Our Mobile Van Works",
          howItWorksSteps: [
            { order: 1, title: 'Book an Appointment', desc: 'Call us or fill out our simple online form to schedule a visit at your convenience.' },
            { order: 2, title: 'Van Arrives at Your Doorstep', desc: 'Our fully equipped Mobile Van arrives at your location with trained valuation experts.' },
            { order: 3, title: 'On-the-Spot Valuation', desc: 'We test your gold using advanced XRF technology right in front of you.' },
            { order: 4, title: 'Instant Payment', desc: 'Receive cash or instant bank transfer for your gold immediately.' }
          ],
          testingMethodsTitle: "State-of-the-Art Technology On Wheels",
          testingMethods: [
            { title: 'XRF Gold Testing', desc: '100% accurate, non-destructive purity testing', iconType: 'flask' },
            { title: 'Ultrasonic Cleaning', desc: 'Removes dirt without damaging your gold', iconType: 'scale' },
            { title: 'Precision Weighing', desc: 'Weighed to 3 decimal places for maximum accuracy', iconType: 'rupee' }
          ],
          locationsTitle: "Where We Operate",
          locationsDescription: "Our Mobile Vans currently serve major metropolitan areas across India.",
          appointmentTitle: "Book Your Mobile Van Visit",
          appointmentDescription: "Experience the convenience of selling your gold from the comfort of your home.",
          seoTitle: "Mobile Van - Sell Gold at Home | Muthoot Gold Point",
          seoDescription: "Book our Mobile Van and sell your gold from the comfort of your home. We bring advanced XRF testing and instant payment directly to your doorstep."
        }
      });
    }

    
    // 8f. Seed Sell Gold Page Setting
    const sellGoldUid = 'api::sell-gold-page-setting.sell-gold-page-setting' as any;
    const sellGoldExists = await strapi.documents(sellGoldUid).findFirst();
    if (!sellGoldExists) {
      strapi.log.info('Seeding Sell Gold Page Setting Data...');
      try {
        await strapi.documents(sellGoldUid).create({
          data: {
            seoTitle: 'Sell Gold for Cash | Muthoot Gold Point',
            seoDescription: 'Sell your old gold and get cash instantly with 100% fair and precise gold buying. Free purity testing, 100% transparent process, and free ultrasonic cleaning.',
            seoKeywords: 'Sell Gold, Cash for Gold, Gold Buyers, Sell Old Gold, Muthoot Gold Point, Instant Cash for Gold',
            weBuyGoldImage: null as any
          }
        });
      } catch (err) {
        // weBuyGoldImage is a required media field, so this seed can't succeed; add the page in the admin panel instead.
        strapi.log.warn(`Skipped Sell Gold Page Setting seed: ${(err as Error).message}`);
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
          'api::shared-media.shared-media.find',
          'api::gold-rate-page.gold-rate-page.find',
          'api::mobile-van-page.mobile-van-page.find',
          'api::about-us-page.about-us-page.find',
          'api::contact-us-page.contact-us-page.find',
          'api::hero-slide.hero-slide.find',
          'api::process-step.process-step.find',
          'api::difference-box.difference-box.find',
          'api::comparison-row.comparison-row.find',
          'api::promo-slide.promo-slide.find',
          'api::testimonial.testimonial.find',
          'api::career-page-setting.career-page-setting.find',
          'api::job-department.job-department.find',
          'api::job-position.job-position.find',
          'api::job-position.job-position.findOne',
          'api::job-application.job-application.create',
          'api::form-submission.form-submission.create',
          'api::enquiry.enquiry.create',
          'api::mobile-van-submission.mobile-van-submission.create',
          'api::gold-valuation-submission.gold-valuation-submission.create',
          'api::contact-submission.contact-submission.create',
          'api::otp-request.otp-request.create'
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
              'api::shared-media.shared-media',
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
              'api::comparison-row.comparison-row',
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
