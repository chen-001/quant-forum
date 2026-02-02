import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionFromCookies } from '@/lib/session';
import { commentExplorationQueries, getDb } from '@/lib/db';
import { callZenmuxAI } from '@/lib/ai-client';
import { executePythonCode } from '@/lib/code-executor';
import { getExplorationPrompt, getDefaultVariants } from '@/lib/exploration-prompt';

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
                defaultCode: exploration.default_code,
                defaultDate: exploration.default_date,
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
        // 尝试直接解析
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.variants && Array.isArray(parsed.variants) && parsed.variants.length === 3) {
                variants = parsed.variants;
            } else {
                throw new Error('AI返回格式不正确');
            }
        } else {
            throw new Error('AI返回格式不正确');
        }
    } catch (parseError) {
        console.error('解析AI响应失败:', parseError, content);
        // 返回默认方案
        return getDefaultVariants();
    }

    // 验证并修复每个方案的代码
    const validatedVariants = [];
    for (const variant of variants) {
        const validatedVariant = await validateAndFixVariant(variant, commentContent);
        if (validatedVariant) {
            validatedVariants.push(validatedVariant);
        }
    }

    return validatedVariants.length > 0 ? validatedVariants : getDefaultVariants();
}

// 验证并修复单个方案
async function validateAndFixVariant(variant, originalComment) {
    const testStockCode = '000001';
    const testDate = 20220819;

    let currentVariant = { ...variant };

    while (true) {
        // 测试执行代码
        const result = await executePythonCode(currentVariant.code, testStockCode, testDate);

        if (result.success) {
            // 代码执行成功，返回该方案
            return currentVariant;
        }

        // 代码执行失败，需要修复
        console.log(`方案"${currentVariant.name}"执行失败，错误: ${result.error}`);

        // 调用AI修复代码
        const fixedVariant = await fixVariantCode(currentVariant, result, originalComment);

        if (!fixedVariant) {
            // 修复失败，删除该方案
            console.log(`方案"${currentVariant.name}"无法修复，将被删除`);
            return null;
        }

        // 继续验证修复后的代码
        currentVariant = fixedVariant;
    }
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

请修复代码中的错误，确保：
1. 函数名必须是 calculate_factor(code, date)
2. 代码能够成功执行并返回结果（标量或时间序列）
3. 保持原有的因子计算逻辑和思路
4. 修复所有语法错误和运行时错误

请返回修复后的完整代码（只返回代码字符串，不要包含markdown标记）：`;

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


