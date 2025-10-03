import { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://domacross.xyz';
  
  // Fetch all domains from the API
  let domains: string[] = [];
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const response = await fetch(`${apiUrl}/api/v1/domains/list`);
    if (response.ok) {
      const data = await response.json();
      domains = data.domains || [];
    }
  } catch (error) {
    console.warn('Error fetching domains for sitemap:', error);
    // Use mock domains for sitemap generation
    domains = ['crypto.eth', 'defi.eth', 'web3.eth', 'nft.eth', 'dao.eth'];
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
