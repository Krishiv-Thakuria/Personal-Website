// Contribution calendar for the homepage heatmap (rendered by /contributions.js).
//
// Reads the public calendar GitHub renders on the profile page, so no token is
// needed. Private-repo work is included because the profile is set to share
// private contribution counts. Vercel's CDN caches the response, so GitHub is
// hit at most about once an hour.

const USERNAME = 'Krishiv-Thakuria';
const SOURCE = `https://github.com/users/${USERNAME}/contributions`;

module.exports = async function handler(req, res) {
  try {
    const upstream = await fetch(SOURCE, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; contribution-calendar)' },
    });
    if (!upstream.ok) throw new Error(`GitHub responded ${upstream.status}`);

    const days = parseCalendar(await upstream.text());
    if (days.length === 0) throw new Error('No contribution days found in GitHub markup');

    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
    res.status(200).json({
      username: USERNAME,
      total: days.reduce((sum, d) => sum + d.count, 0),
      days: withLevels(days),
    });
  } catch (err) {
    console.error(err);
    res.setHeader('Cache-Control', 'no-store');
    res.status(502).json({ error: 'Could not load contributions' });
  }
};

// GitHub renders each day as <td id="…" data-date="YYYY-MM-DD"> and puts the
// count in a separate <tool-tip for="…">12 contributions on March 4th.</tool-tip>.
function parseCalendar(html) {
  const dateById = new Map();
  for (const [tag] of html.matchAll(/<td\b[^>]*\bContributionCalendar-day\b[^>]*>/g)) {
    const id = tag.match(/\sid="([^"]+)"/);
    const date = tag.match(/\sdata-date="(\d{4}-\d{2}-\d{2})"/);
    if (id && date) dateById.set(id[1], date[1]);
  }

  const days = [];
  for (const [, id, text] of html.matchAll(/<tool-tip\b[^>]*\sfor="([^"]+)"[^>]*>([^<]*)<\/tool-tip>/g)) {
    const date = dateById.get(id);
    const count = text.trim().match(/^(No|[\d,]+) contributions?\b/);
    if (!date || !count) continue;
    days.push({ date, count: count[1] === 'No' ? 0 : Number(count[1].replace(/,/g, '')) });
  }

  return days.sort((a, b) => (a.date < b.date ? -1 : 1));
}

// Shade by quartiles of active days rather than GitHub's own levels, which put
// nearly every day in the palest bucket once a handful of huge days set the max.
function withLevels(days) {
  const active = days.map((d) => d.count).filter((c) => c > 0).sort((a, b) => a - b);
  const quantile = (p) => active[Math.floor(p * (active.length - 1))] || 0;
  const [q1, q2, q3] = [quantile(0.25), quantile(0.5), quantile(0.75)];

  return days.map(({ date, count }) => ({
    date,
    count,
    level: count === 0 ? 0 : count <= q1 ? 1 : count <= q2 ? 2 : count <= q3 ? 3 : 4,
  }));
}
