---
title: "[Bug纪实] 使用 valgrind 跟踪 onvif库 内存泄漏"
icon: file
author: Philogag
date: 2025-04-08
category:
  - 软件开发
  - Bug纪实
tag:
  - C/C++
  - Debug
sticky: false # 置顶
star: false # 星标
footer: 
---

当前的Onvif库实现存在非常隐晦的内存泄露，又由于代码量过大无法完全review，因此需要使用valgrind进行内存泄漏的跟踪，缩小排查范围。

<!-- more -->

### 1. 交叉编译 valgrind

> valgrind 内存追踪功能基于 glibc 的 malloc 钩子，因此只支持使用 glibc 的程序，对于uclibc等其他libc实现不支持

下载源码 http://valgrind.org/
valgrind-3.24.0.tar.bz2 

tar -xf valgrind-3.24.0.tar.bz2 
cd valgrind-3.24.0

配置编译

`./configure --prefix=$PWD/../out/hi3519dv500/ --host=aarch64-v01c01-linux-gnu`

注意：
	prefix 必须为绝对路径
	host 为编译器前缀

编译并安装
make all install -j8

### 2. 调整被分析库的编译选项

valgrind 会在触发malloc等内存申请行为时会抓取当前函数栈（使用glibc的dump_stack），因此需要将库的函数符号保留
即 去除 makefile 中的 strip
另外，glibc还提供了更高等级的调试符号，能够精确到代码文件的行号，在 CXXFLAGS中添加 -ggdb3 启用此功能

当保留函数符号时，库文件可能过大，可以直接删除设备上的库，并将nfs目录下的带符号库直接软连接到原始位置

rm /app/lib/libonvif_server.so
ln -s /nfsroot/project/libonvif_server.so /app/lib/libonvif_server.so

### 3. 编写测试程序

首先，valgrind 需要测试程序正常退出（退出时崩溃也没问题，但不能使用Ctrl-C等信号进行中断退出）
其次，由于 valgrind 会对所有malloc/free/new/delete行为进行hook，非常影响程序的运行和调度速度，因此需要去除程序中的高频业务（比如视频流等）

因此需要编写一个简易demo只运行onvif基础功能并使其能够正常退出主函数
在此案例中，demo 为 onvif_test

```shell
VALGRIND_LIB=/nfsroot/embtools/app/valgrind/out/hi3519dv500/libexec/valgrind/ \
    /nfsroot/embtools/app/valgrind/out/hi3519dv500/bin/valgrind \
        --tool=memcheck \
        --leak-check=full \
        --show-leak-kinds=all \
        --undef-value-errors=no \
        --log-file=/var/app-vd.log.txt \
	      /app/bin/onvif_test
```

> 注意 valgrind 需要通过 VALGRIND_LIB 指定工具集位置
> 在编译安装位置下的 libexec/valgrind/

进行一些可能导致内存泄漏的操作后退出程序，可以另开一个telnet连接实时监控系统内存或进程使用内存
```bash
while true; do sleep 1; free | head -n 2 | tail -n 1; done # 实时监控系统整体内存
```
```bash
while true; do sleep 1; cat /proc/`pidof valgrind`/status | gr
ep VmData; done # 实时监控程序堆空间使用量
```

在测试程序退出后，valgrind 会将内存信息收集到 logfile 中

根据日志与代码配合分析后
可以清晰地确认是onvifStartStream读取了一个xml文件且没有释放
而且 valgrind 根据函数符号提供了详细的代码位置

![](./2025-04-08-find-memleak-by-valgrind_img1.png)