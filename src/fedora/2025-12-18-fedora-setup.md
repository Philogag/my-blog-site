---
title: "Fedora 初始化"
icon: file
author: Philogag
date: 2025-12-18
category:
  - Fedora
tag:
  - linux
  - fedora
  - nvidia
sticky: false
star: true
footer: 
---

全新安装 Fedora 的基础配置过程
包括：
1. 安装系统 
2. 安装基础工具 
3. 配置自动快照 
4. 安装 Nvidia 驱动
5. 配置输入法

<!-- more -->

## Step0. 安装系统

下载 NetInstall 镜像并扔进 [Ventory](https://www.ventoy.net/cn/download.html)。
引导并进入安装界面

### 1. 配置安装分区

进入 “安装目标位置”
选择目标磁盘

> 我有块固态硬盘，一般我使用500G的盘整块作为根文件系统，其他盘作为数据盘

存储配置选择自定义，方便微调安装
而后点击完成进入分区界面

点击 "点击这里自动创建它们" 来获得一个默认的推荐分区表
添加一个子卷给 /var: 点击加号，并选择挂载点为 /var, 期望容量留空即可
点击完成即可

### 2. 配置桌面

进入 “软件选择”
选择一个心仪的 Desktop，比如 Cinnamon 或 Budgie

::: tip
不用担心不适合，在 Fedora 中切换桌面很方便，而且切换桌面能够达到与全新安装完全一致的结果
详见 `dnf environment list`
:::

::: important
如果你有远程桌面的需求，那么仍然支持 X11 支持的桌面是最合适的（Wayland的远程桌面就是依托答辩）
否则，使用 Wayland 的桌面更适合，官方支持最积极
:::

### 3. 创建用户

进入 “创建用户”
填写用户名和密码
而后点击完成即可

::: important
一定要勾选 “为此用户添加管理权限”
:::

::: tip
使用弱密码时，需要点击完成两次
:::

### 4. 开始安装

点击 “开始安装” ！！

## Step1. 安装一些基础软件

```bash
sudo dnf in -y git vim neovim curl wget zsh fastfetch btop ncdu autofs
```

## Step2. 根文件系统快照功能

OpenSUSE 系列的包管理器会在操作前后自动创建一个快照，而且支持直接使用快照启动
这对于回滚防炸太重要了，因此对 Fedora 进行一些调整，来使其也支持这样的特性

::: important
安装时 /var 目录必须位于独立子卷!!! 否则在使用快照启动时会有问题
:::

### 1. 安装相关软件
```bash
sudo dnf copr enable lbarrys/grub-btrfs
sudo dnf mc
sudo dnf in -y snapper python3-dnf-plugin-snapper libdnf5-plugin-actions inotify-tools grub-btrfs
```

### 2. 配置 snapper 对根文件系统进行快照
配置自动清理，保留20个快照，且保留5个重要的快照
```bash
sudo snapper -c root create-config /
sudo snapper -c root set-config "NUMBER_CLEANUP=yes" "NUMBER_LIMIT=20" NUMBER_LIMIT_IMPORTANT="5"
```

> snapper 使用手册: https://zh.opensuse.org/SDB:Snapper_Tutorial

### 3. 配置 dnf 钩子使其触发 snapper
```shell
# /etc/dnf/libdnf5-plugins/actions.d/snapper.actions
# Get the snapshot description
pre_transaction::::/usr/bin/sh -c echo\ "tmp.cmd=$(ps\ -o\ command\ --no-headers\ -p\ '${pid}')"

# Creates pre snapshots for root and home and stores snapshot numbers in variables
pre_transaction::::/usr/bin/sh -c echo\ "tmp.snapper_pre_root=$(snapper\ -c\ root\ create\ -c\ number\ -t\ pre\ -p\ -d\ '${tmp.cmd}')"

# Creates post snapshots for root and home if pre snapshot numbers exist
post_transaction::::/usr/bin/sh -c [\ -n\ "${tmp.snapper_pre_root}"\ ]\ &&\ snapper\ -c\ root\ create\ -c\ number\ -t\ post\ --pre-number\ "${tmp.snapper_pre_root}"\ -d\ "${tmp.cmd}"
```

### 4. 启用 Grub 列表监听快照变动后自动更新
copr 中的 grub-btrfs 安装包中的配置与 Fedora 43 的兼容性不佳，需要微调
```bash
sudo sed -i 's|#GRUB_BTRFS_MKCONFIG=.*|GRUB_BTRFS_MKCONFIG=/usr/bin/grub2-mkconfig|g' /etc/default/grub-btrfs/config
sudo sed -i 's|#GRUB_BTRFS_SCRIPT_CHECK=.*|GRUB_BTRFS_SCRIPT_CHECK=grub2-script-check|g' /etc/default/grub-btrfs/config
sudo sed -i 's|#GRUB_BTRFS_SNAPSHOT_KERNEL_PARAMETERS=.*|GRUB_BTRFS_SNAPSHOT_KERNEL_PARAMETERS="rd.live.overlay.overlayfs=1"|g' /etc/default/grub-btrfs/config
```

首次注册 grub
```bash
sudo grub2-mkconfig -o /etc/grub2.cfg
```

启动 grub-btrfsd 监听快照
```bash
sudo systemctl enable --now grub-btrfsd
```

## Step3. 配置 Nvidia 显卡驱动

> 参考文档
> + https://rpmfusion.org/Configuration
> + https://rpmfusion.org/Howto/NVIDIA

### 1. 启用 rpmfusion 源

Nvidia 是闭源驱动，由 rpmfusion 的 nonfree 源提供
```bash
sudo dnf in -y https://mirrors.rpmfusion.org/free/fedora/rpmfusion-free-release-$(rpm -E %fedora).noarch.rpm https://mirrors.rpmfusion.org/nonfree/fedora/rpmfusion-nonfree-release-$(rpm -E %fedora).noarch.rpm
```

### 2. 安装驱动

对于 GTX-10xx 以上的现代显卡，直接使用最新的官方闭源驱动即可
这里选择安装带 Cuda 支持的驱动，方便以后炼丹

```bash
sudo dnf in -y akmod-nvidia xorg-x11-drv-nvidia-cuda xorg-x11-drv-nvidia-cuda-libs vulkan
```

由于是台式机，没有显卡切换的需求，因此不需要额外操作了

## Step4. 配置输入法

### 1. 安装 Fcitx5

```bash
sudo dnf in fcitx5 fcitx5-rime librime-lua
```

### 2. 自动激活输入法框架

编辑 /etc/environment
添加 
```shell
# only for X11, Wayland should not set this
GTK_IM_MODULE=fcitx5
QT_IM_MODULE=fcitx5
XMODIFIERS=@im=fcitx5
```

进入 系统设置 -> 开机自启动程序 -> 添加 -> Fcitx5

### 3. 配置 rime，使用 rime-ice

使用 [[雾凇拼音]](https://github.com/iDvel/rime-ice)

```bash
cd ~/.local/share/fcitx5
mv rime rime.bak
git clone https://github.com/iDvel/rime-ice rime --depth=1
echo -e "patch:\n  schema_list:\n    - schema: rime_ice" > rime/default.custom.yaml
```

::: tip
如果rime无法重新部署，可以重启fcitx5
:::

### 4. 配置 fcitx5 皮肤

使用 [[薄荷输入法 同款fcitx5皮肤]](https://github.com/witt-bit/fcitx5-theme-mint)

```bash
cd ~/.local/share/fcitx5
mkdir themes
git clone https://github.com/witt-bit/fcitx5-theme-mint.git --depth 1
cp -r fcitx5-theme-mint/mint-* ./themes
rm fcitx5-theme-mint -rf
```

打开 Fcitx5配置 > 附加组件 > 经典用户界面
  + 勾选 “垂直候选列表”
  + 将 主题 和 “深色主题” 选为 mint-green-dark

![Fcitx5 皮肤](./2025-11-17-fedora-basic-setup--fcitx-theme.png)
