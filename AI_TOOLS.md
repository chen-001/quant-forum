# AI Tool Inventory (Database Search)

Source of truth:
- Tool schemas: `src/lib/ai-function-schemas.js`
- Tool dispatcher (context rules): `src/lib/ai-tools.js`
- Database query implementations: `src/lib/ai-queries.js`

Total tools: 9

## Tools

### 1) searchPostsText
- Purpose: Search post titles and post text content by keyword.
- Args: `keyword` (required), `limit` (default 10), `contextScope` (enum: `all|current`, currently unused).
- Query function: `searchPostsText(keyword, limit)`
- Tables: `posts`, `posts_text`, `users`

### 2) getPostDetail
- Purpose: Fetch a single post with author + text content.
- Args: `postId` (required)
- Query function: `getPostDetail(postId)`
- Tables: `posts`, `posts_text`, `users`

### 3) searchCommentsText
- Purpose: Search comment text by keyword, optionally limited to a post.
- Args: `keyword` (required), `postId` (optional), `limit` (default 10), `contextScope` (enum: `all|current`, currently unused)
- Query function: `searchCommentsText(keyword, postId, limit)`
- Tables: `comments`, `comments_text`, `users`, `posts`

### 4) getPostComments
- Purpose: Fetch all comments for a post.
- Args: `postId` (required), `limit` (default 50)
- Query function: `getPostComments(postId, limit)`
- Tables: `comments`, `comments_text`, `users`

### 5) searchResultsText
- Purpose: Search results (post outcomes) by keyword, optionally limited to a post.
- Args: `keyword` (required), `postId` (optional), `limit` (default 10), `contextScope` (enum: `all|current`, currently unused)
- Query function: `searchResultsText(keyword, postId, limit)`
- Tables: `results`, `results_text`, `users`, `posts`

### 6) getPostResults
- Purpose: Fetch all results for a post.
- Args: `postId` (required), `limit` (default 50)
- Query function: `getPostResults(postId, limit)`
- Tables: `results`, `results_text`, `users`

### 7) getPostIdeas
- Purpose: Fetch the idea section for a post.
- Args: `postId` (required)
- Query function: `getPostIdeas(postId)`
- Tables: `post_ideas`, `post_ideas_text`, `users`

### 8) searchFavorites
- Purpose: Search favorites by keyword, optionally scoped to a user or content type.
- Args: `keyword` (required), `userId` (optional), `contentType` (enum: `post|comment|result|idea|text_selection|image`), `limit` (default 10), `scope` (enum: `mine|all`)
- Query function: `searchFavorites(keyword, userId, contentType, limit, scope)`
- Tables: `favorites`, `users`, `posts`

### 9) searchTodos
- Purpose: Search todos by keyword, optionally scoped to a user, content type, or completion status.
- Args: `keyword` (required), `userId` (optional), `contentType` (enum: `post|comment|result|idea|text_selection|image`), `isCompleted` (optional boolean), `limit` (default 10), `scope` (enum: `mine|all`)
- Query function: `searchTodos(keyword, userId, contentType, isCompleted, limit, scope)`
- Tables: `todos`, `users`, `posts`

Note: `searchFavorites` and `searchTodos` apply context rules in `createToolExecutor` that may override `scope` and `userId` depending on the page type.
