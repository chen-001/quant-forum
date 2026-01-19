/**
 * Function Calling 工具定义
 * 智谱AI GLM-4.7可调用的工具函数Schema
 */

export const AI_FUNCTION_SCHEMAS = [
  {
    type: 'function',
    function: {
      name: 'searchPostsText',
      description: '搜索帖子内容，根据关键词查找相关帖子',
      parameters: {
        type: 'object',
        properties: {
          keyword: {
            type: 'string',
            description: '搜索关键词'
          },
          limit: {
            type: 'number',
            description: '返回结果数量限制',
            default: 10
          },
          contextScope: {
            type: 'string',
            description: '上下文范围限制（仅在特定页面有效）',
            enum: ['all', 'current']
          }
        },
        required: ['keyword']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getPostDetail',
      description: '获取指定帖子的详细信息',
      parameters: {
        type: 'object',
        properties: {
          postId: {
            type: 'number',
            description: '帖子ID'
          }
        },
        required: ['postId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'searchCommentsText',
      description: '搜索评论内容，根据关键词查找相关评论',
      parameters: {
        type: 'object',
        properties: {
          keyword: {
            type: 'string',
            description: '搜索关键词'
          },
          postId: {
            type: 'number',
            description: '限制在指定帖子的评论中搜索（可选）'
          },
          limit: {
            type: 'number',
            description: '返回结果数量限制',
            default: 10
          },
          contextScope: {
            type: 'string',
            description: '上下文范围限制',
            enum: ['all', 'current']
          }
        },
        required: ['keyword']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getPostComments',
      description: '获取指定帖子的所有评论',
      parameters: {
        type: 'object',
        properties: {
          postId: {
            type: 'number',
            description: '帖子ID'
          },
          limit: {
            type: 'number',
            description: '返回结果数量限制',
            default: 50
          }
        },
        required: ['postId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'searchResultsText',
      description: '搜索成果记录内容，根据关键词查找相关成果',
      parameters: {
        type: 'object',
        properties: {
          keyword: {
            type: 'string',
            description: '搜索关键词'
          },
          postId: {
            type: 'number',
            description: '限制在指定帖子的成果中搜索（可选）'
          },
          limit: {
            type: 'number',
            description: '返回结果数量限制',
            default: 10
          },
          contextScope: {
            type: 'string',
            description: '上下文范围限制',
            enum: ['all', 'current']
          }
        },
        required: ['keyword']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getPostResults',
      description: '获取指定帖子的所有成果记录',
      parameters: {
        type: 'object',
        properties: {
          postId: {
            type: 'number',
            description: '帖子ID'
          },
          limit: {
            type: 'number',
            description: '返回结果数量限制',
            default: 50
          }
        },
        required: ['postId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getPostIdeas',
      description: '获取指定帖子想法区的内容',
      parameters: {
        type: 'object',
        properties: {
          postId: {
            type: 'number',
            description: '帖子ID'
          }
        },
        required: ['postId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'searchFavorites',
      description: '搜索收藏内容，根据关键词查找收藏的项目',
      parameters: {
        type: 'object',
        properties: {
          keyword: {
            type: 'string',
            description: '搜索关键词'
          },
          userId: {
            type: 'number',
            description: '限制在指定用户的收藏中搜索（可选）'
          },
          contentType: {
            type: 'string',
            description: '内容类型筛选',
            enum: ['post', 'comment', 'result', 'idea', 'text_selection', 'image']
          },
          limit: {
            type: 'number',
            description: '返回结果数量限制',
            default: 10
          },
          scope: {
            type: 'string',
            description: '查询范围',
            enum: ['mine', 'all']
          }
        },
        required: ['keyword']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'searchTodos',
      description: '搜索待办内容，根据关键词查找待办项目',
      parameters: {
        type: 'object',
        properties: {
          keyword: {
            type: 'string',
            description: '搜索关键词'
          },
          userId: {
            type: 'number',
            description: '限制在指定用户的待办中搜索（可选）'
          },
          contentType: {
            type: 'string',
            description: '内容类型筛选',
            enum: ['post', 'comment', 'result', 'idea', 'text_selection', 'image']
          },
          isCompleted: {
            type: 'boolean',
            description: '是否已完成'
          },
          limit: {
            type: 'number',
            description: '返回结果数量限制',
            default: 10
          },
          scope: {
            type: 'string',
            description: '查询范围',
            enum: ['mine', 'all']
          }
        },
        required: ['keyword']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'executeSqlQuery',
      description: '执行通用的只读 SQL 查询（仅支持 SELECT 语句，有安全限制）',
      parameters: {
        type: 'object',
        properties: {
          sql: {
            type: 'string',
            description: 'SQL 查询语句，必须是 SELECT 开头'
          },
          params: {
            type: 'array',
            description: 'SQL 参数数组（用于防止 SQL 注入）',
            items: {
              type: 'string'
            }
          },
          maxRows: {
            type: 'number',
            description: '最大返回行数（默认 100，最大 100）',
            default: 100
          }
        },
        required: ['sql']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getDatabaseSchema',
      description: '获取数据库中所有表的结构信息（表名和创建语句）',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getTableColumns',
      description: '获取指定表的列信息（列名、数据类型、是否可空等）',
      parameters: {
        type: 'object',
        properties: {
          tableName: {
            type: 'string',
            description: '表名'
          }
        },
        required: ['tableName']
      }
    }
  }
];
