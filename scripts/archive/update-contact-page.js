const fs = require('fs');
const path = require('path');

const pageFile = 'd:\\MGP\\MGP-WEB\\src\\app\\contact-us\\page.tsx';
const content = `import { Metadata } from 'next';
import ContactPage from '@/components/contact/ContactPage';
import { getContactUsPage } from '@/lib/strapi';
import { notFound } from 'next/navigation';

export async function generateMetadata(): Promise<Metadata> {
  const data = await getContactUsPage();
  return {
    title: data?.seoTitle || 'Contact Us | Muthoot Gold Point',
    description: data?.seoDescription || 'Get in touch with Muthoot Gold Point. Find our registered office details, write to us directly, or look up the address, phone, and email for any of our branches.',
    openGraph: {
      title: data?.seoTitle || 'Contact Us | Muthoot Gold Point',
      description: data?.seoDescription || 'Find our registered office details, write to us directly, or look up any Muthoot Gold Point branch by city.',
      type: 'website',
      images: data?.ogImage ? [{ url: data.ogImage }] : undefined,
    }
  };
}

export default async function Page() {
  const data = await getContactUsPage();
  if (!data) return notFound();
  return <ContactPage data={data} />;
}
`;

fs.writeFileSync(pageFile, content);
console.log('Successfully updated contact-us/page.tsx');
