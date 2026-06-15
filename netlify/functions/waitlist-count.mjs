// Live waitlist count for the Vector Football waitlist page.
//
// Returns the REAL Mailchimp subscriber count so the number on /waitlist/ climbs
// by one with every genuine signup. The audience/list id is public (it already
// appears in the embedded signup form), so it is safe to keep here. The API key
// is NOT — it must be provided via the MAILCHIMP_API_KEY environment variable in
// Netlify (Site settings → Environment variables) and is never committed.
//
//   GET /.netlify/functions/waitlist-count  ->  { "count": <number>, "source": ... }
//
// ESM (.mjs) because the repo is "type": "module". The handler always responds
// 200 with a number, falling back to FALLBACK if the key is missing or Mailchimp
// is unreachable, so it can never break the page.

const LIST_ID = "bdebabfab1";
const FALLBACK = 32;

export const handler = async () => {
  const headers = {
    "Content-Type": "application/json",
    // Cache at Netlify's edge for 5 minutes so we don't call Mailchimp on every
    // page view (and stay well under Mailchimp's rate limits).
    "Cache-Control": "public, max-age=300",
  };

  const apiKey = process.env.MAILCHIMP_API_KEY;
  // Mailchimp keys look like "<hex>-us10"; the suffix is the datacenter.
  const dc = apiKey && apiKey.includes("-") ? apiKey.split("-")[1] : null;
  if (!apiKey || !dc) {
    return { statusCode: 200, headers, body: JSON.stringify({ count: FALLBACK, source: "fallback" }) };
  }

  const url = `https://${dc}.api.mailchimp.com/3.0/lists/${LIST_ID}?fields=stats.member_count`;
  const auth = "Basic " + Buffer.from(`anystring:${apiKey}`).toString("base64");

  try {
    const res = await fetch(url, { headers: { Authorization: auth } });
    if (!res.ok) {
      return { statusCode: 200, headers, body: JSON.stringify({ count: FALLBACK, source: "fallback" }) };
    }
    const data = await res.json();
    const count = data && data.stats && data.stats.member_count;
    if (typeof count !== "number") {
      return { statusCode: 200, headers, body: JSON.stringify({ count: FALLBACK, source: "fallback" }) };
    }
    return { statusCode: 200, headers, body: JSON.stringify({ count, source: "mailchimp" }) };
  } catch (_) {
    return { statusCode: 200, headers, body: JSON.stringify({ count: FALLBACK, source: "fallback" }) };
  }
};
