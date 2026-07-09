export function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

export function faviconUrl(domain) {
  return domain ? `https://icons.duckduckgo.com/ip3/${domain}.ico` : null;
}

export function ghSocialImage(fullName) {
  return `https://opengraph.githubassets.com/1/${fullName}`;
}
