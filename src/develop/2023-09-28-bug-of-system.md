---
title: "[Bug纪实] system()调用导致的端口无法释放"
icon: file
author: Philogag
date: 2023-09-28
category:
  - 软件开发
  - Bug纪实
tag:
  - C/C++
  - Debug
  - syscall
  - linux
sticky: false # 置顶
star: true # 星标
footer: 
---

由于system内部使用fork+exec进行实现，而fork会在创建新的pid空间时将原pid的部分信息拷贝和继承，其中最重要的就是 文件描述符fd。众所周知，socket也是文件描述符，因此在fork之后，系统实际认为某个socket fd实际被子进程拥有。因此需要对system() 接口进行额外处理。

<!-- more -->

## system() 实现原理

推荐阅读
+ [system()、exec()、fork()三个与进程有关的函数的比较 - 青儿哥哥 - 博客园 (cnblogs.com)](https://www.cnblogs.com/qingergege/p/6601807.html)
+ [系统调用之fork()用法及陷阱 - ba哥 - 博客园 (cnblogs.com)](https://www.cnblogs.com/miaoxiong/p/11050404.html)


## system() 的端口占用问题

由于system内部使用fork+exec进行实现，而fork会在创建新的pid空间时将原pid的部分信息拷贝和继承，其中最重要的就是 文件描述符fd。众所周知，socket也是文件描述符，因此在fork之后，系统实际认为某个socket fd实际被子进程拥有。

> 父进程的文件描述符由子进程继承。例如，文件的偏移量或标志的状态以及 I/O 属性将在子进程和父进程的文件描述符之间共享。因此父类的文件描述符将引用子类的相同文件描述符。

如果被system执行的cmd是马上结束的，通常不会触发这个问题，因为在cmd执行结束并退出后，fork出的进程会被销毁。

但如果执行的cmd是带 & 的后台进程，则会触发这个问题。由于执行的进程一直存在，fork出来的环境实际未被释放，主进程的fd都会被子进程fork走。当主进程close socket后，系统会认为端口由子进程所有（因为fd被fork了），实际上fd并未被完全关闭。而主进程再次绑定这个端口是，由于设置了 REUSEADDR，绑定本身不会失败，但产生了端口复用，TCP链接可能被旧的fd抢走导致通信失败。

+ **经测试这个问题仅在TCP下出现**

以下提供了一个demo可以复现这个问题

> 使用方法 ./test1 ./test2 &
> 使用 test1 调起test2 并将 test1 挂后台
> 此时通过netstat检查端口即可发现9999同时被test1和test2监听

```cpp
// test1.cpp

#include <asm-generic/socket.h>
#include <csignal>
#include <netinet/in.h>
#include <sys/socket.h>
#include <fcntl.h>
#include <fcntl.h>
#include <dirent.h>
#include <cstring>
#include <cstdio>
#include <cstdlib>

bool call_exit = false;
int  fd        = -1;

void on_signal(int sig) {
    call_exit = true;
    close(fd);
}

void create_socket(int port) {

    fd = socket(AF_INET, SOCK_STREAM, 0);
    if (fd < 0) {
        perror("create socket failed");
        return;
    }

    struct sockaddr_in sin = {};
    sin.sin_family         = AF_INET;
    sin.sin_addr.s_addr    = htonl(INADDR_ANY);
    sin.sin_port           = htons(port);

    int opt = 1;
    if (0 != setsockopt(fd, SOL_SOCKET, SO_REUSEPORT, &opt, sizeof(opt))) {
        perror("setsockopt SO_REUSEADDR failed\n");
        goto CLOSE;
    }

    if (0 != bind(fd, (struct sockaddr *)(&sin), sizeof(sin))) {
        perror("bind failed\n");
        goto CLOSE;
    }

    if (0 != listen(fd, 64)) {
        perror("listen failed\n");
        goto CLOSE;
    }

    printf("socket fd %d\n", fd);
    return;
CLOSE:
    close(fd);
    return;
}

int main(int argc, const char **argv) {

    printf("%s start\n", argv[0]);
    signal(SIGINT, on_signal);

    create_socket(9999);
    sleep(1);

    char cmd[128] = {};
    sprintf(cmd, "%s &", argv[1]);
    system(cmd);

    printf("close fd!\n");
    close(fd);
    create_socket(9999);

    while (!call_exit) {
        sleep(1);
    }

    printf("%s stop\n", argv[0]);
    return 0;
}
```
```cpp
// test2.cpp
#include <asm-generic/socket.h>
#include <csignal>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <netinet/in.h>
#include <sys/socket.h>
#include <unistd.h>

bool call_exit = false;

void on_signal(int sig) {
    call_exit = true;
}

int main(int argc, const char ** argv) {

    printf("%s start\n", argv[0]);
    signal(SIGINT, on_signal);

    while (!call_exit) {
        sleep(1);
    }

    printf("%s stop\n", argv[0]);
    return 0;
}
```

#### 解决方案

1. 专门编写一个进程，用于专门进行system()调用，所有system()调用均通过rpc发送给这个进程执行
	+ 这个做法比较简单，但是比较脏，需要额外的进程辅助
2. 通过 fnctl 设置主进程的 fd 为 FD_CLOEXEC 使其在exec时自动关闭
	+ 需要有方法获取本进程所有的fd，可以通过遍历 /proc/self/fd/
	+ FD 0/1/2 时stdin/stdout/stderr，不应该被close
	+ 以下提供了一个demo
```cpp
int better_system(const char *cmd) {
    // 将本进程所有的fd标记为不被fork，避免端口被夺取
    DIR* dir = opendir("/proc/self/fd/");
    if (dir) {
        struct dirent *ptr = nullptr;
        while ((ptr = readdir(dir)) != nullptr) {
            if (strcmp(ptr->d_name, ".") == 0 || strcmp(ptr->d_name, "..") == 0 || strcmp(ptr->d_name, "0") == 0 ||
                strcmp(ptr->d_name, "1") == 0 || strcmp(ptr->d_name, "2") == 0) {
                continue;
            }
            int __fd = 0;
            sscanf(ptr->d_name, "%d", &__fd);
            fcntl(fd, F_SETFD, FD_CLOEXEC);
            closedir(dir);
        }
    }

    return system(cmd);
}
```

#### 参考文献

+ [关于glibc的system函数调用实现_glibc system-CSDN博客](https://blog.csdn.net/u010039418/article/details/77017689)
+ [系统调用之fork()用法及陷阱 - ba哥 - 博客园 (cnblogs.com)](https://www.cnblogs.com/miaoxiong/p/11050404.html)
+ [linux如何让子进程不继承父进程的端口-CSDN社区](https://bbs.csdn.net/topics/390496123)
+ [linux系统C/C++实现遍历指定目录_c++ linux 遍历文件夹-CSDN博客](https://blog.csdn.net/leacock1991/article/details/111086031)
