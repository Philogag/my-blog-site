---
title: 嵌入式设备代理上网小技巧
icon: file
author: Philogag
date: 2025-11-13
category:
  - 软件开发
tag:
  - 开发工具
sticky: false # 置顶
star: false # 星标
footer: 
---

当在嵌入式设备上验证流媒体推流时，不可避免需要验证部分国外站点，此时需要代理上网。但嵌入式设备通常无法通过系统代理的方式进行代理上网，因此需要借助流量转发。

<!-- more -->

## 前置需求

1. 一个有效的梯子和配套软件，需要支持全局代理或TUN模式，以及支持DNS劫持
2. 准备一个linux虚拟机（比如通过vmware）

## 步骤

1. 在宿主机上做好梯子，并启用全局代理或TUN模式
    + 可以使用OBS测试梯子本身对推流的支持性

2. 为虚拟机配置两个网卡，并分别让其获取到IP地址
    + 一个使用桥接模式，将作为代理网关使用，在此案例中，为ens37
    + 一个使用NAT模式，用于转发流量给宿主机进行上网，在此案例中，为ens33

3. 配置虚拟机流量转发

```bash
echo 1 | sudo tee /proc/sys/net/ipv4/ip_forward
sudo iptables -t nat -A POSTROUTING -o ens33 -j MASQUERADE
sudo iptables -A FORWARD -j ACCEPT
```

此时，应当可以在虚拟机中 ping 通外网

4. 将IOT设备的网关和DNS改为虚拟机地址

此时，IOT设备即可通过代理上网
