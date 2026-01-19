import * as queries from './ai-queries.js';

/**
 * AI工具执行器
 * 实现上下文感知的工具调用逻辑
 */

/**
 * 上下文配置
 * 定义不同页面类型下的工具行为
 */
const CONTEXT_RULES = {
  home: {
    name: '首页',
    canSearchAll: true,
    autoLimitPostId: false,
    autoLimitUserId: false
  },
  post_detail: {
    name: '帖子详情',
    canSearchAll: false,
    autoLimitPostId: true,
    autoLimitUserId: false
  },
  favorites_mine: {
    name: '个人收藏',
    canSearchAll: false,
    autoLimitPostId: false,
    autoLimitUserId: true,
    userIdScope: 'mine'
  },
  favorites_all: {
    name: '大家收藏',
    canSearchAll: false,
    autoLimitPostId: false,
    autoLimitUserId: false,
    userIdScope: 'all'
  },
  todos_mine: {
    name: '个人待办',
    canSearchAll: false,
    autoLimitPostId: false,
    autoLimitUserId: true,
    userIdScope: 'mine'
  },
  todos_all: {
    name: '大家待办',
    canSearchAll: false,
    autoLimitPostId: false,
    autoLimitUserId: false,
    userIdScope: 'all'
  }
};

/**
 * 创建上下文感知的工具执行器
 * @param {string} pageType - 页面类型
 * @param {number} contextId - 上下文ID（如帖子ID）
 * @param {number} userId - 当前用户ID
 * @returns {Function} 工具执行函数
 */
export function createToolExecutor(pageType, contextId = null, userId = null) {
  const rules = CONTEXT_RULES[pageType] || CONTEXT_RULES.home;

  return function executeTool(toolName, args) {
    switch (toolName) {
      // ==================== 帖子相关工具 ====================
      case 'searchPostsText':
        return queries.searchPostsText(
          args.keyword,
          args.limit || 10
        );

      case 'getPostDetail':
        return queries.getPostDetail(args.postId);

      // ==================== 评论相关工具 ====================
      case 'searchCommentsText': {
        let postId = args.postId;
        // 在帖子详情页，自动限制为当前帖子
        if (rules.autoLimitPostId && contextId) {
          postId = contextId;
        }
        return queries.searchCommentsText(
          args.keyword,
          postId,
          args.limit || 10
        );
      }

      case 'getPostComments':
        return queries.getPostComments(args.postId, args.limit || 50);

      // ==================== 成果相关工具 ====================
      case 'searchResultsText': {
        let postId = args.postId;
        if (rules.autoLimitPostId && contextId) {
          postId = contextId;
        }
        return queries.searchResultsText(
          args.keyword,
          postId,
          args.limit || 10
        );
      }

      case 'getPostResults':
        return queries.getPostResults(args.postId, args.limit || 50);

      // ==================== 想法区工具 ====================
      case 'getPostIdeas':
        return queries.getPostIdeas(args.postId);

      // ==================== 收藏工具 ====================
      case 'searchFavorites': {
        let queryUserId = args.userId;
        let scope = args.scope || 'all';

        // 应用页面级别的用户限制
        if (rules.userIdScope) {
          scope = rules.userIdScope;
          if (rules.autoLimitUserId && userId) {
            queryUserId = userId;
          }
        }

        return queries.searchFavorites(
          args.keyword,
          queryUserId,
          args.contentType || null,
          args.limit || 10,
          scope
        );
      }

      // ==================== 待办工具 ====================
      case 'searchTodos': {
        let queryUserId = args.userId;
        let scope = args.scope || 'all';

        // 应用页面级别的用户限制
        if (rules.userIdScope) {
          scope = rules.userIdScope;
          if (rules.autoLimitUserId && userId) {
            queryUserId = userId;
          }
        }

        return queries.searchTodos(
          args.keyword,
          queryUserId,
          args.contentType || null,
          args.isCompleted ?? null,
          args.limit || 10,
          scope
        );
      }

      // ==================== 通用 SQL 查询工具 ====================
      case 'executeSqlQuery':
        return queries.executeSqlQuery(
          args.sql,
          args.params || [],
          args.maxRows || 100
        );

      case 'getDatabaseSchema':
        return queries.getDatabaseSchema();

      case 'getTableColumns':
        return queries.getTableColumns(args.tableName);

      default:
        throw new Error(`未知工具: ${toolName}`);
    }
  };
}

/**
 * 获取当前上下文的说明文字
 * @param {string} pageType - 页面类型
 * @param {number} contextId - 上下文ID
 * @returns {string} 上下文说明
 */
export function getContextDescription(pageType, contextId = null) {
  const rules = CONTEXT_RULES[pageType];
  let desc = `当前在${rules.name}页面。`;

  if (rules.autoLimitPostId && contextId) {
    desc += `查询将自动限制在帖子${contextId}的相关内容。`;
  }

  if (rules.autoLimitUserId) {
    desc += `查询将自动限制为当前用户的内容。`;
  }

  if (rules.userIdScope === 'all') {
    desc += `查询范围包括所有用户的公开内容。`;
  }

  return desc;
}
