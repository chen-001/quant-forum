#!/usr/bin/env python3
"""
OCR图片文字识别处理脚本
使用智谱AI glm-4v-flash API进行图片文字识别
"""

import sys
import json
import re
import os
import base64
from pathlib import Path
from zhipuai import ZhipuAI

# API配置
API_KEY = os.getenv('ZHIPUAI_API_KEY', 'b9c5c31255e34d4aa059a3ee09291628.h0YgPRCvaFqsUjhh')
client = ZhipuAI(api_key=API_KEY)


def extract_images_from_markdown(content):
    """从Markdown内容中提取所有图片URL"""
    pattern = r'!\[.*?\]\((/uploads/[^)]+)\)'
    return re.findall(pattern, content)


def ocr_single_image(image_path):
    """对单张图片进行OCR识别"""
    full_path = Path.cwd() / 'public' / image_path.lstrip('/')
    if not full_path.exists():
        full_path = Path(image_path)

    if not full_path.exists():
        return {'success': False, 'error': f'图片文件不存在: {image_path}'}

    try:
        # 读取图片并转换为base64
        with open(full_path, 'rb') as f:
            image_data = base64.b64encode(f.read()).decode('utf-8')

        response = client.chat.completions.create(
            model='glm-4v-flash',
            messages=[
                {
                    'role': 'user',
                    'content': [
                        {
                            'type': 'image_url',
                            'image_url': {
                                'url': f'data:image/jpeg;base64,{image_data}'
                            }
                        },
                        {'type': 'text', 'text': '请识别图片中的所有文字内容，按原样输出，保留段落结构。如果图片中没有文字，请返回"[无文字]"。'}
                    ]
                }
            ]
        )
        text = response.choices[0].message.content.strip()
        if text == '[无文字]':
            text = ''
        return {'success': True, 'text': text}
    except Exception as e:
        return {'success': False, 'error': str(e)}


def process_content(content_json_str, project_path):
    """处理包含图片的内容，返回替换后的纯文字版"""
    # 解析内容
    try:
        content_data = json.loads(content_json_str)
        content = content_data.get('content', '')
    except:
        # JSON解析失败，尝试修复shell转义问题
        content_json_fixed = content_json_str.replace('\\!', '!')
        try:
            content_data = json.loads(content_json_fixed)
            content = content_data.get('content', '')
        except:
            content = content_json_str

    images = extract_images_from_markdown(content)
    if not images:
        return {'success': True, 'processed_content': content, 'images_count': 0}

    processed_content = content
    results = []

    for image_url in images:
        result = ocr_single_image(image_url)
        ocr_text = result.get('text', '') if result['success'] else ''

        # 替换图片为OCR文字
        img_pattern = r'!\[.*?\]\(' + re.escape(image_url) + r'\)'
        if ocr_text:
            processed_content = re.sub(img_pattern, ocr_text, processed_content)
        else:
            processed_content = re.sub(img_pattern, '[图片识别失败]', processed_content)

        results.append({
            'image': image_url,
            'success': result['success'],
            'text': ocr_text,
            'error': result.get('error')
        })

    return {
        'success': True,
        'processed_content': processed_content,
        'images_count': len(images),
        'results': results
    }


def main():
    if len(sys.argv) < 2:
        print(json.dumps({'error': '用法: python ocr_processor.py <process|single> <args...>'}))
        sys.exit(1)

    command = sys.argv[1]

    if command == 'process':
        if len(sys.argv) < 4:
            print(json.dumps({'error': '用法: python ocr_processor.py process <content_json> <project_path>'}))
            sys.exit(1)
        content_json = sys.argv[2]
        project_path = sys.argv[3]
        os.chdir(project_path)
        result = process_content(content_json, project_path)

    elif command == 'single':
        if len(sys.argv) < 3:
            print(json.dumps({'error': '用法: python ocr_processor.py single <image_path>'}))
            sys.exit(1)
        image_path = sys.argv[2]
        result = ocr_single_image(image_path)

    else:
        result = {'error': f'未知命令: {command}'}

    print(json.dumps(result, ensure_ascii=False))
    sys.exit(0 if result.get('success', False) else 1)


if __name__ == '__main__':
    main()
