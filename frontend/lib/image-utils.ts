/**
 * Image URL utilities for converting S3 URLs to CloudFront URLs
 */

/**
 * Convert S3 URL to CloudFront URL if CloudFront is configured
 * @param s3Url - Original S3 URL (or any URL)
 * @returns CloudFront URL if configured and URL is S3, otherwise original URL
 */
export function convertToCloudFrontUrl(s3Url: string): string {
  if (!s3Url) return s3Url
  
  // Get CloudFront domain from environment (set at build time)
  const cloudfrontDomain = process.env.NEXT_PUBLIC_CLOUDFRONT_IMAGE_DOMAIN
  
  if (!cloudfrontDomain) {
    // CloudFront not configured, return original URL
    return s3Url
  }
  
  // Check if URL is an S3 URL
  // Pattern: https://bucket.s3.region.amazonaws.com/path/to/file
  // or: https://bucket.s3.amazonaws.com/path/to/file
  const s3UrlPattern = /^https:\/\/([^/]+)\.s3(?:\.([^.]+))?\.amazonaws\.com\/(.+)$/
  const match = s3Url.match(s3UrlPattern)
  
  if (match && match[3]) {
    // Extract the path (everything after bucket name)
    const imagePath = match[3]
    // Return CloudFront URL
    return `https://${cloudfrontDomain}/${imagePath}`
  }
  
  // If URL doesn't match S3 pattern, return as-is (might already be CloudFront or other CDN)
  return s3Url
}


/**
 * Convert an absolute localhost / 127.0.0.1 media URL to a relative `/media/...`
 * path so it routes through Next.js' rewrite proxy (and reaches the backend
 * container via `host.docker.internal:8000` in dev).
 *
 * Why this exists: in local dev, Django stores greeting card / thumbnail URLs
 * as absolute "http://localhost:8000/media/..." (because that's how the
 * uploading browser saw the request host). When `next/image`'s optimizer
 * tries to fetch that URL from inside the frontend Docker container,
 * "localhost:8000" resolves to the frontend container itself — nothing
 * listens on 8000 there, so the optimizer 502s and the thumbnail renders
 * broken. Stripping the host turns it into "/media/..." which next.config.js
 * rewrites to `${NEXT_PUBLIC_API_BASE}/media/...` — that variable points to
 * `host.docker.internal:8000` in the dev compose stack and reaches the
 * backend cleanly.
 *
 * S3 / CloudFront URLs are left untouched.
 */
export function normalizeMediaUrlForNextImage(url: string | null | undefined): string {
  if (!url) return ''
  // Strip http(s)://localhost(:port)/ or http(s)://127.0.0.1(:port)/ prefix only.
  return url.replace(/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\//, '/')
}

