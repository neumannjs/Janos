# Webmentions in Janos

Webmentions are a W3C recommendation for cross-site interactions on the IndieWeb. When someone links to, likes, reposts, or replies to your content, a webmention notifies your site of that interaction.

Janos includes a webmentions plugin that fetches webmentions from a compatible API and adds them to your page metadata, making them available in templates.

## Quick Start

1. Register your site with [webmention.io](https://webmention.io/) (free hosted service)
2. Add the webmention endpoint to your site's `<head>`:
   ```html
   <link rel="webmention" href="https://webmention.io/yourdomain.com/webmention">
   ```
3. Add the webmentions plugin to your `janos.config.json`:
   ```json
   {
     "pipeline": [
       "markdown",
       "webmentions",
       { "layouts": { "directory": "_layouts" } }
     ]
   }
   ```
4. Include the webmentions template in your post layout

## Configuration Options

The webmentions plugin supports the following options:

```json
{
  "webmentions": {
    "endpoint": "https://webmention.io/api",
    "cacheDir": "cache",
    "perPage": 10000
  }
}
```

### Options Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `endpoint` | string | `https://webmention.io/api` | Webmention API endpoint URL |
| `baseUrl` | string | (from site.baseUrl) | Site base URL for target URL construction |
| `cacheDir` | string | `cache` | Directory for caching webmentions |
| `perPage` | integer | `10000` | Number of mentions to fetch per request |

### Using a Custom Endpoint

If you're using a self-hosted webmention service like [go-jamming](https://git.brainbaking.com/wgroeneveld/go-jamming) or [webmention.app](https://webmention.app/), configure the endpoint:

```json
{
  "webmentions": {
    "endpoint": "https://jam.example.com/api"
  }
}
```

The API must be compatible with webmention.io's JF2 format:
- `GET /mentions.jf2?target={url}&per-page={count}&since_id={id}`
- Returns `{ "children": [...webmentions] }`

## Template Usage

The webmentions plugin adds a `webmentions` object to each content file's metadata:

```javascript
{
  webmentions: {
    children: [...],        // Array of Webmention objects
    'like-count': 5,        // Number of likes
    'reply-count': 2,       // Number of replies
    'repost-count': 1,      // Number of reposts
    lastWmId: 12345         // Last webmention ID (for caching)
  }
}
```

### Webmention Object Structure

Each webmention in `children` follows the [JF2 format](https://www.w3.org/TR/jf2/):

```javascript
{
  'wm-id': 12345,                    // Unique ID
  'wm-source': 'https://...',        // Source URL
  'wm-target': 'https://...',        // Your page URL
  'wm-property': 'like-of',          // Type: like-of, repost-of, in-reply-to, mention-of, bookmark-of
  'wm-received': '2024-01-15T...',   // When received
  author: {
    name: 'Jane Doe',
    photo: 'https://...',
    url: 'https://...'
  },
  content: {                         // For replies
    text: 'Plain text content',
    html: '<p>HTML content</p>'
  },
  published: '2024-01-15T...',
  url: 'https://...'                 // Canonical URL of the mention
}
```

### Example Template (Nunjucks)

Basic usage in a post template:

```nunjucks
{% if webmentions and webmentions.children.length > 0 %}
<section class="webmentions">
  <h2>Responses</h2>

  {# Display like count #}
  {% if webmentions['like-count'] > 0 %}
    <p>{{ webmentions['like-count'] }} likes</p>
  {% endif %}

  {# Display replies #}
  {% for reply in webmentions.children %}
    {% if reply['wm-property'] == 'in-reply-to' %}
    <article class="reply">
      <img src="{{ reply.author.photo }}" alt="{{ reply.author.name }}">
      <a href="{{ reply.author.url }}">{{ reply.author.name }}</a>
      <p>{{ reply.content.text }}</p>
    </article>
    {% endif %}
  {% endfor %}
</section>
{% endif %}
```

### Pre-built Templates

Janos includes pre-built webmention templates in `packages/core/src/pipeline/examples/templates/`:

- `webmentions.njk` - Full webmention display with likes, reposts, replies, mentions
- `webmentions.css` - Responsive styles with CSS custom properties for theming

Copy these to your `_layouts/partials/` directory and include them:

```nunjucks
{% include "partials/webmentions.njk" %}
```

The templates include:
- **Likes**: Avatar grid showing who liked your post
- **Reposts**: Avatar grid showing who reposted
- **Replies**: Threaded comments with author info and content
- **Mentions**: List of pages that linked to your content
- **Bookmarks**: Who bookmarked your page

## Webmention Counts in Post Metadata

Display webmention counts alongside post metadata (date, read time, etc.):

```nunjucks
<div class="post-meta">
  <time>{{ date | date("MMMM D, YYYY") }}</time>
  {% if webmentions['like-count'] > 0 %}
    <span>{{ webmentions['like-count'] }} likes</span>
  {% endif %}
  {% if webmentions['reply-count'] > 0 %}
    <span>{{ webmentions['reply-count'] }} replies</span>
  {% endif %}
</div>
```

## Caching

Webmentions are cached to avoid repeated API calls. The cache stores:
- All previously fetched webmentions
- The ID of the last webmention (for incremental fetches)

Cache files are stored at: `{cacheDir}/{permalink}/webmentions.json`

To bust the cache, delete the cache directory or individual cache files.

## Self-Hosting Webmentions

For full control, you can self-host a webmention receiver:

### Option 1: go-jamming

[go-jamming](https://git.brainbaking.com/wgroeneveld/go-jamming) is a Go-based webmention receiver that's compatible with webmention.io's API.

```json
{
  "webmentions": {
    "endpoint": "https://jam.yourdomain.com/api"
  }
}
```

### Option 2: Cloudflare Workers + D1

You can build a simple webmention receiver using Cloudflare Workers and D1 (SQLite):

1. Create a Worker that accepts webmentions
2. Store them in D1
3. Expose a `/mentions.jf2` endpoint compatible with webmention.io

### Option 3: webmention.app

[webmention.app](https://webmention.app/) is another hosted option with a compatible API.

## Sending Webmentions

Janos currently focuses on **receiving** webmentions. To send webmentions when you publish new content that links to other sites:

- Use [webmention.app](https://webmention.app/) to send webmentions
- Use [Telegraph](https://telegraph.p3k.io/) for manual sending
- Implement webmention sending in a CI/CD pipeline

## Troubleshooting

### No webmentions appearing

1. Check that your site is registered with webmention.io
2. Verify the `<link rel="webmention">` is in your `<head>`
3. Ensure `site.baseUrl` is set correctly in your config
4. Check that the page has both `layout` and `collection` metadata

### API errors

The plugin handles API errors gracefully - your build won't fail if the webmention service is unavailable. Check the console for warning messages.

### Wrong URLs being queried

The plugin uses `permalink` if set, otherwise constructs URLs from file paths. Ensure permalinks match your actual published URLs.

## Further Reading

- [Webmention W3C Recommendation](https://www.w3.org/TR/webmention/)
- [IndieWeb Webmention](https://indieweb.org/Webmention)
- [webmention.io Documentation](https://webmention.io/)
- [JF2 Format](https://www.w3.org/TR/jf2/)
