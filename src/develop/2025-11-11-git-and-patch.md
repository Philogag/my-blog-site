---
title: Git与Patch的使用小记
icon: file
author: Philogag
date: 2025-11-11
category:
  - 软件开发
tag:
  - 开发工具
  - Git
  - Patch
sticky: false # 置顶
star: false # 星标
footer: 
---

一些Git与Patch的常见使用场景，与对应的使用方法
<!-- more -->

## 关于Git

+ 修改commit备注    
	+ git commit --amend
+ 撤销上一个commit
	+ git reset --soft HEAD~
+ 生成 tag
	+ git tag -a -f -m "备注" "名称"

#### 快速修改多个未上库提交记录中的commit message

只修改最新一个commit
+ git commit --amend
修改倒数第n个commit
+ git rebase -i HEAD~n    # 此处n即倒数的数量
	+ 此时进入vim模式，
		+ 显示多行提交记录，
		+ 每行开头标识一个提交，pick表示需要执行的动作为保持不变
	+ 移动到需要更改的提交，进入vim编辑模式将其pick 改为 r 或 reword
	+ ESC + :wq 保存并退出该页面
	+ 自动进入vim 模式的 commit 编辑页面
	+ 修改完成后保存退出即可


## 关于 Patch

### 生成补丁

+ 基于 git 暂存区生成 patch
	+ `git diff --cached > xxx.patch`
+ 以某次提交为基准，生成某个文件夹内至今为止的改动 patch
	+ `git diff ${commit_id} -- ${path_of_dir} > xxx.patch`
+ 基于新旧文件夹比较生成 patch
	+ `diff -uparN ${dir_old} ${dir_new} > xxx.patch`


### 打补丁

1. 应用 patch 中无冲突部分并对冲突生成 rej 文件
	+ `git apply xxx.patch --reject`
2. 根据 rej 文件手动合并冲突

#### 如何在不同相对路径的情况下打补丁

假设厂家补丁以 kernel 为根路径生成补丁
补丁中的路径如下 
```bash
diff --git a/drivers/phy/phy-core.c b/drivers/phy/phy-core.c
```
若打补丁时需要将此路径映射到本仓库 chips/rk3308b/kernel/linux_src/drivers/phy/phy-core.c
    
则补丁指令为
```bash
cd chips/rk3308b/kernel/linux_src
patch -p1 < xxxx.patch
```
建议先使用--dry-run预览patch匹配结果保证能完整打入

> patch 指令可以使用 -R 参数反向卸载补丁

#### 如何借助BeondCompare找到需要生成patch的文件并借此生成patch

BeondComare
会话->文件夹比较信息-> 总结 -> 去掉勾选所有列 -> 输出选项全文本 -> 复制到剪切板

在服务器上新建 check_list.txt 并粘贴文本，保留其中的文件名
> 其中的路径还是使用的windwos分割符，需要替换成linux的
>  `sed -i 's|\\|/|g' check_list.txt`

将如下脚本保存为 diff_scan.sh 并授予执行权限
```bash
while read line
do
    if [ ! -f $1/$line ] && [ ! -f $2/$line ]; then
        continue
    fi
	
    diff -uparN $1/$line $2/$line | sed "s|--- $1|--- a|g" | sed "s|+++ $2|+++ b|g"
done
```

执行 `diff_scan.sh ${dir_old} ${dir_new} < check_list.txt > diff.patch` 即可根据check_list.txt 列表扫描生成patch