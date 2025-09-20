import { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://domacross.xyz';
  
  // Fetch all domains from the API
  let domains: string[] = [];
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/domains/list`);
    if (response.ok) {
      const data = await response.json();
      domains = data.domains || [];
    }
  } catch (error) {
    console.error('Error fetching domains for sitemap:', error);
  }

  // Static pages
  const staticPages = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 1,
    },
    {
      url: `${baseUrl}/dashboard`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/competitions`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    },
  ];

  // Domain deal pages - highest priority for SEO
  const domainPages = domains.map((domain) => ({
    url: `${baseUrl}/domains/${domain}`,
    lastModified: new Date(),
    changeFrequency: 'hourly' as const,
    priority: 0.95,
  }));

  return [...staticPages, ...domainPages];
}
