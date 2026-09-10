const fs = require('fs');
const path = require('path');

const pageFile = 'd:\\MGP\\MGP-WEB\\src\\app\\career\\page.tsx';
const content = `import { Metadata } from 'next';
import CareerPage from '@/components/career/page';
import { getCareerPageSettings } from '@/lib/strapi';

export async function generateMetadata(): Promise<Metadata> {
  const data = await getCareerPageSettings();
  return {
    title: data?.seoTitle || 'Careers | Muthoot Gold Point',
    description: data?.seoDescription || 'Join the Muthoot Gold Point team. Explore our current job openings and build a rewarding career with India\\'s first organized gold recycler.',
    openGraph: {
      title: data?.seoTitle || 'Careers | Muthoot Gold Point',
      description: data?.seoDescription || 'Explore our current job openings and build a rewarding career.',
      type: 'website',
    }
  };
}

export default async function Page() {
  const data = await getCareerPageSettings();
  return <CareerPage data={data} />;
}
`;

fs.writeFileSync(pageFile, content);
console.log('Successfully updated career/page.tsx');
