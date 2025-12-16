---
title: "[Fedora] Fedora 远程桌面设置"
icon: file
author: Philogag
date: 2025-11-29
category:
  - Fedora
tag:
  - linux
  - fedora
  - remote-desktop
sticky: false
star: true
footer: 
---

由于有远程桌面的需求，希望有一个兼容性好且少折腾的方案。但是从Fedora 43开始，默认的Gnome和Kde均只提供 Wayland，而 Wayland 生态对于远程桌面的适配一言难尽，最终还是选择更换了另一个使用X11的桌面，并使用 RustDesk 作为远程方案。

<!-- more -->

## 更换登录DM - 选用 LightDM

为了方便切换 WM，将 DM 切换为 LightDM

1. 安装
```bash
sudo rpm-ostree install lightdm lightdm-settings lightdm-gtk lightdm-gtk-greeter-settings
sudo rpm-ostree apply-live
```

::: tip
由于rpm-ostree需要重启才能看到新安装的包，这里使用apply-live使其在当前root中可见，节约一次重启
:::

2. 切换DM
```bash
sudo systemctl disable gtk
# sudo systemctl disable sddm # if you use kde
sudo systemctl enable lightdm
```

3. 重启即生效

## 安装桌面 - 选用 Cinnamon Desktop

1. 安装
```bash
sudo rpm-ostree install cinnamon cinnamon-desktop
```

2. 重启后在 LightDM 登录前切换到 Cinnamon

::: tip
系统设置 > 系统信息 中显示为 X11 即为切换成功
:::

## 安装并启用 RustDesk

1. 安装
从github下载rpm，并安装

```bash
sudo rpm-ostree install rustdesk-xxxx.x86_64.rpm
sudo rpm-ostree apply-live
```

::: tip
TODO：制作一个copr，便于自动更新rustdesk
:::

> flatpak 中的 rustdesk 不支持注册为服务，是个残次品，因此使用rpm安装

2. 启用RustDesk为服务，使其在后台开机自启
```bash
sudo systemctl enable rustdesk
sudo systemctl start rustdesk
```

3. 配置RustDesk

+ 打开 RustDesk
    + 安全 -> 设置永久密码
    + 网络 -> 配置服务器
+ 如果还搭建了 RustDeskApiServer，则再登录账号即可