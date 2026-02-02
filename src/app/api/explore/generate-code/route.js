import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionFromCookies } from '@/lib/session';
import { callZenmuxAI } from '@/lib/ai-client';
import { executePythonCode } from '@/lib/code-executor';
import { getGenerateCodeFromDescriptionPrompt } from '@/lib/exploration-prompt';
import { commentExplorationQueries } from '@/lib/db';

// POST /api/explore/generate-code - 根据说明和伪代码生成代码
export async function POST(request) {
    try {
        const session = await getSessionFromCookies(await cookies());
        if (!session?.user) {
            return NextResponse.json({ error: '未登录' }, { status: 401 });
        }

        const body = await request.json();
        const { commentId, variantIndex, description, pseudocode, currentCode } = body;

        if (!description || !pseudocode) {
            return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
        }

        // 调用AI生成代码
        const prompt = getGenerateCodeFromDescriptionPrompt(description, pseudocode, currentCode);
        const response = await callZenmuxAI(prompt, []);
        let generatedCode = response.choices[0].message.content;

        // 清理代码（移除可能的markdown标记）
        const codeMatch = generatedCode.match(/```python\n?([\s\S]*?)\n?```/) ||
                         generatedCode.match(/```\n?([\s\S]*?)\n?```/) ||
                         [null, generatedCode];
        generatedCode = (codeMatch[1] || generatedCode).trim();

        // 验证生成的代码
        const testStockCode = '000001';
        const testDate = 20220819;
        let validationResult = await executePythonCode(generatedCode, testStockCode, testDate);

        // 如果执行失败，尝试修复
        let finalCode = generatedCode;
        let attempts = 0;
        const maxAttempts = 3;

        while (!validationResult.success && attempts < maxAttempts) {
            attempts++;
            console.log(`代码验证失败，尝试修复 (${attempts}/${maxAttempts}):`, validationResult.error);

            const fixPrompt = `生成的代码有错误，请修复它。

方案说明：
${description}

伪代码：
${pseudocode}

当前代码：
\`\`\`python
${finalCode}
\`\`\`

执行错误：
${validationResult.error}

错误详情：
${validationResult.traceback || '无详细错误堆栈'}

请修复代码中的错误，确保代码能够成功执行。只返回修复后的完整代码字符串（不要包含markdown标记）：`;

            const fixResponse = await callZenmuxAI(fixPrompt, []);
            let fixedCode = fixResponse.choices[0].message.content;

            // 清理代码
            const fixedCodeMatch = fixedCode.match(/```python\n?([\s\S]*?)\n?```/) ||
                                  fixedCode.match(/```\n?([\s\S]*?)\n?```/) ||
                                  [null, fixedCode];
            finalCode = (fixedCodeMatch[1] || fixedCode).trim();

            // 重新验证
            validationResult = await executePythonCode(finalCode, testStockCode, testDate);
        }

        // 如果提供了commentId和variantIndex，更新数据库
        if (commentId !== undefined && variantIndex !== undefined) {
            try {
                const exploration = commentExplorationQueries.getByCommentId(parseInt(commentId));
                if (exploration) {
                    const variants = exploration.user_modified_variants || exploration.variants;
                    if (variants[variantIndex]) {
                        variants[variantIndex] = {
                            ...variants[variantIndex],
                            code: finalCode,
                            description,
                            pseudocode
                        };

                        commentExplorationQueries.update(parseInt(commentId), {
                            userModifiedVariants: variants
                        });
                    }
                }
            } catch (dbError) {
                console.error('更新数据库失败:', dbError);
            }
        }

        return NextResponse.json({
            success: validationResult.success,
            code: finalCode,
            error: validationResult.success ? null : validationResult.error,
            validationAttempts: attempts
        });
    } catch (error) {
        console.error('生成代码失败:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
