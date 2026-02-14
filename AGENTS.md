# CLAUDE.md

always respond in Chinese.

## 路径设置
- Python路径: `/home/chenzongwei/.conda/envs/chenzongwei311/bin/python`
- Pip路径: `/home/chenzongwei/.conda/envs/chenzongwei311/bin/pip`

## GitHub
- 每次git push之前先运行`git remote -v`查看当前仓库地址，然后再git push
- git push时使用 HTTP_PROXY=http://127.0.0.1:10808 HTTPS_PROXY=http://127.0.0.1:10808 git push设置代理
- 有关git或npm的操作，都要设置这个代理 HTTP_PROXY=http://127.0.0.1:10808 HTTPS_PROXY=http://127.0.0.1:10808
- 用户名称是`chen-001`

## Bash命令
- 上传git时,将所有更改都上传
- 写git commit message时,要详细列出更新的版本号和内容信息
- 不要主动上传git,除非我在prompt中明确要求上传git
- 不要生成markdown文件,除非我在提示词中明确要求.如果要生成一些代码说明文件,请不要单独创建一个markdown文件,而是可以在代码文件中多写些注释,或者使用ipynb文件演示.
- 创建的python测试文件或演示文件尽量精简,文件数量要精简,文件里的代码也要精简,只展示核心的功能即可,不要写的太复杂.
