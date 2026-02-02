import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionFromCookies } from '@/lib/session';
import { commentExplorationQueries, getDb } from '@/lib/db';
import { callZenmuxAI } from '@/lib/ai-client';
import { executePythonCode } from '@/lib/code-executor';
import { getExplorationPrompt } from '@/lib/exploration-prompt';

// GET /api/explore?commentId=xxx - 获取探索方案
export async function GET(request) {
    try {
        const session = await getSessionFromCookies(await cookies());
        if (!session?.user) {
            return NextResponse.json({ error: '未登录' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const commentId = searchParams.get('commentId');

        if (!commentId) {
            return NextResponse.json({ error: '缺少commentId参数' }, { status: 400 });
        }

        // 先查数据库
        const exploration = commentExplorationQueries.getByCommentId(parseInt(commentId));

        if (exploration) {
            return NextResponse.json({
                variants: exploration.user_modified_variants || exploration.variants,
                originalVariants: exploration.variants,
                defaultCode: exploration.last_stock_code || exploration.default_code,
                defaultDate: exploration.last_date || exploration.default_date,
                executionResults: exploration.execution_results || {},
                lastExecutedVariant: exploration.last_executed_variant,
                isGenerated: true
            });
        }

        // 如果没有记录，返回未生成状态
        return NextResponse.json({
            isGenerated: false,
            defaultCode: '000001',
            defaultDate: 20220819
        });
    } catch (error) {
        console.error('获取探索方案失败:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST /api/explore - 生成探索方案
export async function POST(request) {
    try {
        const session = await getSessionFromCookies(await cookies());
        if (!session?.user) {
            return NextResponse.json({ error: '未登录' }, { status: 401 });
        }

        const body = await request.json();
        const { commentId, textContent, imageBase64List } = body;

        if (!commentId) {
            return NextResponse.json({ error: '缺少commentId参数' }, { status: 400 });
        }

        // 验证评论是否存在
        const db = getDb();
        const commentStmt = db.prepare('SELECT id, content FROM comments WHERE id = ?');
        const comment = commentStmt.get(commentId);

        if (!comment) {
            return NextResponse.json({ error: '评论不存在' }, { status: 404 });
        }

        // 使用传入的内容或从数据库获取
        const finalTextContent = textContent || comment.content || '';
        const finalImageList = imageBase64List || [];

        if (!finalTextContent.trim() && finalImageList.length === 0) {
            return NextResponse.json({ error: '评论内容为空，无法生成探索方案' }, { status: 400 });
        }

        // 调用AI生成3种方案
        const variants = await generateExplorationVariants(finalTextContent, finalImageList);

        // 保存到数据库
        commentExplorationQueries.create(commentId, variants, '000001', 20220819);

        return NextResponse.json({
            variants,
            defaultCode: '000001',
            defaultDate: 20220819,
            isGenerated: true
        });
    } catch (error) {
        console.error('生成探索方案失败:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// 调用AI生成探索方案
async function generateExplorationVariants(commentContent, imageBase64List = []) {
    const prompt = getExplorationPrompt(commentContent, false);

    const response = await callZenmuxAI(prompt, imageBase64List);
    const content = response.choices[0].message.content;

    // 解析JSON响应
    let variants;
    try {
        // 尝试提取JSON代码块
        const codeBlockMatch = content.match(/```json\n?([\s\S]*?)\n?```/);
        const jsonContent = codeBlockMatch ? codeBlockMatch[1] : content;
        
        // 尝试直接解析
        const parsed = JSON.parse(jsonContent);
        if (parsed.variants && Array.isArray(parsed.variants) && parsed.variants.length === 3) {
            variants = parsed.variants;
        } else {
            throw new Error('AI返回格式不正确');
        }
    } catch (parseError) {
        console.error('解析AI响应失败:', parseError, content);
        // 尝试使用正则提取JSON对象（非贪婪匹配）
        try {
            const jsonMatch = content.match(/\{[\s\S]*?"variants"[\s\S]*?\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                if (parsed.variants && Array.isArray(parsed.variants) && parsed.variants.length === 3) {
                    variants = parsed.variants;
                } else {
                    throw new Error('AI返回格式不正确');
                }
            } else {
                throw new Error('无法提取JSON');
            }
        } catch (secondError) {
            console.error('二次解析也失败:', secondError);
            // 不再返回默认方案，而是抛出错误让上层处理
            throw new Error('AI响应解析失败: ' + parseError.message);
        }
    }

    // 验证并修复每个方案的代码
    const validatedVariants = [];
    for (const variant of variants) {
        const validatedVariant = await validateAndFixVariant(variant, commentContent);
        if (validatedVariant) {
            validatedVariants.push(validatedVariant);
        }
    }

    // 返回验证后的方案，如果都失败则返回原始AI方案（不使用默认示例）
    return validatedVariants.length > 0 ? validatedVariants : variants;
}

// 验证并修复单个方案
async function validateAndFixVariant(variant, originalComment) {
    const testStockCode = '000001';
    const testDate = 20220819;
    const maxRetries = 10; // 最大重试次数

    let currentVariant = { ...variant };
    let retryCount = 0;

    while (retryCount < maxRetries) {
        // 测试执行代码
        const result = await executePythonCode(currentVariant.code, testStockCode, testDate);

        if (result.success) {
            // 代码执行成功，返回该方案
            console.log(`方案"${currentVariant.name}"验证成功（尝试${retryCount + 1}次）`);
            return currentVariant;
        }

        // 代码执行失败，需要修复
        retryCount++;
        console.log(`方案"${currentVariant.name}"执行失败（第${retryCount}次），错误: ${result.error}`);

        // 调用AI修复代码
        const fixedVariant = await fixVariantCode(currentVariant, result, originalComment);

        if (!fixedVariant) {
            // AI修复调用失败，但继续保留当前代码进行下一次尝试
            console.log(`方案"${currentVariant.name}"AI修复调用失败，保留当前代码`);
            break;
        }

        // 继续验证修复后的代码
        currentVariant = fixedVariant;
    }

    // 达到最大重试次数或修复调用失败，返回最后一次的代码（保留原始AI逻辑）
    if (retryCount >= maxRetries) {
        console.log(`方案"${currentVariant.name}"达到最大重试次数(${maxRetries})，返回最后一次修复结果`);
    }
    return currentVariant;
}

// 调用AI修复代码
async function fixVariantCode(variant, errorResult, originalComment) {
    const fixPrompt = `你是一位专业的量化研究员。之前生成的代码有错误，请修复它。

原始因子描述：
${originalComment}

方案名称：${variant.name}
方案描述：${variant.description}

当前代码：
\`\`\`python
${variant.code}
\`\`\`

执行错误信息：
${errorResult.error}

错误详情：
${errorResult.traceback || '无详细错误堆栈'}

=== 数据读取函数说明 ===

1. 读取逐笔成交数据：
\`\`\`python
def read_trade(symbol:str, date:int, with_retreat:int=0)->pd.DataFrame:
    file_name = "%s_%d_%s.csv" % (symbol, date, "transaction")
    file_path = os.path.join("/ssd_data/stock", str(date), "transaction", file_name)
    df= pd.read_csv(
        file_path,
        dtype={"symbol": str},
        usecols=[
            "exchtime",
            "price",
            "volume",
            "turnover",
            "flag",
            "index",
            "localtime",
            "ask_order",
            "bid_order",
        ],
        memory_map=True,
        engine="c",
        low_memory=False,
    )
    if not with_retreat:
        df=df[df.flag!=32]
    df.exchtime=pd.to_timedelta(df.exchtime/1e6,unit='s')+pd.Timestamp('1970-01-01 08:00:00')
    return df

# 参数说明：
# - symbol: 股票代码，格式为字符串，如 '000001', '600000'
# - date: 交易日期，格式为整数，如 20220819
# - with_retreat: 是否包含撤单(32)，默认0表示排除撤单
# - flag字段: 66=主买, 83=主卖, 32=撤单
\`\`\`

2. 读取盘口快照数据：
\`\`\`python
def read_market(symbol:str, date:int)->pd.DataFrame:
    file_name = "%s_%d_%s.csv" % (symbol, date, "market_data")
    file_path = os.path.join("/ssd_data/stock", str(date), "market_data", file_name)
    df= pd.read_csv(
        file_path,
        dtype={"symbol": str},
        memory_map=True,
        engine="c",
        low_memory=False,
    )
    df.exchtime=pd.to_timedelta(df.exchtime/1e6,unit='s')+pd.Timestamp('1970-01-01 08:00:00')
    return df

# 参数说明：
# - symbol: 股票代码，格式为字符串，如 '000001', '600000'
# - date: 交易日期，格式为整数，如 20220819
# - 字段包括: last_prc(最新价), bid_prc1-10(买价1-10档), ask_prc1-10(卖价1-10档), bid_vol1-10(买量), ask_vol1-10(卖量)
\`\`\`

=== 修复要求 ===
1. 函数名必须是 calculate_factor(code, date)
2. 函数必须返回一个元组 tuple: (factor_dict, key_variables_dict)
   - factor_dict: {因子名: 因子值}，因子值可以是标量(float/int)或时间序列(pd.Series)
   - key_variables_dict: {变量名: 变量值}，用于展示中间计算过程
3. 代码必须包含具体的因子计算逻辑，不能只是占位符
4. 保持原有的因子计算逻辑和思路，只修复导致错误的代码
5. 修复所有语法错误和运行时错误
6. 可以使用numpy, pandas, scipy, sklearn等常用库

请返回修复后的完整Python代码字符串（不要包含markdown代码块标记）：`;

    try {
        const response = await callZenmuxAI(fixPrompt, []);
        const fixedCode = response.choices[0].message.content;

        // 清理代码（移除可能的markdown标记）
        const codeMatch = fixedCode.match(/```python\n?([\s\S]*?)\n?```/) ||
                         fixedCode.match(/```\n?([\s\S]*?)\n?```/) ||
                         [null, fixedCode];
        const cleanCode = codeMatch[1] || fixedCode;

        return {
            ...variant,
            code: cleanCode.trim()
        };
    } catch (error) {
        console.error('调用AI修复代码失败:', error);
        return null;
    }
}


