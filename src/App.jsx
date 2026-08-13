import { useState, useEffect } from "react";
import axios from "axios";
import DOMPurify from "dompurify";
import Header from "./Header";

const FEED_URLS = [
  "https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fwww.sunnyskyz.com%2Frss%2F",
  "https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fwww.positive.news%2Ffeed%2F",
  "https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fwww.goodnewsnetwork.org%2Fcategory%2Fnews%2Ffeed",
  "https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fwww.optimistdaily.com%2Ffeed%2F",
];

const previewImageCache = new Map();
const extractImageFromHtml = (html) => {
  if (!html) return "";
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match?.[1] || "";
};

const getArticleImageFromNetlify = async (url) => {
  try {
    const response = await axios.get("/.netlify/functions/article-image", {
      params: { url },
    });

    return response.data?.image || "";
  } catch {
    return "";
  }
};

// Decode HTML entities in a string
// This is necessary because some feeds may encode HTML entities multiple times
// For example, &amp; becomes &. I had issues with #039;

const decodeHtmlEntities = (text = "") => {
  if (!text) return "";

  const textarea = document.createElement("textarea");
  textarea.innerHTML = text;

  // const onceDecoded = textarea.value;
  // textarea.innerHTML = onceDecoded;

  return textarea.value.replace(/and#0*39;/g, "'");
};

const getPreviewImage = async (url, options = {}) => {
  const { descriptionHtml = "", thumbnail = "" } = options;
  try {
    if (previewImageCache.has(url)) {
      return previewImageCache.get(url);
    }

    const host = new URL(url).hostname;
    const fallbackImage = thumbnail || extractImageFromHtml(descriptionHtml);

    if (
      host.includes("goodnewsnetwork.org") ||
      host.includes("positive.news")
    ) {
      const articleImage = await getArticleImageFromNetlify(url);
      if (articleImage) {
        previewImageCache.set(url, articleImage);
        return articleImage;
      }
    }

    if (host.includes("optimistdaily.com") && fallbackImage) {
      previewImageCache.set(url, fallbackImage);
      return fallbackImage;
    }

    const previewResponse = await axios.get("https://api.microlink.io/", {
      params: { url },
    });

    const image = previewResponse.data?.data?.image?.url || fallbackImage;
    previewImageCache.set(url, image);
    return image;
  } catch (error) {
    if (thumbnail || descriptionHtml) {
      const image = thumbnail || extractImageFromHtml(descriptionHtml);
      previewImageCache.set(url, image);
      return image;
    }
    console.error("Failed to fetch preview image:", error);
    return "";
  }
};

const getFirstParagraph = (rawDescription) => {
  // Remove img tags from the description to avoid including images in the preview
  const cleanDescription = DOMPurify.sanitize(rawDescription, {
    FORBID_TAGS: ["img"],
  });
  // Parse the sanitized HTML and extract the first paragraph
  const doc = new DOMParser().parseFromString(cleanDescription, "text/html");
  const firstParagraph = doc.querySelector("p");
  return firstParagraph ? firstParagraph.innerHTML : cleanDescription;
};

function App() {
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    const controller = new AbortController();
    const feedUrls = FEED_URLS;

    async function fetchPosts() {
      try {
        const normalizedFeedUrls = feedUrls.map((url) => url.trim());

        const [posNews, goodNews, optimistDaily, sunnyskyz] = await Promise.all(
          normalizedFeedUrls.map((url) =>
            axios.get(url, { signal: controller.signal }),
          ),
        );

        const feedItems = [
          ...posNews.data.items,
          ...goodNews.data.items,
          ...optimistDaily.data.items,
          ...sunnyskyz.data.items,
        ].slice(0, 40); // Limit to 40 posts

        // Fetch preview images for each post (async/await)
        // Use Promise.all to wait for all preview image fetches to complete
        const articleCards = await Promise.all(
          feedItems.map(async (item) => {
            const rawDescription = item.description || "";
            const previewImage = await getPreviewImage(item.link, {
              descriptionHtml: rawDescription,
              thumbnail: item.thumbnail,
            });
            return {
              category: item.categories?.[0] ?? "News",
              title: decodeHtmlEntities(item.title),
              description: getFirstParagraph(rawDescription),
              link: item.link,
              image: previewImage,
            };
          }),
        );

        setPosts(articleCards);
      } catch (err) {
        // Ignore the error if the request was cancelled
        if (axios.isCancel(err) || err.name === "CanceledError") return; // request was cancelled
        // Log other errors to the console for debugging
        console.error("Failed to fetch posts:", err);
      }
    }

    fetchPosts();

    // Cleanup function to cancel the request if the component unmounts
    // This prevents memory leaks and avoids setting state on an unmounted component
    return () => {
      controller.abort();
    };
  }, []);

  return (
    <main className="relative mx-auto min-h-screen max-w-6xl px-5 pb-20 sm:px-8 lg:px-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.7),transparent_65%)]" />
      <Header />
      <section className="grid gap-7 lg:grid-cols-2">
        {posts.map((post) => (
          <article
            className="group overflow-hidden rounded-3xl border border-white/80 bg-white/86 shadow-[0_14px_36px_rgba(15,23,42,0.09)] backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_22px_50px_rgba(15,23,42,0.14)]"
            key={post.link}
          >
            <a href={post.link} className="block focus:outline-none">
              <div className="relative aspect-16/10 overflow-hidden bg-slate-200">
                {post.image ? (
                  <img
                    src={post.image}
                    alt={post.title}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src =
                        "https://via.placeholder.com/1200x750?text=No+Image";
                    }}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-slate-100 via-amber-50 to-rose-50 text-sm font-medium text-slate-500">
                    No image available
                  </div>
                )}
                <div className="absolute inset-0 bg-linear-to-t from-slate-950/24 via-transparent to-transparent" />
              </div>

              <div className="space-y-5 p-7 sm:p-8">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center rounded-full bg-sky-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-900">
                    {post.category}
                  </span>
                  <span className="text-xs font-medium uppercase tracking-[0.22em] text-slate-400 transition group-hover:text-slate-600">
                    Read
                  </span>
                </div>

                <h3
                  className="text-balance text-[1.75rem] font-bold leading-[1.2] text-slate-950 transition group-hover:text-slate-800"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {post.title}
                </h3>

                <p
                  className="text-pretty max-w-[58ch] text-[0.97rem] leading-7 text-slate-600 [&_p]:mb-4 [&_p:last-child]:mb-0"
                  dangerouslySetInnerHTML={{ __html: post.description }}
                />

                <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800 transition group-hover:translate-x-0.5 group-hover:text-slate-950">
                  <span>Read article</span>
                  <span aria-hidden="true">→</span>
                </div>
              </div>
            </a>
          </article>
        ))}
      </section>
    </main>
  );
}

export default App;
