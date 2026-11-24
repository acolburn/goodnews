const allowedHosts = new Set([
  "goodnewsnetwork.org",
  "www.goodnewsnetwork.org",
  "positive.news",
  "www.positive.news",
]);

const POSITIVE_NEWS_HOSTS = new Set(["positive.news", "www.positive.news"]);

// positive.news article pages sit behind a bot challenge, but their public
// WordPress REST API is reachable, so resolve featured images through it.
const getPositiveNewsImage = async (pageUrl) => {
  const slug = new URL(pageUrl).pathname.split("/").filter(Boolean).pop();
  if (!slug) return "";

  const apiUrl = `https://www.positive.news/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}&_embed=1`;

  try {
    const response = await fetch(apiUrl, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return "";

    const posts = await response.json();
    const media = posts?.[0]?._embedded?.["wp:featuredmedia"]?.[0];
    if (!media) return "";

    const sizes = media.media_details?.sizes || {};
    return (
      sizes["large-image"]?.source_url ||
      sizes["1536x1536"]?.source_url ||
      sizes["medium_large"]?.source_url ||
      sizes.large?.source_url ||
      media.source_url ||
      ""
    );
  } catch {
    return "";
  }
};

const getAttribute = (tag, attribute) => {
  const match = tag.match(
    new RegExp(`${attribute}\\s*=\\s*["']([^"']+)["']`, "i"),
  );
  return match?.[1] || "";
};

const resolveUrl = (value, pageUrl) => {
  if (!value) return "";

  try {
    return new URL(value, pageUrl).toString();
  } catch {
    return value;
  }
};

const extractImageUrl = (html, pageUrl) => {
  const tags = html.match(/<(meta|link)[^>]*>/gi) || [];

  for (const tag of tags) {
    const property = getAttribute(tag, "property").toLowerCase();
    const name = getAttribute(tag, "name").toLowerCase();
    const rel = getAttribute(tag, "rel").toLowerCase();
    const content = getAttribute(tag, "content") || getAttribute(tag, "href");

    if (
      property === "og:image" ||
      property === "og:image:secure_url" ||
      name === "twitter:image" ||
      name === "twitter:image:src" ||
      rel === "image_src"
    ) {
      const resolved = resolveUrl(content, pageUrl);
      if (resolved) return resolved;
    }
  }

  const firstImage = html.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] || "";
  return resolveUrl(firstImage, pageUrl);
};

export async function handler(event) {
  const pageUrl = event.queryStringParameters?.url;

  if (!pageUrl) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Missing url query parameter" }),
    };
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(pageUrl);
  } catch {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Invalid url" }),
    };
  }

  if (!allowedHosts.has(parsedUrl.hostname)) {
    return {
      statusCode: 403,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Host not allowed" }),
    };
  }

  try {
    if (POSITIVE_NEWS_HOSTS.has(parsedUrl.hostname)) {
      const image = await getPositiveNewsImage(pageUrl);

      if (image) {
        return {
          statusCode: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=3600, s-maxage=86400",
          },
          body: JSON.stringify({ image }),
        };
      }
    }

    const response = await fetch(pageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!response.ok) {
      return {
        statusCode: 502,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: `Upstream request failed: ${response.status}`,
        }),
      };
    }

    const html = await response.text();
    const image = extractImageUrl(html, pageUrl);

    if (!image) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "No image found" }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
      },
      body: JSON.stringify({ image }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Failed to extract image" }),
    };
  }
}
